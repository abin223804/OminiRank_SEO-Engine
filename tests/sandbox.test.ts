import assert from "node:assert";
import { validateEnrichmentPayload } from "../lib/deployment/sandbox";

console.log("==================================================");
console.log("▶ RUNNING BUILD SANDBOX & VALIDATION SAFETY NET TESTS");
console.log("==================================================\n");

// 1. FAQ Validation
console.log("1. Testing FAQ Payload Sandbox Validation:");
const validFaq = {
  type: "FAQ",
  data: {
    faqs: [
      {
        question: "What is striking distance SEO?",
        answerHtml: "<p>Striking distance SEO targets keywords ranked in positions 11.0 to 30.0.</p>",
        answerPlain: "Striking distance SEO targets keywords ranked in positions 11.0 to 30.0.",
      },
    ],
    jsonLdSchema: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is striking distance SEO?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Striking distance SEO targets keywords ranked in positions 11.0 to 30.0.",
          },
        },
      ],
    },
  },
};

const faqPass = validateEnrichmentPayload(validFaq);
assert.strictEqual(faqPass.isValid, true, "Valid FAQ payload must pass sandbox");
assert.strictEqual(faqPass.syntaxCheckPassed, true);
assert.strictEqual(faqPass.sanitizationCheckPassed, true);
console.log("   ✓ Valid FAQ payload passed sandbox checks cleanly.");

// Invalid FAQ (missing Schema.org FAQPage)
const invalidFaq = {
  type: "FAQ",
  data: {
    faqs: [{ question: "Q1", answerHtml: "<p>A1</p>", answerPlain: "A1" }],
    jsonLdSchema: { "@type": "Thing" }, // Invalid type
  },
};
const faqFail = validateEnrichmentPayload(invalidFaq);
assert.strictEqual(faqFail.isValid, false, "Invalid JSON-LD schema must fail sandbox");
assert.ok(faqFail.errors.some((e) => e.includes("FAQPage")), "Error message must mention FAQPage");
console.log("   ✓ Malformed JSON-LD schema correctly caught and blocked.");

// 2. Comparison Validation
console.log("\n2. Testing Comparison Matrix Sandbox Validation:");
const validComp = {
  type: "COMPARISON",
  data: {
    title: "Comparison Title",
    summary: "Summary text",
    matrix: [{ feature: "Speed", ourSolution: "Fast", alternativeSolution: "Slow", advantage: "High" }],
    markdownTable: "| Feature | Us | Them | Adv |\n|---|---|---|---|\n| Speed | Fast | Slow | High |",
  },
};
const compPass = validateEnrichmentPayload(validComp);
assert.strictEqual(compPass.isValid, true);
console.log("   ✓ Valid Comparison matrix passed sandbox checks.");

// 3. Code Snippet Syntax Validation
console.log("\n3. Testing Code Snippet Syntax & Brace Balance Validation:");
const validCode = {
  type: "CODE_SNIPPET",
  data: {
    language: "typescript",
    fileName: "app/api/test/route.ts",
    code: "export function GET() { return Response.json({ ok: true }); }",
  },
};
const codePass = validateEnrichmentPayload(validCode);
assert.strictEqual(codePass.isValid, true);
console.log("   ✓ Valid TypeScript snippet passed syntax checks.");

const brokenCode = {
  type: "CODE_SNIPPET",
  data: {
    language: "typescript",
    fileName: "app/api/test/route.ts",
    code: "export function GET() { return Response.json({ ok: true );", // Unbalanced braces!
  },
};
const codeFail = validateEnrichmentPayload(brokenCode);
assert.strictEqual(codeFail.isValid, false);
assert.ok(codeFail.errors.some((e) => e.includes("Unbalanced braces")), "Must report syntax/brace imbalance");
console.log("   ✓ Unbalanced braces in code snippet caught and blocked.");

console.log("\n==================================================");
console.log("✅ ALL BUILD SANDBOX VALIDATION TESTS PASSED.");
console.log("==================================================");
