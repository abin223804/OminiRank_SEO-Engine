import assert from "node:assert";
import {
  generateFaqContent,
  generateComparisonContent,
  generateCodeSnippetContent,
  generateMetaTagsContent,
  generateEnrichment,
} from "../lib/ai/generator";

console.log("==================================================");
console.log("▶ RUNNING AI CONTENT GENERATOR TESTS");
console.log("==================================================\n");

async function runGeneratorTests() {
  const query = "freelance software engineer kerala";
  const url = "https://www.testdomain.com/services";

  // 1. FAQ Generator
  console.log("1. Testing FAQ & FAQPage JSON-LD Schema Generation:");
  const faqResult = await generateFaqContent(query, url);
  assert.ok(Array.isArray(faqResult.faqs), "FAQs must be an array");
  assert.ok(faqResult.faqs.length >= 2, "Must generate at least 2 FAQ entities");

  for (const f of faqResult.faqs) {
    assert.ok(f.question.length > 5, "Question must not be empty");
    assert.ok(f.answerHtml.includes("<p>"), "HTML answer must be wrapped in paragraphs");
    assert.ok(!f.answerPlain.includes("<p>"), "Plain text answer must not have HTML tags");
  }

  // Schema.org FAQPage verification
  const schema: any = faqResult.jsonLdSchema;
  assert.strictEqual(schema["@context"], "https://schema.org");
  assert.strictEqual(schema["@type"], "FAQPage");
  assert.ok(Array.isArray(schema.mainEntity), "mainEntity must be array");
  assert.strictEqual(schema.mainEntity[0]["@type"], "Question");
  assert.strictEqual(schema.mainEntity[0].acceptedAnswer["@type"], "Answer");
  console.log(`   ✓ Generated ${faqResult.faqs.length} FAQs with Schema.org FAQPage compliance.`);

  // 2. Comparison Matrix Generator
  console.log("\n2. Testing Comparison Matrix Generation:");
  const compResult = await generateComparisonContent(query);
  assert.ok(compResult.matrix.length >= 3, "Matrix must have at least 3 comparison dimensions");
  assert.ok(compResult.markdownTable.includes("| Evaluation Dimension |"), "Must contain Markdown table header");
  assert.ok(compResult.markdownTable.includes(query), "Must reference target query");
  console.log(`   ✓ Comparison matrix created with ${compResult.matrix.length} dimensions.`);

  // 3. Code Snippet Generator
  console.log("\n3. Testing Technical Code Snippet Asset Generation:");
  const codeResult = await generateCodeSnippetContent(query);
  assert.strictEqual(codeResult.language, "typescript");
  assert.ok(codeResult.fileName.endsWith("/route.ts"), "Must output Route handler filename");
  assert.ok(codeResult.code.includes("NextResponse.json"), "Must contain valid Next.js code");
  console.log(`   ✓ TypeScript code snippet generated: ${codeResult.fileName}`);

  // 4. Meta Tags Generator
  console.log("\n4. Testing SERP Meta Tags Generation:");
  const metaResult = await generateMetaTagsContent(query);
  assert.ok(metaResult.titleTag.length <= 65, "Title tag should be under 65 chars for Google desktop truncation");
  assert.ok(metaResult.metaDescription.length <= 160, "Meta description should be under 160 chars");
  assert.ok(metaResult.focusKeywords.includes(query), "Must include target search query in keywords");
  console.log(`   ✓ SERP Meta Tags validated (Title: "${metaResult.titleTag}")`);

  // 5. Unified Dispatcher
  console.log("\n5. Testing Unified Enrichment Dispatcher:");
  const dispatched = await generateEnrichment({
    query,
    targetPageUrl: url,
    type: "FAQ",
  });
  assert.strictEqual(dispatched.type, "FAQ");
  assert.ok(dispatched.data.faqs.length > 0);
  console.log("   ✓ Unified dispatcher successfully generated and sanitized enrichment payload.");

  console.log("\n==================================================");
  console.log("✅ ALL AI GENERATOR TESTS PASSED SUCCESSFULLY.");
  console.log("==================================================");
}

runGeneratorTests().catch((err) => {
  console.error("❌ Generator test failed:", err);
  process.exit(1);
});
