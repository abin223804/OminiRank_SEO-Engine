import assert from "node:assert";
import {
  isStrikingDistanceQuery,
  calculatePositionDelta,
  classifyGscRows,
  calculateSnapshotMetrics,
} from "../lib/gsc/classifier";
import { GscSearchAnalyticsRow } from "../lib/gsc/types";

console.log("==================================================");
console.log("▶ RUNNING STRIKING DISTANCE CLASSIFIER UNIT TESTS");
console.log("==================================================\n");

// 1. Boundary tests for striking distance
console.log("1. Testing Striking Distance Classification Boundary Logic:");
assert.strictEqual(isStrikingDistanceQuery(10.0, 100), false, "10.0 is Page 1, not striking distance");
assert.strictEqual(isStrikingDistanceQuery(10.1, 100), true, "10.1 is Striking Distance start");
assert.strictEqual(isStrikingDistanceQuery(11.0, 100), true, "11.0 is Page 2 start");
assert.strictEqual(isStrikingDistanceQuery(20.0, 50), true, "20.0 is Page 2 end");
assert.strictEqual(isStrikingDistanceQuery(30.0, 10), true, "30.0 is Page 3 end (inclusive)");
assert.strictEqual(isStrikingDistanceQuery(30.1, 100), false, "30.1 is Page 4, not striking distance");
assert.strictEqual(isStrikingDistanceQuery(50.0, 500), false, "50.0 is deep SERP");

// Impression thresholds
assert.strictEqual(isStrikingDistanceQuery(15.0, 4, { minImpressions: 5 }), false, "Impressions below threshold rejected");
assert.strictEqual(isStrikingDistanceQuery(15.0, 5, { minImpressions: 5 }), true, "Impressions at threshold accepted");
console.log("   ✓ Boundary limits (10.0, 10.1, 30.0, 30.1) verified.");
console.log("   ✓ Impression threshold filtering verified.");

// 2. Position Delta calculations
console.log("\n2. Testing Rank Position Delta Calculations:");
// Improved from 24.5 to 14.5 -> +10.0
assert.strictEqual(calculatePositionDelta(14.5, 24.5), 10.0, "Improvement must yield positive delta");
// Dropped from 12.0 to 18.2 -> -6.2
assert.strictEqual(calculatePositionDelta(18.2, 12.0), -6.2, "Drop must yield negative delta");
// Same position -> 0.0
assert.strictEqual(calculatePositionDelta(15.0, 15.0), 0.0, "Identical position must yield 0.0 delta");
// First time seen -> null
assert.strictEqual(calculatePositionDelta(15.0, null), null, "Unseen query must return null delta");
assert.strictEqual(calculatePositionDelta(15.0, undefined), null, "Undefined previous must return null delta");
console.log("   ✓ Position delta calculations (+improvement, -drop, null initial) verified.");

// 3. Classify GSC Rows with historical mapping
console.log("\n3. Testing GSC Row Transformation & Delta Mapping:");
const sampleRows: GscSearchAnalyticsRow[] = [
  {
    keys: ["nextjs seo agency", "https://example.com/agency"],
    impressions: 400,
    clicks: 20,
    ctr: 0.05,
    position: 12.4,
  },
  {
    keys: ["brand keyword", "https://example.com/"],
    impressions: 1200,
    clicks: 300,
    ctr: 0.25,
    position: 1.5,
  },
  {
    keys: ["obscure term", "https://example.com/test"],
    impressions: 2,
    clicks: 0,
    ctr: 0.0,
    position: 15.0,
  },
];

const previousMap = new Map<string, { position: number }>([
  ["nextjs seo agency", { position: 18.4 }], // previous rank was 18.4, now 12.4 -> delta +6.0
]);

const classified = classifyGscRows(sampleRows, "https://example.com", previousMap);
assert.strictEqual(classified.length, 3);

// Query 1: Striking distance with improvement delta
assert.strictEqual(classified[0].query, "nextjs seo agency");
assert.strictEqual(classified[0].isStrikingDistance, true);
assert.strictEqual(classified[0].positionDelta, 6.0);

// Query 2: Page 1, not striking distance
assert.strictEqual(classified[1].query, "brand keyword");
assert.strictEqual(classified[1].isStrikingDistance, false);
assert.strictEqual(classified[1].positionDelta, null);

// Query 3: Low impressions, filtered out of striking distance
assert.strictEqual(classified[2].query, "obscure term");
assert.strictEqual(classified[2].isStrikingDistance, false);
console.log("   ✓ Row transformation and historical delta linkage verified.");

// 4. Aggregate Metrics
console.log("\n4. Testing Aggregate Snapshot Metrics Calculation:");
const metrics = calculateSnapshotMetrics(classified);
assert.strictEqual(metrics.totalImpressions, 1602);
assert.strictEqual(metrics.totalClicks, 320);
assert.strictEqual(metrics.totalQueries, 3);
assert.strictEqual(metrics.strikingDistanceCount, 1);
assert.ok(metrics.avgCtr > 0.19 && metrics.avgCtr < 0.21, "CTR computed accurately");
console.log("   ✓ Aggregate snapshot metrics calculations verified.");

// Empty queries set
const emptyMetrics = calculateSnapshotMetrics([]);
assert.strictEqual(emptyMetrics.totalImpressions, 0);
assert.strictEqual(emptyMetrics.avgCtr, 0);
console.log("   ✓ Zero/empty metric handling verified.");

console.log("\n==================================================");
console.log("✅ ALL CLASSIFIER TESTS PASSED SUCCESSFULLY.");
console.log("==================================================");
