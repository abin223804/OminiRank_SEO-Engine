export type EnrichmentType = "FAQ" | "COMPARISON" | "CODE_SNIPPET" | "META_TAGS";

export type EnrichmentStatus = "STAGED" | "APPROVED" | "REJECTED" | "COMMITTED" | "ROLLED_BACK";

export interface FaqItem {
  question: string;
  answerHtml: string;
  answerPlain: string;
}

export interface FaqPayload {
  faqs: FaqItem[];
  jsonLdSchema: Record<string, unknown>; // Schema.org FAQPage JSON-LD
}

export interface ComparisonMatrixRow {
  feature: string;
  ourSolution: string;
  alternativeSolution: string;
  advantage: string;
}

export interface ComparisonPayload {
  title: string;
  summary: string;
  matrix: ComparisonMatrixRow[];
  markdownTable: string;
}

export interface CodeSnippetPayload {
  language: string;
  fileName: string;
  code: string;
  description: string;
  installationCommands?: string[];
}

export interface MetaTagsPayload {
  titleTag: string;
  metaDescription: string;
  focusKeywords: string[];
  ogTitle: string;
  ogDescription: string;
}

export type EnrichmentPayload =
  | { type: "FAQ"; data: FaqPayload }
  | { type: "COMPARISON"; data: ComparisonPayload }
  | { type: "CODE_SNIPPET"; data: CodeSnippetPayload }
  | { type: "META_TAGS"; data: MetaTagsPayload };

export interface GenerateEnrichmentRequest {
  query: string;
  targetPageUrl: string;
  type: EnrichmentType;
  competitorContext?: string[];
}
