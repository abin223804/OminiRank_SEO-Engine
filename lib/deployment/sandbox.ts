import { prisma } from "@/lib/prisma";
import { SandboxValidationResult, DeploymentEvent } from "./types";
import { sanitizeContentHtml } from "../ai/sanitizer";

/**
 * Validates a staged enrichment payload in an isolated sandbox environment
 * before permitting Git deployment or commit execution.
 */
export function validateEnrichmentPayload(payload: any): SandboxValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let syntaxCheckPassed = true;
  let sanitizationCheckPassed = true;

  if (!payload || typeof payload !== "object") {
    return {
      isValid: false,
      errors: ["Payload is missing or invalid object"],
      warnings: [],
      syntaxCheckPassed: false,
      sanitizationCheckPassed: false,
      timestamp: new Date().toISOString(),
    };
  }

  const type = payload.type;
  const data = payload.data;

  if (!type || !data) {
    errors.push("Payload missing required 'type' or 'data' field");
    syntaxCheckPassed = false;
  }

  // 1. FAQ Validation
  if (type === "FAQ") {
    if (!Array.isArray(data.faqs) || data.faqs.length === 0) {
      errors.push("FAQ payload must contain at least one FAQ item");
      syntaxCheckPassed = false;
    } else {
      for (const faq of data.faqs) {
        if (!faq.question || typeof faq.question !== "string") {
          errors.push("FAQ item missing question string");
        }
        if (!faq.answerPlain || typeof faq.answerPlain !== "string") {
          errors.push("FAQ item missing plain text answer");
        }
        // Sanitization check
        const sanitized = sanitizeContentHtml(faq.answerHtml || "");
        if (sanitized !== (faq.answerHtml || "").trim()) {
          sanitizationCheckPassed = false;
          errors.push("FAQ HTML contains unallowed tags or scripts");
        }
      }
    }

    if (!data.jsonLdSchema || typeof data.jsonLdSchema !== "object") {
      errors.push("FAQ missing Schema.org JSON-LD structured data");
      syntaxCheckPassed = false;
    } else if (data.jsonLdSchema["@type"] !== "FAQPage") {
      errors.push("JSON-LD schema @type must be 'FAQPage'");
      syntaxCheckPassed = false;
    }
  }

  // 2. Comparison Validation
  if (type === "COMPARISON") {
    if (!Array.isArray(data.matrix) || data.matrix.length === 0) {
      errors.push("Comparison payload must contain matrix rows");
      syntaxCheckPassed = false;
    }
    if (!data.markdownTable || !data.markdownTable.includes("|")) {
      errors.push("Comparison payload missing valid Markdown table");
      syntaxCheckPassed = false;
    }
  }

  // 3. Code Snippet Validation
  if (type === "CODE_SNIPPET") {
    if (!data.code || typeof data.code !== "string") {
      errors.push("Code snippet missing code body");
      syntaxCheckPassed = false;
    } else {
      // Basic syntax check for balanced braces
      const openBraces = (data.code.match(/\{/g) || []).length;
      const closeBraces = (data.code.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push(`Unbalanced braces in code snippet (${openBraces} open vs ${closeBraces} close)`);
        syntaxCheckPassed = false;
      }
    }
  }

  // 4. Meta Tags Validation
  if (type === "META_TAGS") {
    if (!data.titleTag || data.titleTag.length > 70) {
      warnings.push(`Title tag length is ${data.titleTag?.length || 0} chars (recommended <= 65)`);
    }
    if (!data.metaDescription || data.metaDescription.length > 170) {
      warnings.push(`Meta description length is ${data.metaDescription?.length || 0} chars (recommended <= 160)`);
    }
  }

  const isValid = errors.length === 0 && syntaxCheckPassed && sanitizationCheckPassed;

  return {
    isValid,
    errors,
    warnings,
    syntaxCheckPassed,
    sanitizationCheckPassed,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Persists an immutable deployment event audit record in PostgreSQL
 */
export async function recordDeploymentAudit(
  projectId: string,
  event: DeploymentEvent,
  metadata: Record<string, unknown> | null = null,
  prNumber: number | null = null,
  commitSha: string | null = null,
  customDetails?: string
) {
  const mergedMetadata = {
    ...metadata,
    prNumber: prNumber ?? (metadata as any)?.prNumber ?? null,
    commitSha: commitSha ?? (metadata as any)?.commitSha ?? null,
  };

  const detailsString =
    customDetails ||
    `${event}: ${String((metadata as any)?.targetPageUrl || (metadata as any)?.enrichmentId || (metadata as any)?.reason || "")}`.trim();

  return prisma.deploymentAudit.create({
    data: {
      projectId,
      event,
      details: detailsString,
      metadata: mergedMetadata as any,
    },
  });
}

/**
 * Triggers an automated rollback on an enrichment action and records audit log
 */
export async function triggerAutomatedRollback(
  enrichmentId: string,
  reason: string
) {
  const enrichment = await prisma.enrichmentAction.findUnique({
    where: { id: enrichmentId },
  });

  if (!enrichment) {
    throw new Error(`Enrichment action with ID '${enrichmentId}' not found.`);
  }

  // Update status to ROLLED_BACK
  const updated = await prisma.enrichmentAction.update({
    where: { id: enrichmentId },
    data: { status: "ROLLED_BACK" },
  });

  // Log ROLLBACK_TRIGGERED audit event
  await recordDeploymentAudit(
    enrichment.projectId,
    "ROLLBACK_TRIGGERED",
    {
      enrichmentId,
      reason,
      previousStatus: enrichment.status,
      timestamp: new Date().toISOString(),
    },
    enrichment.gitPrNumber,
    enrichment.gitCommitSha,
    `Rollback: ${reason}`
  );

  return updated;
}
