import sanitizeHtml from "sanitize-html";

const SANITIZER_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "b",
    "i",
    "code",
    "pre",
    "blockquote",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "span",
    "a",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    code: ["class"],
    th: ["scope", "align"],
    td: ["align"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: (tagName, attribs) => {
      // Force secure rel for links
      const href = attribs.href || "";
      const isExternal = href.startsWith("http://") || href.startsWith("https://");
      return {
        tagName: "a",
        attribs: {
          ...attribs,
          rel: isExternal ? "noopener noreferrer" : attribs.rel || "",
        },
      };
    },
  },
  disallowedTagsMode: "discard",
};

/**
 * Sanitizes an HTML string, eliminating potential XSS vectors while preserving
 * semantic formatting and E-E-A-T structure.
 */
export function sanitizeContentHtml(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }
  return sanitizeHtml(input, SANITIZER_OPTIONS).trim();
}

/**
 * Strips all HTML tags to produce clean plain text for meta tags or summaries
 */
export function stripHtmlToPlainText(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }
  // Insert space between block boundaries to avoid concatenated text
  const withSpacing = input.replace(/<\/(p|h[1-6]|li|tr|div|blockquote)>/gi, " ");
  return sanitizeHtml(withSpacing, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validates and safely serializes JSON-LD structured data for injection into
 * `<script type="application/ld+json">` without script escape exploits.
 */
export function safeSerializeJsonLd(schemaObj: Record<string, unknown>): string {
  const jsonStr = JSON.stringify(schemaObj, null, 2);
  // Prevent </script> closing tag breakout in HTML injection
  return jsonStr.replace(/<\/script>/gi, "<\\/script>");
}

/**
 * Sanitizes all text fields within an arbitrary JSON enrichment payload
 */
export function sanitizePayloadRecursively<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeContentHtml(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayloadRecursively(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      sanitizedObj[k] = sanitizePayloadRecursively(v);
    }
    return sanitizedObj as unknown as T;
  }
  return value;
}
