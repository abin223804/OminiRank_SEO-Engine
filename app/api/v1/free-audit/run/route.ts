import { NextRequest, NextResponse } from "next/server";
import { queryGscSearchAnalytics, generateMockGscAnalytics } from "@/lib/gsc/client";
import { classifyGscRows } from "@/lib/gsc/classifier";

/* ─── Opportunity Types ──────────────────────────────────────────────────────── */

/**
 * The five types of SEO opportunities we surface from GSC data.
 *
 *  QUICK_WIN      — pos  5–15,  high impressions  → small push lands on page 1
 *  RISING_STAR    — pos 16–30,  high impressions  → content upgrade climbs pages
 *  CTR_LEAK       — pos  1–10,  CTR < position benchmark → title/meta optimisation
 *  HIGH_VOLUME    — any pos,    impressions ≫ but CTR ≪ benchmark  → huge latent demand
 *  PAGE_CLUSTER   — ≥3 queries on same URL all striking  → fix one page, win many rankings
 */
export type OpportunityType =
  | "QUICK_WIN"
  | "RISING_STAR"
  | "CTR_LEAK"
  | "HIGH_VOLUME"
  | "PAGE_CLUSTER";

export interface OpportunityRow {
  query: string;
  pageUrl: string;
  position: number;
  impressions: number;
  clicks: number;
  ctr: number;
  trafficUpside: number; // estimated extra clicks/month at target CTR
  type: OpportunityType;
  priority: "HIGH" | "MEDIUM" | "LOW";
  actionLabel: string; // one-line plain-English recommendation
}

export interface OpportunityGroup {
  type: OpportunityType;
  label: string;
  description: string;
  icon: string;
  color: string; // tailwind colour key
  rows: OpportunityRow[];
}

export interface AuditResult {
  siteUrl: string;
  totalOpportunities: number;
  totalUpsideClicks: number;
  totalImpressions: number;
  groups: OpportunityGroup[];
  scannedAt: string;
}

/* ─── CTR Benchmarks by position ─────────────────────────────────────────────── */
// Industry averages — used to detect CTR leaks and high-volume opportunities.
const CTR_BENCHMARK: Record<number, number> = {
  1: 0.28, 2: 0.15, 3: 0.11, 4: 0.08, 5: 0.065,
  6: 0.053, 7: 0.043, 8: 0.037, 9: 0.032, 10: 0.028,
};

function getCtrBenchmark(position: number): number {
  const rounded = Math.min(10, Math.max(1, Math.round(position)));
  return CTR_BENCHMARK[rounded] ?? 0.02;
}

/* ─── Upside Calculation ─────────────────────────────────────────────────────── */
/**
 * Estimate extra monthly clicks if the page reached its target CTR.
 * For striking-distance queries, target = benchmark CTR for position 3 (~11%).
 * For CTR leaks, target = benchmark for the current position.
 */
function estimateUpside(
  impressions: number,
  currentCtr: number,
  targetCtr: number
): number {
  const current = Math.round(impressions * currentCtr);
  const target = Math.round(impressions * targetCtr);
  return Math.max(0, target - current);
}

/* ─── Opportunity Classifier ─────────────────────────────────────────────────── */
interface NormRow {
  query: string;
  pageUrl: string;
  position: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

function classifyOpportunities(rows: NormRow[]): OpportunityGroup[] {
  // ── 1. QUICK WINS — pos 5–15, enough impressions ──────────────────────────
  const quickWins: OpportunityRow[] = rows
    .filter((r) => r.position > 4 && r.position <= 15 && r.impressions >= 100)
    .map((r) => ({
      ...r,
      type: "QUICK_WIN" as OpportunityType,
      priority: "HIGH" as const,
      trafficUpside: estimateUpside(r.impressions, r.ctr, 0.11),
      actionLabel: "Add FAQ schema + rewrite title to push into top 5",
    }))
    .sort((a, b) => b.trafficUpside - a.trafficUpside)
    .slice(0, 8);

  // ── 2. RISING STARS — pos 16–30, enough impressions ──────────────────────
  const risingStars: OpportunityRow[] = rows
    .filter((r) => r.position > 15 && r.position <= 30 && r.impressions >= 60)
    // Exclude any already captured as a quick win (shouldn't happen, but guard)
    .filter((r) => !quickWins.find((q) => q.query === r.query))
    .map((r) => ({
      ...r,
      type: "RISING_STAR" as OpportunityType,
      priority: r.impressions >= 300 ? ("HIGH" as const) : ("MEDIUM" as const),
      trafficUpside: estimateUpside(r.impressions, r.ctr, 0.065),
      actionLabel: "Expand content depth and add internal links to this page",
    }))
    .sort((a, b) => b.trafficUpside - a.trafficUpside)
    .slice(0, 8);

  // ── 3. CTR LEAKS — pos 1–10, CTR ≥ 30% below benchmark for that position ─
  const ctrLeaks: OpportunityRow[] = rows
    .filter((r) => {
      if (r.position > 10 || r.impressions < 200) return false;
      const benchmark = getCtrBenchmark(r.position);
      return r.ctr < benchmark * 0.7; // CTR is >30% below what it should be
    })
    .map((r) => {
      const benchmark = getCtrBenchmark(r.position);
      return {
        ...r,
        type: "CTR_LEAK" as OpportunityType,
        priority: r.impressions >= 500 ? ("HIGH" as const) : ("MEDIUM" as const),
        trafficUpside: estimateUpside(r.impressions, r.ctr, benchmark),
        actionLabel: `Title/meta is underperforming at pos ${r.position.toFixed(1)} — rewrite for higher CTR`,
      };
    })
    .sort((a, b) => b.trafficUpside - a.trafficUpside)
    .slice(0, 5);

  // ── 4. HIGH-VOLUME UNTAPPED — high impressions, very low CTR, any position ─
  // Distinct from CTR leaks: these are deep-page queries with massive impression volume
  const alreadyCaptured = new Set([
    ...quickWins.map((r) => r.query),
    ...risingStars.map((r) => r.query),
    ...ctrLeaks.map((r) => r.query),
  ]);
  const highVolume: OpportunityRow[] = rows
    .filter((r) => {
      if (alreadyCaptured.has(r.query)) return false;
      if (r.impressions < 500) return false;
      return r.ctr < 0.02; // CTR below 2% despite high impressions
    })
    .map((r) => ({
      ...r,
      type: "HIGH_VOLUME" as OpportunityType,
      priority: "MEDIUM" as const,
      trafficUpside: estimateUpside(r.impressions, r.ctr, 0.04),
      actionLabel: "Create dedicated page targeting this high-demand query",
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5);

  // ── 5. PAGE CLUSTERS — same URL has ≥3 striking-distance queries ──────────
  const pageMap = new Map<string, NormRow[]>();
  rows
    .filter((r) => r.position > 4 && r.position <= 30 && r.impressions >= 50)
    .forEach((r) => {
      const existing = pageMap.get(r.pageUrl) ?? [];
      pageMap.set(r.pageUrl, [...existing, r]);
    });

  const clusterRows: OpportunityRow[] = [];
  pageMap.forEach((pageRows, pageUrl) => {
    if (pageRows.length >= 3) {
      // Take the top query for that page as the representative row
      const best = pageRows.sort((a, b) => b.impressions - a.impressions)[0];
      const totalUpside = pageRows.reduce(
        (s, r) => s + estimateUpside(r.impressions, r.ctr, 0.08),
        0
      );
      clusterRows.push({
        query: best.query,
        pageUrl,
        position: best.position,
        impressions: pageRows.reduce((s, r) => s + r.impressions, 0),
        clicks: pageRows.reduce((s, r) => s + r.clicks, 0),
        ctr: best.ctr,
        type: "PAGE_CLUSTER" as OpportunityType,
        priority: "HIGH" as const,
        trafficUpside: totalUpside,
        actionLabel: `${pageRows.length} queries clustered on this page — one content refresh wins all of them`,
      });
    }
  });
  const pageClusters = clusterRows
    .sort((a, b) => b.trafficUpside - a.trafficUpside)
    .slice(0, 4);

  // ── Assemble groups (only include non-empty ones) ─────────────────────────
  const allGroups: OpportunityGroup[] = [
    {
      type: "QUICK_WIN" as const,
      label: "Quick Wins",
      description:
        "Ranking in positions 5–15 with strong impressions. One targeted fix — schema markup, a better title, or an FAQ section — can push these to the top 5.",
      icon: "🎯",
      color: "cyan",
      rows: quickWins,
    },
    {
      type: "PAGE_CLUSTER" as const,
      label: "Page-Level Clusters",
      description:
        "Multiple queries hitting the same page in striking distance. Fix one page and win multiple rankings simultaneously — highest ROI per hour of work.",
      icon: "🔗",
      color: "violet",
      rows: pageClusters,
    },
    {
      type: "CTR_LEAK" as const,
      label: "CTR Leaks",
      description:
        "Already ranking on page 1 but getting far fewer clicks than expected. Your title or meta description is underperforming — rewriting it costs nothing.",
      icon: "📉",
      color: "amber",
      rows: ctrLeaks,
    },
    {
      type: "RISING_STAR" as const,
      label: "Rising Stars",
      description:
        "Sitting on pages 2–3 with meaningful search volume. A content upgrade and internal linking push can climb these onto page 1 within 4–8 weeks.",
      icon: "📈",
      color: "emerald",
      rows: risingStars,
    },
    {
      type: "HIGH_VOLUME" as const,
      label: "High-Volume Untapped",
      description:
        "Getting thousands of impressions but almost no clicks — the topic has real demand but no dedicated page targeting it yet.",
      icon: "⚡",
      color: "rose",
      rows: highVolume,
    },
  ].filter((g) => g.rows.length > 0);

  return allGroups;
}

/* ─── Date Range ─────────────────────────────────────────────────────────────── */
function getDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 90);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

/* ─── Site URL Candidates ────────────────────────────────────────────────────── */
function buildSiteUrlCandidates(raw: string): string[] {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (trimmed.startsWith("sc-domain:")) return [trimmed];

  let hostname = trimmed;
  try {
    hostname = new URL(
      trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
    ).hostname;
  } catch {
    hostname = trimmed.replace(/^https?:\/\//, "").split("/")[0];
  }

  return [
    `sc-domain:${hostname}`,
    `https://www.${hostname}/`,
    `https://${hostname}/`,
    `http://www.${hostname}/`,
    `http://${hostname}/`,
  ];
}

/* ─── Format Timestamp ───────────────────────────────────────────────────────── */
function formatTs() {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ─── Route Handler ──────────────────────────────────────────────────────────── */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string; siteUrl?: string };
    const { token, siteUrl } = body;

    if (!siteUrl) {
      return NextResponse.json({ error: "Missing siteUrl" }, { status: 400 });
    }

    /* ── Dev / Demo: use mock data ─────────────────────────────────────────── */
    const isDev = !token || token === "DEV_MOCK_TOKEN";
    if (isDev) {
      const mockData = generateMockGscAnalytics(siteUrl);
      const classified = classifyGscRows(mockData.rows ?? [], siteUrl);
      const groups = classifyOpportunities(classified);

      const result: AuditResult = {
        siteUrl,
        totalOpportunities: groups.reduce((s, g) => s + g.rows.length, 0),
        totalUpsideClicks: groups.reduce(
          (s, g) => s + g.rows.reduce((gs, r) => gs + r.trafficUpside, 0),
          0
        ),
        totalImpressions: groups.reduce(
          (s, g) => s + g.rows.reduce((gs, r) => gs + r.impressions, 0),
          0
        ),
        groups,
        scannedAt: formatTs(),
      };

      return NextResponse.json(result);
    }

    /* ── Real GSC fetch ────────────────────────────────────────────────────── */
    const { startDate, endDate } = getDateRange();
    const candidates = buildSiteUrlCandidates(siteUrl);
    let gscData: Awaited<ReturnType<typeof queryGscSearchAnalytics>> | null = null;
    let resolvedSiteUrl = siteUrl;

    for (const candidate of candidates) {
      try {
        const data = await queryGscSearchAnalytics(token, {
          siteUrl: candidate,
          startDate,
          endDate,
          dimensions: ["query", "page"],
          rowLimit: 5000,
        });
        gscData = data;
        resolvedSiteUrl = candidate;
        break;
      } catch {
        continue;
      }
    }

    if (!gscData?.rows?.length) {
      return NextResponse.json(
        {
          error:
            "No data found for this site in Google Search Console. Make sure the site is verified and has at least 90 days of search data.",
        },
        { status: 404 }
      );
    }

    const classified = classifyGscRows(gscData.rows ?? [], resolvedSiteUrl);
    const groups = classifyOpportunities(classified);

    const result: AuditResult = {
      siteUrl: resolvedSiteUrl,
      totalOpportunities: groups.reduce((s, g) => s + g.rows.length, 0),
      totalUpsideClicks: groups.reduce(
        (s, g) => s + g.rows.reduce((gs, r) => gs + r.trafficUpside, 0),
        0
      ),
      totalImpressions: groups.reduce(
        (s, g) => s + g.rows.reduce((gs, r) => gs + r.impressions, 0),
        0
      ),
      groups,
      scannedAt: formatTs(),
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[free-audit/run] Unexpected error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Audit failed due to an unexpected error. Please try again.",
      },
      { status: 500 }
    );
  }
}
