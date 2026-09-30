import { prisma } from "@/lib/prisma";
import { scrapeCompetitorPage } from "@/lib/competitor/scraper";
import {
  analyzeAndSaveCompetitor,
  getProjectCompetitors,
  getCompetitorContextForGeneration,
} from "@/lib/competitor/service";
import {
  generateFaqContent,
  generateComparisonContent,
  generateMetaTagsContent,
} from "@/lib/ai/generator";
import { stageEnrichmentAction } from "@/lib/ai/staging";

async function runGeminiAndCompetitorTests() {
  console.log("==================================================");
  console.log("▶ RUNNING GEMINI 2.5 AI & COMPETITOR ENGINE TESTS");
  console.log("==================================================");

  const testSuffix = Date.now().toString();

  // 1. Setting up Fixtures on MongoDB Atlas
  console.log("\n1. Setting up Project Fixtures on MongoDB Atlas:");
  const testUser = await prisma.user.create({
    data: {
      email: `gemini-architect-${testSuffix}@omnirank.test`,
      name: "Gemini AI Architect",
    },
  });

  const testWorkspace = await prisma.workspace.create({
    data: {
      name: `AI Intelligence Workspace ${testSuffix}`,
      slug: `ai-ws-${testSuffix}`,
      planTier: "PRO",
    },
  });

  const testProject = await prisma.project.create({
    data: {
      workspaceId: testWorkspace.id,
      name: "AI Grounding Test Domain",
      siteUrl: "https://www.launchtest.com",
      gscPropertyId: "sc-domain:launchtest.com",
    },
  });

  console.log(`   ✓ Project '${testProject.name}' provisioned in MongoDB Atlas.`);

  // 2. Testing Competitor Web Scraping
  console.log("\n2. Testing Competitor Content Scraping & Headings Extraction:");
  const scrapeResult = await scrapeCompetitorPage(
    "https://example.com/blog/modern-seo-architecture",
    "autonomous seo"
  );

  if (!scrapeResult.domain || !scrapeResult.headings) {
    throw new Error("Competitor scraper returned empty structure");
  }
  console.log(`   ✓ Scraped domain: ${scrapeResult.domain}`);
  console.log(`   ✓ Extracted headings count: ${scrapeResult.headings.h2.length} H2s, ${scrapeResult.headings.h3.length} H3s`);
  console.log(`   ✓ Top keywords extracted: ${scrapeResult.extractedKeywords.slice(0, 5).join(", ")}`);

  // 3. Testing Competitor Persistence in MongoDB Atlas
  console.log("\n3. Testing Competitor Persistence in MongoDB Atlas:");
  const savedCompetitor = await analyzeAndSaveCompetitor(
    testProject.id,
    "https://competitor-domain.com/technical-guide",
    "search engine optimization"
  );

  const dbCompetitor = await prisma.competitor.findFirst({
    where: { projectId: testProject.id },
  });

  if (!dbCompetitor || dbCompetitor.domain !== savedCompetitor.domain) {
    throw new Error("Competitor record was not persisted to MongoDB Atlas");
  }
  console.log(`   ✓ Competitor '${dbCompetitor.domain}' saved to MongoDB Atlas collection.`);

  // 4. Testing Competitor Context Aggregation for Grounding
  console.log("\n4. Testing Grounding Signal Aggregation:");
  const context = await getCompetitorContextForGeneration(testProject.id);
  if (!Array.isArray(context.topics) || !Array.isArray(context.keywords)) {
    throw new Error("Context aggregation failed");
  }
  console.log(`   ✓ Discovered ${context.topics.length} competitor topics & ${context.keywords.length} keywords for grounding.`);

  // 5. Testing Gemini 2.5 Structured Output Generation
  console.log("\n5. Testing Gemini 2.5 Structured Content Generation:");
  const testKeyword = "nextjs edge seo architecture";

  // Test FAQ with Grounding
  const faqResult = await generateFaqContent(testKeyword, testProject.siteUrl, {
    competitorTopics: context.topics,
    competitorKeywords: context.keywords,
  });

  if (!faqResult.faqs || faqResult.faqs.length === 0 || !faqResult.jsonLdSchema) {
    throw new Error("FAQ generation failed schema requirements");
  }
  console.log(`   ✓ Generated ${faqResult.faqs.length} FAQ entries with Schema.org FAQPage compliance.`);

  // Test Comparison Matrix with Grounding
  const comparisonResult = await generateComparisonContent(testKeyword, {
    competitorTopics: context.topics,
    competitorKeywords: context.keywords,
  });

  if (!comparisonResult.matrix || comparisonResult.matrix.length === 0 || !comparisonResult.markdownTable) {
    throw new Error("Comparison matrix generation failed");
  }
  console.log(`   ✓ Generated comparison matrix with ${comparisonResult.matrix.length} evaluation dimensions.`);

  // Test Meta Tags Optimization
  const metaTagsResult = await generateMetaTagsContent(testKeyword);
  if (metaTagsResult.titleTag.length > 60 || metaTagsResult.metaDescription.length > 160) {
    throw new Error("Meta tags exceeded length constraints");
  }
  console.log(`   ✓ Generated optimized meta tags: "${metaTagsResult.titleTag}" (${metaTagsResult.titleTag.length} chars).`);

  // 6. Testing End-to-End Staging with Automatic Grounding
  console.log("\n6. Testing End-to-End Staging Pipeline with Auto-Grounding:");
  const staged = await stageEnrichmentAction(testProject.id, {
    queryText: testKeyword,
    type: "FAQ",
  });

  if (staged.status !== "STAGED" || !staged.payload) {
    throw new Error("Enrichment staging failed");
  }
  console.log(`   ✓ Staged action '${staged.id}' persisted in MongoDB Atlas.`);

  // 7. Cleanup Fixtures from MongoDB Atlas
  console.log("\n7. Cleaning up test fixtures from MongoDB Atlas...");
  await prisma.project.delete({ where: { id: testProject.id } });
  await prisma.workspace.delete({ where: { id: testWorkspace.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
  console.log("   ✓ Test fixtures safely pruned.");

  console.log("\n==================================================");
  console.log("🏆 ALL GEMINI 2.5 & COMPETITOR TESTS PASSED.");
  console.log("==================================================");
}

runGeminiAndCompetitorTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
