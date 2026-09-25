import assert from "node:assert";
import { formatEnrichmentFileContent } from "../lib/deployment/git";

console.log("==================================================");
console.log("▶ RUNNING GIT DEPLOYMENT & AUTOMATION TESTS");
console.log("==================================================\n");

// 1. FAQ File Formatting
console.log("1. Testing FAQ File Path & Content Formatting:");
const faqPayload = {
  type: "FAQ",
  data: {
    faqs: [{ question: "Q1", answerHtml: "<p>A1</p>", answerPlain: "A1" }],
    jsonLdSchema: { "@type": "FAQPage" },
  },
};
const query1 = "freelance software engineer kerala";
const faqFormat = formatEnrichmentFileContent("FAQ", faqPayload, query1);
assert.strictEqual(faqFormat.filePath, "data/seo/faqs/freelance-software-engineer-kerala.json");
assert.ok(faqFormat.content.includes("FAQPage"), "Content must be valid JSON including FAQPage");
console.log(`   ✓ FAQ mapped correctly: ${faqFormat.filePath}`);

// 2. Comparison Matrix File Formatting
console.log("\n2. Testing Comparison Matrix Markdown Document Formatting:");
const compPayload = {
  type: "COMPARISON",
  data: {
    title: "Next.js vs Remix",
    summary: "Technical evaluation",
    markdownTable: "| Dimension | Next.js | Remix |\n|---|---|---|\n| Speed | Fast | Fast |",
  },
};
const compFormat = formatEnrichmentFileContent("COMPARISON", compPayload, "nextjs vs remix seo");
assert.strictEqual(compFormat.filePath, "docs/seo/comparisons/nextjs-vs-remix-seo.md");
assert.ok(compFormat.content.startsWith("# Next.js vs Remix"));
assert.ok(compFormat.content.includes("| Dimension | Next.js | Remix |"));
console.log(`   ✓ Comparison mapped correctly: ${compFormat.filePath}`);

// 3. Code Snippet File Formatting
console.log("\n3. Testing Code Snippet File Path & Content Formatting:");
const codePayload = {
  type: "CODE_SNIPPET",
  data: {
    fileName: "app/api/autonomous-seo/route.ts",
    code: "export async function GET() { return Response.json({ status: 'ok' }); }",
  },
};
const codeFormat = formatEnrichmentFileContent("CODE_SNIPPET", codePayload, "autonomous seo api");
assert.strictEqual(codeFormat.filePath, "app/api/autonomous-seo/route.ts");
assert.strictEqual(codeFormat.content, codePayload.data.code);
console.log(`   ✓ Code snippet mapped directly: ${codeFormat.filePath}`);

// 4. Meta Tags File Formatting
console.log("\n4. Testing Meta Tags Metadata Document Formatting:");
const metaPayload = {
  type: "META_TAGS",
  data: {
    titleTag: "SEO Engine Title",
    metaDescription: "SEO Engine Description",
  },
};
const metaFormat = formatEnrichmentFileContent("META_TAGS", metaPayload, "enterprise seo tool");
assert.strictEqual(metaFormat.filePath, "data/seo/metadata/enterprise-seo-tool.json");
assert.ok(metaFormat.content.includes("SEO Engine Title"));
console.log(`   ✓ Metadata mapped correctly: ${metaFormat.filePath}`);

console.log("\n==================================================");
console.log("✅ ALL GIT DEPLOYMENT & AUTOMATION TESTS PASSED.");
console.log("==================================================");
