import assert from "node:assert";
import { prisma } from "../lib/prisma";
import {
  generateEmbedding,
  computeCosineSimilarity,
  EMBEDDING_DIMENSION,
} from "../lib/ai/embeddings";
import {
  lookupSemanticCache,
  saveEnrichmentWithEmbedding,
  adaptCachedPayload,
  CACHE_SIMILARITY_THRESHOLD,
} from "../lib/ai/semantic-cache";

async function runVectorSearchTests() {
  console.log("==================================================");
  console.log("▶ RUNNING MONGODB ATLAS VECTOR SEARCH & CACHE TESTS");
  console.log("==================================================\n");

  const timestamp = Date.now();

  // 1. Vector generation verification (768 dimensions)
  console.log("1. Testing Dense Vector Embedding Generation (text-embedding-004):");
  const embedding = await generateEmbedding("nextjs autonomous seo engine", true);
  assert.strictEqual(embedding.length, EMBEDDING_DIMENSION, "Embedding must have exactly 768 dimensions");
  const magnitude = Math.sqrt(embedding.reduce((acc, val) => acc + val * val, 0));
  assert.ok(Math.abs(magnitude - 1.0) < 0.01, "Vector must be unit normalized (L2 norm = 1.0)");
  console.log(`   ✓ 768-dimensional dense vector generated with unit magnitude (${magnitude.toFixed(4)}).`);

  // 2. Cosine similarity calculation testing
  console.log("\n2. Testing Cosine Similarity Metric Calculations:");
  const text1 = "freelance full stack engineer kerala";
  const text2 = "freelance full stack engineer kerala"; // Identical
  const text3 = "freelance full stack engineer in kerala"; // Highly similar near-duplicate
  const text4 = "best gluten free brownie recipes"; // Completely unrelated

  const emb1 = await generateEmbedding(text1, true);
  const emb2 = await generateEmbedding(text2, true);
  const emb3 = await generateEmbedding(text3, true);
  const emb4 = await generateEmbedding(text4, true);

  const simIdentical = computeCosineSimilarity(emb1, emb2);
  const simNear = computeCosineSimilarity(emb1, emb3);
  const simFar = computeCosineSimilarity(emb1, emb4);

  assert.ok(Math.abs(simIdentical - 1.0) < 0.001, "Identical vectors must yield 1.0 similarity");
  assert.ok(simNear >= 0.90, `Near query must have >= 0.90 similarity (got ${simNear.toFixed(4)})`);
  assert.ok(simFar < 0.60, `Unrelated query must have low similarity (got ${simFar.toFixed(4)})`);
  console.log(`   ✓ Identical queries: ${simIdentical.toFixed(4)} (Expected ~1.0)`);
  console.log(`   ✓ Near queries: ${simNear.toFixed(4)} (Expected >= 0.90)`);
  console.log(`   ✓ Dissimilar queries: ${simFar.toFixed(4)} (Expected < 0.60)`);

  // 3. Database Fixtures Setup: Workspace & Project
  console.log("\n3. Setting up Database Fixtures in MongoDB:");
  const user = await prisma.user.create({
    data: {
      email: `vector-architect-${timestamp}@tekora.internal`,
      name: "Vector Search Architect",
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: `Vector Workspace ${timestamp}`,
      slug: `vector-ws-${timestamp}`,
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
  });

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: "Vector Cache Test Project",
      siteUrl: "https://vector-test.tekora.io",
      gscPropertyId: "sc-domain:vector-test.tekora.io",
    },
  });
  console.log(`   ✓ Workspace (${workspace.slug}) & Project (${project.id}) provisioned.`);

  // 4. Test Cache Miss on Empty Project
  console.log("\n4. Testing Cache Miss on Novel Query:");
  const novelQuery = "distributed clickhouse analytics pipeline";
  const missLookup = await lookupSemanticCache({
    projectId: project.id,
    query: novelQuery,
    targetPageUrl: "https://vector-test.tekora.io/analytics",
    enrichmentType: "FAQ",
    forceMock: true,
  });
  assert.strictEqual(missLookup.hit, false, "Empty project must yield cache miss");
  console.log(`   ✓ Cache Miss correctly returned (Similarity: ${missLookup.similarityScore.toFixed(4)}).`);

  // 5. Store Staged Action with Embedding Vector
  console.log("\n5. Storing Enrichment Action with 768-dim Vector in MongoDB:");
  const baseQuery = "freelance full stack engineer kerala";
  const baseFaqPayload = {
    type: "FAQ",
    data: {
      faqs: [
        {
          question: "How to hire a freelance full stack engineer in Kerala?",
          answerPlain: "Review technical case studies and verify architectural proficiency.",
          answerHtml: "<p>Review technical case studies and verify architectural proficiency.</p>",
        },
      ],
      jsonLdSchema: {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        url: "https://vector-test.tekora.io/hire",
      },
    },
  };

  const storedAction = await saveEnrichmentWithEmbedding({
    projectId: project.id,
    targetPageUrl: "https://vector-test.tekora.io/hire",
    triggerQueries: [baseQuery],
    generatedType: "FAQ",
    payload: baseFaqPayload,
    status: "APPROVED",
    forceMock: true,
  });

  assert.ok(storedAction.id, "Action created");
  assert.strictEqual(storedAction.embedding.length, EMBEDDING_DIMENSION);
  console.log(`   ✓ Stored EnrichmentAction '${storedAction.id}' with ${storedAction.embedding.length}-dim vector.`);

  // 6. Test Cache Hit with Adapted Payload (<40ms latency)
  console.log("\n6. Testing Semantic Cache Hit with Payload Adaptation:");
  const hitQuery = "freelance full stack engineer kerala"; // Exact/near query
  const hitLookup = await lookupSemanticCache({
    projectId: project.id,
    query: hitQuery,
    targetPageUrl: "https://vector-test.tekora.io/hire-kerala",
    enrichmentType: "FAQ",
    threshold: 0.90,
    forceMock: true,
  });

  assert.strictEqual(hitLookup.hit, true, "Must detect cache hit");
  assert.strictEqual(hitLookup.sourceActionId, storedAction.id);
  assert.ok(hitLookup.similarityScore >= 0.90);
  assert.ok(hitLookup.latencyMs < 40, `Cache lookup must complete in <40ms (actual: ${hitLookup.latencyMs}ms)`);
  assert.strictEqual(hitLookup.adaptedPayload.data.jsonLdSchema.url, "https://vector-test.tekora.io/hire-kerala");
  console.log(
    `   ✓ Cache Hit verified: score=${hitLookup.similarityScore.toFixed(4)}, latency=${hitLookup.latencyMs}ms (<40ms SLA).`
  );
  console.log(`   ✓ Target URL adapted cleanly in cached schema without LLM call.`);

  // 7. Cleanup Fixtures
  console.log("\n7. Cleaning up test fixtures from database...");
  await prisma.workspace.delete({ where: { id: workspace.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("   ✓ Test fixtures safely pruned.");

  console.log("\n==================================================");
  console.log("🏆 ALL ATLAS VECTOR SEARCH & CACHE TESTS PASSED.");
  console.log("==================================================");
}

runVectorSearchTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
