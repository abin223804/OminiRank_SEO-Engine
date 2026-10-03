import { GscSearchAnalyticsResponse, GscSearchAnalyticsRow } from "./types";

export interface GscQueryParams {
  siteUrl: string; // e.g. "sc-domain:abinschandran.in" or "https://www.abinschandran.in/"
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  dimensions?: Array<"query" | "page" | "country" | "device" | "date">;
  rowLimit?: number; // 1 to 25,000 (default 1000)
  startRow?: number;
}

/**
 * Queries Google Search Console Search Analytics API
 */
export async function queryGscSearchAnalytics(
  accessToken: string,
  params: GscQueryParams
): Promise<GscSearchAnalyticsResponse> {
  const encodedSite = encodeURIComponent(params.siteUrl);
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`;

  const payload = {
    startDate: params.startDate,
    endDate: params.endDate,
    dimensions: params.dimensions || ["query", "page"],
    rowLimit: params.rowLimit || 1000,
    startRow: params.startRow || 0,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Google Search Console API error (${response.status} ${response.statusText}): ${errorText}`
    );
  }

  const data = (await response.json()) as GscSearchAnalyticsResponse;
  return data;
}

/**
 * Generates synthetic/mock Search Console data for realistic development,
 * testing, and verification scenarios.
 */
export function generateMockGscAnalytics(siteUrl: string): GscSearchAnalyticsResponse {
  const cleanBase = siteUrl.replace(/\/$/, "");

  const mockRows: GscSearchAnalyticsRow[] = [
    // ── QUICK WINS: pos 5–15, high impressions ───────────────────────────────
    {
      keys: ["freelance software engineer kerala", `${cleanBase}/services`],
      clicks: 84, impressions: 1420, ctr: 0.059, position: 6.2,
    },
    {
      keys: ["nextjs web development services", `${cleanBase}/services`],
      clicks: 52, impressions: 980, ctr: 0.053, position: 9.4,
    },
    {
      keys: ["custom erp software developer india", `${cleanBase}/services`],
      clicks: 38, impressions: 810, ctr: 0.047, position: 12.1,
    },
    {
      keys: ["hire full stack developer india", `${cleanBase}/contact`],
      clicks: 31, impressions: 720, ctr: 0.043, position: 14.7,
    },

    // ── RISING STARS: pos 16–30, meaningful impressions ──────────────────────
    {
      keys: ["autonomous seo optimization tool", `${cleanBase}/blog/autonomous-seo`],
      clicks: 29, impressions: 640, ctr: 0.045, position: 18.7,
    },
    {
      keys: ["postgresql pgvector search setup", `${cleanBase}/blog/pgvector-guide`],
      clicks: 19, impressions: 520, ctr: 0.037, position: 22.1,
    },
    {
      keys: ["full stack software architect india", `${cleanBase}/resume`],
      clicks: 12, impressions: 430, ctr: 0.028, position: 26.5,
    },
    {
      keys: ["enterprise nextjs 15 template dark mode", `${cleanBase}/showcase`],
      clicks: 9, impressions: 390, ctr: 0.023, position: 29.8,
    },

    // ── CTR LEAKS: page 1 but CTR far below position benchmark ───────────────
    {
      keys: ["software developer portfolio website", `${cleanBase}`],
      clicks: 62, impressions: 1840, ctr: 0.034, position: 2.8,
    },
    {
      keys: ["nodejs backend developer freelance", `${cleanBase}/services`],
      clicks: 28, impressions: 960, ctr: 0.029, position: 4.1,
    },
    {
      keys: ["react developer for hire", `${cleanBase}/contact`],
      clicks: 19, impressions: 740, ctr: 0.026, position: 5.3,
    },

    // ── HIGH-VOLUME UNTAPPED: massive impressions, near-zero CTR ─────────────
    {
      keys: ["best software company in kerala", `${cleanBase}`],
      clicks: 8, impressions: 4200, ctr: 0.002, position: 38.5,
    },
    {
      keys: ["ai saas development company india", `${cleanBase}/services`],
      clicks: 4, impressions: 2900, ctr: 0.0014, position: 44.2,
    },
    {
      keys: ["web app development cost india 2026", `${cleanBase}/blog`],
      clicks: 3, impressions: 1800, ctr: 0.0017, position: 51.0,
    },

    // ── PAGE CLUSTER extras: /blog/autonomous-seo gets 3 queries ─────────────
    {
      keys: ["seo automation software", `${cleanBase}/blog/autonomous-seo`],
      clicks: 22, impressions: 580, ctr: 0.038, position: 16.3,
    },
    {
      keys: ["automated seo tool for agencies", `${cleanBase}/blog/autonomous-seo`],
      clicks: 14, impressions: 410, ctr: 0.034, position: 21.8,
    },
    // /services also picks up a 5th cluster query
    {
      keys: ["offshore software development team india", `${cleanBase}/services`],
      clicks: 17, impressions: 490, ctr: 0.035, position: 19.4,
    },

    // ── Already ranking well — not an opportunity ─────────────────────────────
    {
      keys: ["abin s chandran portfolio", cleanBase],
      clicks: 340, impressions: 1850, ctr: 0.184, position: 1.2,
    },
    {
      keys: ["tekora inhouse software engineer", cleanBase],
      clicks: 88, impressions: 410, ctr: 0.215, position: 1.8,
    },

    // ── Below impression threshold — filtered out ─────────────────────────────
    {
      keys: ["obscure technical term xyz", `${cleanBase}/tech`],
      clicks: 0, impressions: 2, ctr: 0.0, position: 16.0,
    },
  ];

  return { rows: mockRows };
}
