import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { parseServiceAccountJson, getServiceAccountAccessToken } from "./jwt";
import { recordDeploymentAudit } from "@/lib/deployment/sandbox";

export interface SitemapPingOptions {
  sitemapUrl?: string;
  forceMock?: boolean;
}

export interface SitemapPingResult {
  success: boolean;
  sitemapUrl: string;
  statusCode?: number;
  message: string;
  timestamp: string;
  mock: boolean;
}

export interface IndexingNotificationResult {
  success: boolean;
  notifiedUrls: Array<{
    url: string;
    type: "URL_UPDATED" | "URL_DELETED";
    status: "SUBMITTED" | "MOCKED" | "FAILED";
    notificationTime: string;
  }>;
  totalSuccess: number;
  totalFailed: number;
  mock: boolean;
}

export interface RecrawlTriggerResult {
  success: boolean;
  sitemapResult: SitemapPingResult;
  indexingResult: IndexingNotificationResult;
  auditId?: string;
}

const GSC_WEBMASTERS_SCOPE = "https://www.googleapis.com/auth/webmasters";
const GOOGLE_INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing";
const GOOGLE_INDEXING_ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish";

/**
 * Pings Google Search Console to submit and request re-crawl of the XML sitemap.
 */
export async function pingSitemap(
  projectId: string,
  options: SitemapPingOptions = {}
): Promise<SitemapPingResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project '${projectId}' not found`);
  }

  const sitemapUrl =
    options.sitemapUrl ||
    `${project.siteUrl.replace(/\/$/, "")}/sitemap.xml`;

  const timestamp = new Date().toISOString();

  // Hermetic mock fallback for test/offline environments
  if (options.forceMock || !project.gscServiceAccountJsonEnc) {
    return {
      success: true,
      sitemapUrl,
      statusCode: 200,
      message: `[MOCK] Sitemap '${sitemapUrl}' submitted successfully to Google Search Console for property '${project.gscPropertyId}'.`,
      timestamp,
      mock: true,
    };
  }

  try {
    const plaintextJson = decryptSecret(project.gscServiceAccountJsonEnc);
    const credentials = parseServiceAccountJson(plaintextJson);
    const accessToken = await getServiceAccountAccessToken(
      credentials,
      GSC_WEBMASTERS_SCOPE
    );

    const encodedSite = encodeURIComponent(project.gscPropertyId);
    const encodedFeed = encodeURIComponent(sitemapUrl);
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/sitemaps/${encodedFeed}`;

    const res = await fetch(endpoint, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Length": "0",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        sitemapUrl,
        statusCode: res.status,
        message: `Google Search Console sitemap submission failed (${res.status}): ${errText}`,
        timestamp,
        mock: false,
      };
    }

    return {
      success: true,
      sitemapUrl,
      statusCode: res.status,
      message: `Sitemap successfully submitted to Google Search Console for property '${project.gscPropertyId}'.`,
      timestamp,
      mock: false,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error during sitemap ping";
    return {
      success: false,
      sitemapUrl,
      statusCode: 500,
      message: errorMsg,
      timestamp,
      mock: false,
    };
  }
}

/**
 * Notifies Google Indexing API directly of updated URLs for ultra-fast indexing.
 */
export async function notifyUrlIndexing(
  projectId: string,
  urls: string[],
  options: { forceMock?: boolean } = {}
): Promise<IndexingNotificationResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project '${projectId}' not found`);
  }

  const timestamp = new Date().toISOString();
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));

  if (options.forceMock || !project.gscServiceAccountJsonEnc) {
    return {
      success: true,
      notifiedUrls: uniqueUrls.map((url) => ({
        url,
        type: "URL_UPDATED",
        status: "MOCKED",
        notificationTime: timestamp,
      })),
      totalSuccess: uniqueUrls.length,
      totalFailed: 0,
      mock: true,
    };
  }

  try {
    const plaintextJson = decryptSecret(project.gscServiceAccountJsonEnc);
    const credentials = parseServiceAccountJson(plaintextJson);
    const accessToken = await getServiceAccountAccessToken(
      credentials,
      GOOGLE_INDEXING_SCOPE
    );

    const notifiedUrls: IndexingNotificationResult["notifiedUrls"] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const url of uniqueUrls) {
      try {
        const res = await fetch(GOOGLE_INDEXING_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url,
            type: "URL_UPDATED",
          }),
        });

        if (res.ok) {
          successCount++;
          notifiedUrls.push({
            url,
            type: "URL_UPDATED",
            status: "SUBMITTED",
            notificationTime: new Date().toISOString(),
          });
        } else {
          failedCount++;
          notifiedUrls.push({
            url,
            type: "URL_UPDATED",
            status: "FAILED",
            notificationTime: new Date().toISOString(),
          });
        }
      } catch {
        failedCount++;
        notifiedUrls.push({
          url,
          type: "URL_UPDATED",
          status: "FAILED",
          notificationTime: new Date().toISOString(),
        });
      }
    }

    return {
      success: successCount > 0 || uniqueUrls.length === 0,
      notifiedUrls,
      totalSuccess: successCount,
      totalFailed: failedCount,
      mock: false,
    };
  } catch {
    return {
      success: false,
      notifiedUrls: uniqueUrls.map((url) => ({
        url,
        type: "URL_UPDATED",
        status: "FAILED",
        notificationTime: timestamp,
      })),
      totalSuccess: 0,
      totalFailed: uniqueUrls.length,
      mock: false,
    };
  }
}

/**
 * Triggers complete post-deployment recrawl: submits sitemap and publishes URL updates
 * to Google Indexing API, recording an immutable audit entry in DeploymentAudit.
 */
export async function triggerPostDeploymentRecrawl(
  projectId: string,
  deployedUrls: string[] = [],
  options: SitemapPingOptions = {}
): Promise<RecrawlTriggerResult> {
  const sitemapResult = await pingSitemap(projectId, options);
  const indexingResult = await notifyUrlIndexing(projectId, deployedUrls, {
    forceMock: options.forceMock,
  });

  const overallSuccess = sitemapResult.success && indexingResult.success;

  const audit = await recordDeploymentAudit(
    projectId,
    "SITEMAP_PINGED",
    {
      sitemapUrl: sitemapResult.sitemapUrl,
      sitemapStatus: sitemapResult.statusCode,
      notifiedUrls: indexingResult.notifiedUrls,
      mock: sitemapResult.mock,
    },
    null,
    null,
    `Google Sitemap & Indexing API ping triggered for ${deployedUrls.length} page(s). Sitemap: ${sitemapResult.sitemapUrl} (${sitemapResult.statusCode || 200}).`
  );

  return {
    success: overallSuccess,
    sitemapResult,
    indexingResult,
    auditId: audit.id,
  };
}
