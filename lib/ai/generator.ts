import { GoogleGenAI } from "@google/genai";
import {
  EnrichmentType,
  EnrichmentPayload,
  FaqPayload,
  ComparisonPayload,
  CodeSnippetPayload,
  MetaTagsPayload,
  GenerateEnrichmentRequest,
} from "./types";
import { sanitizeContentHtml, stripHtmlToPlainText, sanitizePayloadRecursively } from "./sanitizer";

/**
 * Returns an authenticated Google GenAI client or null if GEMINI_API_KEY is not configured
 */
export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

/**
 * Creates a valid Schema.org FAQPage JSON-LD object
 */
export function buildFaqPageJsonLd(faqs: Array<{ question: string; answerPlain: string }>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answerPlain,
      },
    })),
  };
}

export interface GenerationContext {
  competitorTopics?: string[];
  competitorKeywords?: string[];
}

/**
 * Generates an E-E-A-T FAQ Section + JSON-LD Schema using Gemini 2.5 with deterministic fallback
 */
export async function generateFaqContent(
  query: string,
  targetPageUrl: string,
  context?: GenerationContext
): Promise<FaqPayload> {
  const cleanKeyword = query.trim();
  const gemini = getGeminiClient();

  if (gemini) {
    try {
      const competitorTopicsText = context?.competitorTopics?.length
        ? `Outperform these competitor headings: ${context.competitorTopics.join("; ")}`
        : "";
      const competitorKeywordsText = context?.competitorKeywords?.length
        ? `Incorporate these high-relevance search terms naturally: ${context.competitorKeywords.join(", ")}`
        : "";

      const prompt = `You are a Principal Search Intelligence Engineer and Technical Content Architect.
Generate 3 authoritative, high-ranking FAQ entries that target the striking-distance keyword: "${cleanKeyword}".
Target Page URL: ${targetPageUrl}
${competitorTopicsText}
${competitorKeywordsText}

Format your response as strict JSON matching this schema:
{
  "faqs": [
    {
      "question": "string (direct, natural question people search for)",
      "answerHtml": "<p>Authoritative answer using <strong>technical specifics</strong>, verified concepts, and actionable insights.</p>"
    }
  ]
}`;

      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text;
      if (responseText) {
        const parsed = JSON.parse(responseText);
        if (Array.isArray(parsed.faqs) && parsed.faqs.length > 0) {
          const faqs = parsed.faqs.map((item: any) => ({
            question: sanitizeContentHtml(item.question || ""),
            answerHtml: sanitizeContentHtml(item.answerHtml || ""),
            answerPlain: stripHtmlToPlainText(item.answerHtml || ""),
          }));
          const jsonLdSchema = buildFaqPageJsonLd(faqs);
          return { faqs, jsonLdSchema };
        }
      }
    } catch (err) {
      console.warn("[Gemini 2.5 FAQ Fallback Triggered]", err);
    }
  }

  // Deterministic high-fidelity fallback
  const questionsAndAnswers = [
    {
      question: `What distinguishes high-performance ${cleanKeyword}?`,
      answerHtml: `<p>High-performance solutions in <strong>${cleanKeyword}</strong> prioritize deterministic scalability, robust type safety, and direct architectural alignment with search intent. By integrating verified benchmarks and real-world deployment patterns, businesses achieve measurable efficiency gains.</p>`,
    },
    {
      question: `How does autonomous implementation of ${cleanKeyword} improve ROI?`,
      answerHtml: `<p>Autonomous systems eliminate manual latency by continuously isolating striking-distance opportunities, staging schema markup, and executing verified deployments directly to production without human bottlenecks.</p>`,
    },
    {
      question: `What are the core technical prerequisites for ${cleanKeyword}?`,
      answerHtml: `<p>Key requirements include modern TypeScript frameworks (such as Next.js 15 App Router), validated PostgreSQL databases with vector indexing, and rigorous automated testing suites covering cryptographic security and RBAC governance.</p>`,
    },
  ];

  const faqs = questionsAndAnswers.map((item) => ({
    question: sanitizeContentHtml(item.question),
    answerHtml: sanitizeContentHtml(item.answerHtml),
    answerPlain: stripHtmlToPlainText(item.answerHtml),
  }));

  const jsonLdSchema = buildFaqPageJsonLd(faqs);

  return {
    faqs,
    jsonLdSchema,
  };
}

/**
 * Generates an Architectural Comparison Matrix using Gemini 2.5 with deterministic fallback
 */
export async function generateComparisonContent(
  query: string,
  context?: GenerationContext
): Promise<ComparisonPayload> {
  const cleanKeyword = query.trim();
  const gemini = getGeminiClient();

  if (gemini) {
    try {
      const prompt = `You are a Principal Solutions Architect.
Generate an architectural comparison matrix for the topic: "${cleanKeyword}".
Compare the modern engineered solution against conventional approaches across 3 critical evaluation dimensions.

Return strict JSON matching this schema:
{
  "title": "string",
  "summary": "string",
  "matrix": [
    {
      "feature": "string (Evaluation dimension)",
      "ourSolution": "string (Modern engineered approach)",
      "alternativeSolution": "string (Legacy approach)",
      "advantage": "string (Clear strategic advantage)"
    }
  ]
}`;

      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text;
      if (responseText) {
        const parsed = JSON.parse(responseText);
        if (Array.isArray(parsed.matrix) && parsed.matrix.length > 0) {
          const matrix = parsed.matrix;
          const markdownTable = [
            `| Evaluation Dimension | Engineered Solution (${cleanKeyword}) | Conventional Approach | Technical Advantage |`,
            `| :--- | :--- | :--- | :--- |`,
            ...matrix.map(
              (m: any) => `| **${m.feature}** | ${m.ourSolution} | ${m.alternativeSolution} | ${m.advantage} |`
            ),
          ].join("\n");

          return {
            title: parsed.title || `Architectural Comparison Matrix: ${cleanKeyword}`,
            summary: parsed.summary || `Technical evaluation comparing modern autonomous search engines against legacy SEO workflows for ${cleanKeyword}.`,
            matrix,
            markdownTable,
          };
        }
      }
    } catch (err) {
      console.warn("[Gemini 2.5 Comparison Fallback Triggered]", err);
    }
  }

  // Deterministic high-fidelity fallback
  const matrix = [
    {
      feature: "Ingestion Latency",
      ourSolution: "Real-time automated Search Console webhook & API sync",
      alternativeSolution: "Weekly manual CSV exports from webmaster tools",
      advantage: "Zero-latency detection of Page 2 striking-distance movements",
    },
    {
      feature: "E-E-A-T Asset Generation",
      ourSolution: "Deterministic AI schemas (FAQPage, JSON-LD, structured data)",
      alternativeSolution: "Unstructured copy paste from generic LLM chat windows",
      advantage: "100% syntactically verified rich snippet eligibility",
    },
    {
      feature: "Deployment Governance",
      ourSolution: "Automated Git PR branching with rollback safety net",
      alternativeSolution: "Manual FTP / unversioned CMS direct pasting",
      advantage: "Immutable audit log & automated build verification guard",
    },
  ];

  const markdownTable = [
    `| Evaluation Dimension | Engineered Solution (${cleanKeyword}) | Conventional Approach | Technical Advantage |`,
    `| :--- | :--- | :--- | :--- |`,
    ...matrix.map(
      (m) => `| **${m.feature}** | ${m.ourSolution} | ${m.alternativeSolution} | ${m.advantage} |`
    ),
  ].join("\n");

  return {
    title: `Architectural Comparison Matrix: ${cleanKeyword}`,
    summary: `Technical evaluation comparing modern autonomous search engines against legacy SEO workflows for ${cleanKeyword}.`,
    matrix,
    markdownTable,
  };
}

/**
 * Generates a Production Code Snippet Asset
 */
export async function generateCodeSnippetContent(
  query: string
): Promise<CodeSnippetPayload> {
  const cleanKeyword = query.trim();

  const code = `import { NextRequest, NextResponse } from "next/server";\n\n// Autonomous Handler for ${cleanKeyword}\nexport async function GET(req: NextRequest) {\n  const timestamp = new Date().toISOString();\n  return NextResponse.json({\n    status: "active",\n    query: "${cleanKeyword}",\n    timestamp,\n    cacheControl: "s-maxage=3600, stale-while-revalidate=86400",\n  });\n}`;

  return {
    language: "typescript",
    fileName: `app/api/${cleanKeyword.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/route.ts`,
    code,
    description: `Optimized Next.js Edge route handler implementing edge-cached responses for '${cleanKeyword}'.`,
    installationCommands: ["npm run build", "npm run typecheck"],
  };
}

/**
 * Generates Optimized Meta Tags (Title & Description) using Gemini 2.5 with deterministic fallback
 */
export async function generateMetaTagsContent(
  query: string
): Promise<MetaTagsPayload> {
  const cleanKeyword = query.trim();
  const gemini = getGeminiClient();

  if (gemini) {
    try {
      const prompt = `You are a Technical SEO Title & Meta Tag Optimizer.
Generate a high-CTR, search-optimized title tag and meta description for the keyword: "${cleanKeyword}".
Constraints:
- Title tag: 50-60 characters max, include keyword naturally, high intent.
- Meta description: 130-155 characters max, active voice, include value proposition.

Return strict JSON:
{
  "titleTag": "string",
  "metaDescription": "string",
  "focusKeywords": ["string", "string", "string"]
}`;

      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text;
      if (responseText) {
        const parsed = JSON.parse(responseText);
        if (parsed.titleTag && parsed.metaDescription) {
          const titleTag = parsed.titleTag.slice(0, 60);
          const metaDescription = parsed.metaDescription.slice(0, 158);
          return {
            titleTag,
            metaDescription,
            focusKeywords: Array.isArray(parsed.focusKeywords)
              ? parsed.focusKeywords
              : [cleanKeyword, "SEO automation"],
            ogTitle: titleTag,
            ogDescription: metaDescription,
          };
        }
      }
    } catch (err) {
      console.warn("[Gemini 2.5 MetaTags Fallback Triggered]", err);
    }
  }

  // Deterministic high-fidelity fallback
  const titleTag = `${cleanKeyword} | High-ROI Architecture & Engineering`.slice(0, 60);
  const metaDescription =
    `Discover advanced engineering insights, verified benchmarks, and scalable architectural patterns for ${cleanKeyword}. Staged with verified E-E-A-T compliance.`.slice(
      0,
      158
    );

  return {
    titleTag,
    metaDescription,
    focusKeywords: [cleanKeyword, "SEO automation", "E-E-A-T architecture"],
    ogTitle: titleTag,
    ogDescription: metaDescription,
  };
}

/**
 * Primary dispatch router for generating enriched assets
 */
export async function generateEnrichment(
  req: GenerateEnrichmentRequest,
  context?: GenerationContext
): Promise<EnrichmentPayload> {
  let rawPayload: EnrichmentPayload;

  switch (req.type) {
    case "FAQ": {
      const data = await generateFaqContent(req.query, req.targetPageUrl, context);
      rawPayload = { type: "FAQ", data };
      break;
    }
    case "COMPARISON": {
      const data = await generateComparisonContent(req.query, context);
      rawPayload = { type: "COMPARISON", data };
      break;
    }
    case "CODE_SNIPPET": {
      const data = await generateCodeSnippetContent(req.query);
      rawPayload = { type: "CODE_SNIPPET", data };
      break;
    }
    case "META_TAGS": {
      const data = await generateMetaTagsContent(req.query);
      rawPayload = { type: "META_TAGS", data };
      break;
    }
    default:
      throw new Error(`Unsupported enrichment type: ${(req as any).type}`);
  }

  // Guarantee that every field across the payload is sanitized
  return sanitizePayloadRecursively(rawPayload);
}
