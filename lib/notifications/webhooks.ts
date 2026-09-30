import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";

export type WebhookEvent =
  | "RANKING_DELTA_DETECTED"
  | "PR_DEPLOYED"
  | "RECRAWL_PINGED"
  | "QUOTA_WARNING";

export type WebhookFormat = "GENERIC" | "SLACK" | "DISCORD";

export interface WebhookDispatchResult {
  subscriptionId: string;
  url: string;
  format: WebhookFormat;
  success: boolean;
  statusCode?: number;
  error?: string;
  dispatchedAt: string;
}

/**
 * Computes an HMAC-SHA256 signature header for webhook payloads
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verifies an incoming webhook HMAC-SHA256 signature using timing-safe comparison
 */
export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const expected = signWebhookPayload(payload, secret);
    const expectedBuf = Buffer.from(expected, "hex");
    const sigBuf = Buffer.from(signature, "hex");

    if (expectedBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}

/**
 * Formats notification for Slack incoming webhooks
 */
export function formatSlackMessage(event: WebhookEvent, data: any): Record<string, any> {
  let title = "OmniRank Alert";
  let description = JSON.stringify(data);

  if (event === "RANKING_DELTA_DETECTED") {
    title = `🎯 Striking Distance Alert: "${data.query}" moved to pos ${data.currentPosition} (+${data.delta})`;
    description = `Page: ${data.pageUrl}\nImpressions: ${data.impressions} | Clicks: ${data.clicks}`;
  } else if (event === "PR_DEPLOYED") {
    title = `🚀 Autonomous PR Merged/Deployed for "${data.query}"`;
    description = `Branch: ${data.branchName} (PR #${data.prNumber})\nTarget URL: ${data.targetUrl}`;
  } else if (event === "RECRAWL_PINGED") {
    title = `📡 Google Search Console & Indexing API Recrawl Notified`;
    description = `Target Sitemap: ${data.sitemapUrl}\nURLs Published: ${data.urlCount}`;
  } else if (event === "QUOTA_WARNING") {
    title = `⚠️ Plan Quota Notice: ${data.workspaceName}`;
    description = `Usage: ${data.currentUsage}/${data.quotaLimit} optimizations consumed this billing cycle.`;
  }

  return {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: title, emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: description },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*Event*: \`${event}\` | *Timestamp*: ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };
}

/**
 * Formats notification for Discord webhook embeds
 */
export function formatDiscordMessage(event: WebhookEvent, data: any): Record<string, any> {
  const colorMap: Record<WebhookEvent, number> = {
    RANKING_DELTA_DETECTED: 0x06b6d4, // Cyan
    PR_DEPLOYED: 0x10b981, // Emerald
    RECRAWL_PINGED: 0x8b5cf6, // Violet
    QUOTA_WARNING: 0xf59e0b, // Amber
  };

  return {
    embeds: [
      {
        title: `OmniRank: ${event.replace(/_/g, " ")}`,
        color: colorMap[event] || 0x06b6d4,
        description: data.summary || JSON.stringify(data),
        fields: Object.entries(data).slice(0, 5).map(([k, v]) => ({
          name: k,
          value: String(v),
          inline: true,
        })),
        footer: {
          text: "OmniRank Autonomous Search Console Intelligence",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Dispatches an event to all active webhook subscriptions for a workspace
 */
export async function dispatchWorkspaceWebhooks(
  workspaceId: string,
  event: WebhookEvent,
  data: any,
  options: { forceMock?: boolean } = {}
): Promise<WebhookDispatchResult[]> {
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: {
      workspaceId,
      isActive: true,
      events: { has: event },
    },
  });

  const results: WebhookDispatchResult[] = [];

  for (const sub of subscriptions) {
    const rawSecret = decryptSecret(sub.secretEnc);
    let payloadBody: string;
    let headers: Record<string, string> = { "Content-Type": "application/json" };

    if (sub.format === "SLACK") {
      payloadBody = JSON.stringify(formatSlackMessage(event, data));
    } else if (sub.format === "DISCORD") {
      payloadBody = JSON.stringify(formatDiscordMessage(event, data));
    } else {
      // GENERIC JSON
      const genericPayload = {
        event,
        workspaceId,
        timestamp: new Date().toISOString(),
        data,
      };
      payloadBody = JSON.stringify(genericPayload);
      const signature = signWebhookPayload(payloadBody, rawSecret);
      headers["x-omnirank-signature"] = signature;
      headers["x-omnirank-event"] = event;
    }

    if (options.forceMock || sub.url.includes("mock") || process.env.NODE_ENV === "test") {
      results.push({
        subscriptionId: sub.id,
        url: sub.url,
        format: sub.format as WebhookFormat,
        success: true,
        statusCode: 200,
        dispatchedAt: new Date().toISOString(),
      });
      continue;
    }

    try {
      const res = await fetch(sub.url, {
        method: "POST",
        headers,
        body: payloadBody,
      });

      results.push({
        subscriptionId: sub.id,
        url: sub.url,
        format: sub.format as WebhookFormat,
        success: res.ok,
        statusCode: res.status,
        error: res.ok ? undefined : `HTTP ${res.status}: ${res.statusText}`,
        dispatchedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      results.push({
        subscriptionId: sub.id,
        url: sub.url,
        format: sub.format as WebhookFormat,
        success: false,
        error: err.message,
        dispatchedAt: new Date().toISOString(),
      });
    }
  }

  return results;
}
