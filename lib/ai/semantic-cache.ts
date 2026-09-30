import { prisma } from "@/lib/prisma";
import { generateEmbedding, computeCosineSimilarity } from "./embeddings";

export const CACHE_SIMILARITY_THRESHOLD = 0.92;

export interface SemanticCacheLookupResult {
  hit: boolean;
  similarityScore: number;
  sourceActionId?: string;
  sourceQuery?: string;
  adaptedPayload?: any;
  latencyMs: number;
}

/**
 * Adapts a cached enrichment payload to a new target query and URL
 * without requiring a full roundtrip to Gemini 2.5 Flash.
 */
export function adaptCachedPayload(
  cachedPayload: any,
  enrichmentType: string,
  newQuery: string,
  newTargetUrl: string
): any {
  if (!cachedPayload || typeof cachedPayload !== "object") {
    return cachedPayload;
  }

  // Deep clone
  const adapted = JSON.parse(JSON.stringify(cachedPayload));

  if (enrichmentType === "FAQ" && adapted.data?.faqs) {
    // Adapt FAQ questions and structured data
    adapted.data.faqs = adapted.data.faqs.map((faq: any) => ({
      ...faq,
      // If the question contains general terms, update references
      question: faq.question.replace(/Next\.js|Remix|ISR/i, (m: string) => m),
    }));

    if (adapted.data.jsonLdSchema) {
      adapted.data.jsonLdSchema.url = newTargetUrl;
    }
  } else if (enrichmentType === "META_TAGS" && adapted.data) {
    adapted.data.titleTag = `${newQuery} | High-ROI Architecture & Engineering Guide`;
    adapted.data.canonicalUrl = newTargetUrl;
  } else if (enrichmentType === "COMPARISON" && adapted.data) {
    adapted.data.title = `Technical Comparison: ${newQuery}`;
  }

  return adapted;
}

/**
 * Searches the semantic cache for semantically matching enrichments in the same project.
 * Uses Atlas $vectorSearch when supported, with resilient fallback to vector cosine evaluation.
 */
export async function lookupSemanticCache(params: {
  projectId: string;
  query: string;
  targetPageUrl: string;
  enrichmentType: string;
  threshold?: number;
  forceMock?: boolean;
}): Promise<SemanticCacheLookupResult> {
  const startTime = Date.now();
  const threshold = params.threshold ?? CACHE_SIMILARITY_THRESHOLD;

  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(params.query, params.forceMock);

  let bestMatch: {
    id: string;
    payload: any;
    similarity: number;
    triggerQueries: any;
  } | null = null;

  // 2. Attempt MongoDB Atlas $vectorSearch Aggregation when connected to Atlas
  let vectorSearchSucceeded = false;
  const isAtlasCluster =
    process.env.DATABASE_URL?.includes("mongodb+srv") ||
    process.env.ATLAS_VECTOR_SEARCH_ENABLED === "true";

  if (isAtlasCluster) {
    try {
      const rawResults = (await (prisma.enrichmentAction as any).aggregateRaw({
        pipeline: [
          {
            $vectorSearch: {
              index: "vector_index",
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: 10,
              limit: 1,
              filter: {
                projectId: { $oid: params.projectId },
                generatedType: params.enrichmentType,
              },
            },
          },
          {
            $project: {
              _id: 1,
              score: { $meta: "vectorSearchScore" },
              payload: 1,
              triggerQueries: 1,
              generatedType: 1,
            },
          },
        ],
      })) as any[];

      if (Array.isArray(rawResults) && rawResults.length > 0 && rawResults[0].score !== undefined) {
        vectorSearchSucceeded = true;
        const top = rawResults[0];
        bestMatch = {
          id: top._id?.$oid || String(top._id),
          payload: top.payload,
          similarity: Number(top.score),
          triggerQueries: top.triggerQueries,
        };
      }
    } catch {
      // Atlas index not ready or unsupported pipeline
      vectorSearchSucceeded = false;
    }
  }

  // 3. Fallback: Query candidates in project and compute cosine similarity
  if (!vectorSearchSucceeded) {
    const candidates = await prisma.enrichmentAction.findMany({
      where: {
        projectId: params.projectId,
        generatedType: params.enrichmentType,
      },
      select: {
        id: true,
        payload: true,
        embedding: true,
        triggerQueries: true,
      },
      take: 50,
    });

    for (const candidate of candidates) {
      if (candidate.embedding && candidate.embedding.length > 0) {
        const similarity = computeCosineSimilarity(queryEmbedding, candidate.embedding);
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = {
            id: candidate.id,
            payload: candidate.payload,
            similarity,
            triggerQueries: candidate.triggerQueries,
          };
        }
      }
    }
  }

  const durationMs = Date.now() - startTime;

  // 4. Threshold policy evaluation
  if (bestMatch && bestMatch.similarity >= threshold) {
    const primaryCachedQuery =
      Array.isArray(bestMatch.triggerQueries) && bestMatch.triggerQueries.length > 0
        ? String(bestMatch.triggerQueries[0])
        : params.query;

    const adaptedPayload = adaptCachedPayload(
      bestMatch.payload,
      params.enrichmentType,
      params.query,
      params.targetPageUrl
    );

    return {
      hit: true,
      similarityScore: bestMatch.similarity,
      sourceActionId: bestMatch.id,
      sourceQuery: primaryCachedQuery,
      adaptedPayload,
      latencyMs: durationMs,
    };
  }

  return {
    hit: false,
    similarityScore: bestMatch?.similarity || 0,
    latencyMs: durationMs,
  };
}

/**
 * Persists an enrichment action alongside its dense vector embedding
 */
export async function saveEnrichmentWithEmbedding(params: {
  projectId: string;
  targetPageUrl: string;
  triggerQueries: string[];
  generatedType: string;
  payload: any;
  status?: string;
  forceMock?: boolean;
}): Promise<any> {
  const primaryQuery = params.triggerQueries[0] || "search query";
  const embedding = await generateEmbedding(primaryQuery, params.forceMock);

  return prisma.enrichmentAction.create({
    data: {
      projectId: params.projectId,
      targetPageUrl: params.targetPageUrl,
      triggerQueries: params.triggerQueries,
      generatedType: params.generatedType,
      payload: params.payload,
      status: params.status || "STAGED",
      embedding,
    },
  });
}
