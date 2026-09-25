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
    // 1. High-value Striking Distance targets (positions 11.0 - 30.0)
    {
      keys: ["freelance software engineer kerala", `${cleanBase}/services`],
      clicks: 84,
      impressions: 1420,
      ctr: 0.0591,
      position: 11.4,
    },
    {
      keys: ["nextjs web development services", `${cleanBase}/projects`],
      clicks: 52,
      impressions: 980,
      ctr: 0.053,
      position: 13.8,
    },
    {
      keys: ["custom erp software developer kollam", `${cleanBase}/about`],
      clicks: 38,
      impressions: 810,
      ctr: 0.0469,
      position: 15.2,
    },
    {
      keys: ["autonomous seo optimization tool", `${cleanBase}/blog/autonomous-seo`],
      clicks: 29,
      impressions: 640,
      ctr: 0.0453,
      position: 18.7,
    },
    {
      keys: ["postgresql pgvector search setup", `${cleanBase}/blog/pgvector-guide`],
      clicks: 19,
      impressions: 520,
      ctr: 0.0365,
      position: 22.1,
    },
    {
      keys: ["full stack software architect india", `${cleanBase}/resume`],
      clicks: 12,
      impressions: 430,
      ctr: 0.0279,
      position: 26.5,
    },
    {
      keys: ["enterprise nextjs 15 template dark mode", `${cleanBase}/showcase`],
      clicks: 9,
      impressions: 390,
      ctr: 0.023,
      position: 29.8,
    },

    // 2. Page 1 Rankings (positions 1.0 - 10.0, not striking distance)
    {
      keys: ["abin s chandran portfolio", cleanBase],
      clicks: 340,
      impressions: 1850,
      ctr: 0.1837,
      position: 1.2,
    },
    {
      keys: ["abin s chandran software architect", `${cleanBase}/about`],
      clicks: 145,
      impressions: 920,
      ctr: 0.1576,
      position: 2.1,
    },
    {
      keys: ["tekora inhouse software engineer", cleanBase],
      clicks: 88,
      impressions: 410,
      ctr: 0.2146,
      position: 1.8,
    },

    // 3. Deep Page 4+ Queries (position > 30.0, not striking distance)
    {
      keys: ["best software company in the world", cleanBase],
      clicks: 2,
      impressions: 850,
      ctr: 0.0023,
      position: 48.3,
    },
    {
      keys: ["ai developer tool comparison 2026", `${cleanBase}/blog`],
      clicks: 1,
      impressions: 310,
      ctr: 0.0032,
      position: 54.1,
    },

    // 4. Low impression query in range (filtered by threshold)
    {
      keys: ["obscure technical term xyz", `${cleanBase}/tech`],
      clicks: 0,
      impressions: 2,
      ctr: 0.0,
      position: 16.0,
    },
  ];

  return { rows: mockRows };
}
