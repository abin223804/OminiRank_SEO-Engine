import { GscSearchAnalyticsRow, NormalizedQueryData, SnapshotMetrics } from "./types";

export interface ClassifierOptions {
  minPosition?: number;      // default: 10.0 (exclusive: > 10.0)
  maxPosition?: number;      // default: 30.0 (inclusive: <= 30.0)
  minImpressions?: number;   // default: 5
}

export const DEFAULT_CLASSIFIER_OPTIONS: Required<ClassifierOptions> = {
  minPosition: 10.0,
  maxPosition: 30.0,
  minImpressions: 5,
};

/**
 * Determines whether a search query qualifies as "Striking Distance"
 * Striking Distance: Queries that are close to Page 1 (Positions 11.0 to 30.0)
 * and have enough impression volume to justify autonomous E-E-A-T enrichment.
 */
export function isStrikingDistanceQuery(
  position: number,
  impressions: number,
  options: ClassifierOptions = {}
): boolean {
  const minPos = options.minPosition ?? DEFAULT_CLASSIFIER_OPTIONS.minPosition;
  const maxPos = options.maxPosition ?? DEFAULT_CLASSIFIER_OPTIONS.maxPosition;
  const minImp = options.minImpressions ?? DEFAULT_CLASSIFIER_OPTIONS.minImpressions;

  return position > minPos && position <= maxPos && impressions >= minImp;
}

/**
 * Calculates rank position change relative to a previous snapshot.
 * Positive number = rank improved closer to position 1 (e.g. 24.0 -> 18.0 is +6.0).
 * Negative number = rank dropped further down (e.g. 14.0 -> 20.0 is -6.0).
 */
export function calculatePositionDelta(
  currentPosition: number,
  previousPosition: number | null | undefined
): number | null {
  if (previousPosition == null || isNaN(previousPosition)) {
    return null;
  }
  // Round to 2 decimal places
  return Math.round((previousPosition - currentPosition) * 100) / 100;
}

/**
 * Normalizes raw GSC rows into domain models with classification and deltas
 */
export function classifyGscRows(
  rows: GscSearchAnalyticsRow[],
  defaultSiteUrl: string,
  previousQueriesMap: Map<string, { position: number }> = new Map(),
  options: ClassifierOptions = {}
): NormalizedQueryData[] {
  return rows.map((row) => {
    // keys[0] = query, keys[1] = pageUrl (if dimensions: ['query', 'page'])
    const query = row.keys[0] || "";
    const pageUrl = row.keys[1] || defaultSiteUrl;
    const impressions = Math.round(row.impressions || 0);
    const clicks = Math.round(row.clicks || 0);
    const ctr = Math.round((row.ctr || 0) * 10000) / 10000; // e.g. 0.0523 (5.23%)
    const position = Math.round((row.position || 0) * 10) / 10;

    const isStriking = isStrikingDistanceQuery(position, impressions, options);

    // Look up previous rank for delta
    const previous = previousQueriesMap.get(query);
    const positionDelta = previous ? calculatePositionDelta(position, previous.position) : null;

    return {
      query,
      pageUrl,
      impressions,
      clicks,
      ctr,
      position,
      isStrikingDistance: isStriking,
      positionDelta,
    };
  });
}

/**
 * Computes top-level snapshot metrics from classified query set
 */
export function calculateSnapshotMetrics(queries: NormalizedQueryData[]): SnapshotMetrics {
  if (queries.length === 0) {
    return {
      totalImpressions: 0,
      totalClicks: 0,
      avgCtr: 0,
      avgPosition: 0,
      totalQueries: 0,
      strikingDistanceCount: 0,
    };
  }

  let totalImpressions = 0;
  let totalClicks = 0;
  let weightedPositionSum = 0;
  let strikingDistanceCount = 0;

  for (const q of queries) {
    totalImpressions += q.impressions;
    totalClicks += q.clicks;
    weightedPositionSum += q.position * q.impressions;
    if (q.isStrikingDistance) {
      strikingDistanceCount++;
    }
  }

  const avgCtr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 10000 : 0;
  const avgPosition = totalImpressions > 0 ? Math.round((weightedPositionSum / totalImpressions) * 10) / 10 : 0;

  return {
    totalImpressions,
    totalClicks,
    avgCtr,
    avgPosition,
    totalQueries: queries.length,
    strikingDistanceCount,
  };
}
