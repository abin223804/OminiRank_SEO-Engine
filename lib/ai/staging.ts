import { prisma } from "@/lib/prisma";
import { EnrichmentType, EnrichmentStatus } from "./types";
import { generateEnrichment } from "./generator";
import { sanitizePayloadRecursively } from "./sanitizer";

export interface StageEnrichmentOptions {
  queryId?: string;
  queryText?: string;
  targetPageUrl?: string;
  type?: EnrichmentType;
  competitorContext?: string[];
}

/**
 * Creates and stages an autonomous E-E-A-T enrichment asset in PostgreSQL
 */
export async function stageEnrichmentAction(
  projectId: string,
  options: StageEnrichmentOptions
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project not found with ID '${projectId}'`);
  }

  let finalQuery = options.queryText?.trim() || "";
  let finalTargetUrl = options.targetPageUrl?.trim() || project.siteUrl;

  // If queryId is provided, look up the exact ranked query record
  if (options.queryId) {
    const rankedQuery = await prisma.rankedQuery.findUnique({
      where: { id: options.queryId },
    });
    if (rankedQuery) {
      finalQuery = rankedQuery.query;
      finalTargetUrl = rankedQuery.pageUrl || finalTargetUrl;
    }
  }

  if (!finalQuery) {
    throw new Error("A search query or valid queryId is required for enrichment generation.");
  }

  const enrichmentType: EnrichmentType = options.type || "FAQ";

  // Generate enriched content
  const rawPayload = await generateEnrichment({
    query: finalQuery,
    targetPageUrl: finalTargetUrl,
    type: enrichmentType,
    competitorContext: options.competitorContext,
  });

  // Ensure sanitized payload
  const cleanPayload = sanitizePayloadRecursively(rawPayload);

  // Store in database with status STAGED
  const enrichment = await prisma.enrichmentAction.create({
    data: {
      projectId: project.id,
      targetPageUrl: finalTargetUrl,
      triggerQueries: [finalQuery],
      generatedType: enrichmentType,
      payload: cleanPayload as any,
      status: "STAGED",
    },
  });

  return enrichment;
}

/**
 * Updates status or modifies the staged payload
 */
export async function updateEnrichmentStatus(
  enrichmentId: string,
  newStatus: EnrichmentStatus,
  updatedPayload?: any
) {
  const current = await prisma.enrichmentAction.findUnique({
    where: { id: enrichmentId },
  });

  if (!current) {
    throw new Error(`Enrichment action with ID '${enrichmentId}' not found.`);
  }

  const updateData: { status: string; payload?: any } = {
    status: newStatus,
  };

  if (updatedPayload) {
    updateData.payload = sanitizePayloadRecursively(updatedPayload);
  }

  const updated = await prisma.enrichmentAction.update({
    where: { id: enrichmentId },
    data: updateData,
  });

  return updated;
}

/**
 * Retrieves staged enrichments for a project with optional status filtering
 */
export async function listProjectEnrichments(
  projectId: string,
  options: {
    status?: EnrichmentStatus;
    type?: EnrichmentType;
    limit?: number;
    offset?: number;
  } = {}
) {
  const where: {
    projectId: string;
    status?: string;
    generatedType?: string;
  } = { projectId };

  if (options.status) {
    where.status = options.status;
  }
  if (options.type) {
    where.generatedType = options.type;
  }

  const limit = Math.min(Math.max(options.limit || 50, 1), 100);
  const offset = Math.max(options.offset || 0, 0);

  const [items, total] = await Promise.all([
    prisma.enrichmentAction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.enrichmentAction.count({ where }),
  ]);

  return { items, total, limit, offset };
}
