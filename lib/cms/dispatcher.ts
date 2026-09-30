import { prisma } from "@/lib/prisma";
import { validateEnrichmentPayload, recordDeploymentAudit } from "@/lib/deployment/sandbox";
import { CmsDeployResult } from "./types";
import { deployToGitHubApp } from "./github-app";
import { deployToWordPress } from "./wordpress";
import { deployToWebflow } from "./webflow";

export interface CmsDeployOptions {
  forceMock?: boolean;
}

/**
 * Unified CMS Deployment Dispatcher
 * Enforces sandbox validation, dispatches to selected CMS target, updates status, and logs audit trail.
 */
export async function deployEnrichmentToCms(
  enrichmentId: string,
  cmsConnectionId: string,
  options: CmsDeployOptions = {}
): Promise<CmsDeployResult> {
  const enrichment = await prisma.enrichmentAction.findUnique({
    where: { id: enrichmentId },
    include: { project: true },
  });

  if (!enrichment) {
    throw new Error(`EnrichmentAction '${enrichmentId}' not found.`);
  }

  const connection = await prisma.cmsConnection.findUnique({
    where: { id: cmsConnectionId },
  });

  if (!connection) {
    throw new Error(`CmsConnection '${cmsConnectionId}' not found.`);
  }

  if (connection.projectId !== enrichment.projectId) {
    throw new Error(`CmsConnection '${cmsConnectionId}' does not belong to Project '${enrichment.projectId}'.`);
  }

  // 1. Run Build Sandbox Validation
  const validation = validateEnrichmentPayload(enrichment.payload);
  if (!validation.isValid) {
    await recordDeploymentAudit(enrichment.projectId, "BUILD_FAILED", {
      enrichmentId,
      cmsConnectionId,
      provider: connection.provider,
      errors: validation.errors,
    });
    throw new Error(`Build Sandbox Validation Failed: ${validation.errors.join("; ")}`);
  }

  await recordDeploymentAudit(enrichment.projectId, "BUILD_PASSED", {
    enrichmentId,
    cmsConnectionId,
    provider: connection.provider,
  });

  // 2. Dispatch to the selected CMS provider
  let result: CmsDeployResult;

  try {
    switch (connection.provider) {
      case "GITHUB_APP":
        result = await deployToGitHubApp({
          credentialsEnc: connection.credentialsEnc,
          metadata: connection.metadata,
          enrichment,
          forceMock: options.forceMock,
        });
        break;

      case "WORDPRESS":
        result = await deployToWordPress({
          credentialsEnc: connection.credentialsEnc,
          metadata: connection.metadata,
          enrichment,
          forceMock: options.forceMock,
        });
        break;

      case "WEBFLOW":
        result = await deployToWebflow({
          credentialsEnc: connection.credentialsEnc,
          metadata: connection.metadata,
          enrichment,
          forceMock: options.forceMock,
        });
        break;

      default:
        throw new Error(`Unsupported CMS provider: ${connection.provider}`);
    }

    // 3. Mark Enrichment as COMMITTED
    await prisma.enrichmentAction.update({
      where: { id: enrichmentId },
      data: {
        status: "COMMITTED",
        gitPrNumber: typeof result.externalId === "number" ? result.externalId : undefined,
        gitCommitSha: result.details?.commitSha || undefined,
      },
    });

    // 4. Update CmsConnection lastSyncedAt
    await prisma.cmsConnection.update({
      where: { id: cmsConnectionId },
      data: {
        lastSyncedAt: new Date(),
        status: "CONNECTED",
      },
    });

    // 5. Record DeploymentAudit log
    await recordDeploymentAudit(enrichment.projectId, "CMS_DEPLOY_SUCCESS", {
      enrichmentId,
      cmsConnectionId,
      provider: connection.provider,
      externalId: result.externalId,
      externalUrl: result.externalUrl,
      details: result.details,
    });

    return result;
  } catch (deployError: any) {
    await recordDeploymentAudit(enrichment.projectId, "CMS_DEPLOY_FAILED", {
      enrichmentId,
      cmsConnectionId,
      provider: connection.provider,
      error: deployError.message,
    });

    await prisma.cmsConnection.update({
      where: { id: cmsConnectionId },
      data: { status: "ERROR" },
    });

    throw deployError;
  }
}
