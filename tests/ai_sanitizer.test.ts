import assert from "node:assert";
import {
  sanitizeContentHtml,
  stripHtmlToPlainText,
  safeSerializeJsonLd,
  sanitizePayloadRecursively,
} from "../lib/ai/sanitizer";

console.log("==================================================");
console.log("▶ RUNNING AI CONTENT SANITIZER & XSS GUARD TESTS");
console.log("==================================================\n");

// 1. Malicious script tag stripping
console.log("1. Testing Malicious Script & Event Injection Stripping:");
const maliciousScript = "<p>Clean text</p><script>alert('pwned')</script>";
const sanitizedScript = sanitizeContentHtml(maliciousScript);
assert.strictEqual(sanitizedScript, "<p>Clean text</p>", "Must strip script tags completely");
console.log("   ✓ <script> tag stripping verified.");

const maliciousEventHandler = '<a href="https://example.com" onclick="stealCookies()">Link</a>';
const sanitizedHandler = sanitizeContentHtml(maliciousEventHandler);
assert.ok(!sanitizedHandler.includes("onclick"), "Must strip onclick attributes");
assert.ok(sanitizedHandler.includes('rel="noopener noreferrer"'), "Must inject safe rel on external link");
console.log("   ✓ Inline event handlers (onclick) stripped and rel enforced.");

const javascriptHref = '<a href="javascript:alert(1)">Click Me</a>';
const sanitizedJsHref = sanitizeContentHtml(javascriptHref);
assert.ok(!sanitizedJsHref.includes("javascript:"), "Must reject javascript: pseudo-protocol");
console.log("   ✓ javascript: protocol execution blocked.");

// 2. Allowed Semantic Tags Preservation
console.log("\n2. Testing Semantic Formatting Preservation:");
const semanticHtml =
  "<p>We recommend <strong>Next.js 15</strong> with <em>TypeScript</em> for <code>SEO engines</code>.</p>";
const preserved = sanitizeContentHtml(semanticHtml);
assert.strictEqual(preserved, semanticHtml, "Must preserve safe semantic tags");
console.log("   ✓ Safe semantic tags (p, strong, em, code) preserved verbatim.");

// 3. Plain Text Stripping
console.log("\n3. Testing HTML Stripping to Plain Text:");
const dirtySnippet = "<h3>Section Title</h3><p>Detailed answer with a <a href='#'>link</a>.</p>";
const plain = stripHtmlToPlainText(dirtySnippet);
assert.strictEqual(plain, "Section Title Detailed answer with a link.");
console.log("   ✓ Plain text conversion verified.");

// 4. JSON-LD Breakout Protection
console.log("\n4. Testing JSON-LD Script Breakout Protection:");
const maliciousSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  name: "Breakout Test </script><script>alert(1)</script>",
};
const serializedJsonLd = safeSerializeJsonLd(maliciousSchema);
assert.ok(!serializedJsonLd.includes("</script>"), "Must not contain raw unescaped </script> tag");
assert.ok(serializedJsonLd.includes("<\\/script>"), "Must escape closing script tag");
console.log("   ✓ JSON-LD closing tag breakout protection verified.");

// 5. Recursive Object Sanitization
console.log("\n5. Testing Recursive Payload Sanitization:");
const dirtyPayload = {
  title: "Safe Title",
  htmlContent: "<div><p>Paragraph</p><iframe src='https://attacker.com'></iframe></div>",
  nested: {
    answer: "<strong>Good</strong><script>bad()</script>",
    tags: ["<span>tag1</span>", "<style>body{color:red}</style>tag2"],
  },
};
const cleanPayload = sanitizePayloadRecursively(dirtyPayload);
assert.ok(!cleanPayload.htmlContent.includes("iframe"), "Nested iframe removed");
assert.ok(!cleanPayload.nested.answer.includes("script"), "Nested script removed");
assert.ok(!cleanPayload.nested.tags[1].includes("style"), "Nested style removed");
console.log("   ✓ Deep recursive payload sanitization verified.");

console.log("\n==================================================");
console.log("✅ ALL SANITIZER & XSS GUARD TESTS PASSED.");
console.log("==================================================");
