import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export type PlanTier = "FREE" | "STARTER" | "PRO" | "AGENCY";

export interface PlanQuota {
  maxProjects: number;
  maxQueriesPerProject: number;
  maxEnrichmentsPerMonth: number;
  priceMonthlyUsd: number;
}

export const TIER_QUOTAS: Record<PlanTier, PlanQuota> = {
  FREE: {
    maxProjects: 1,
    maxQueriesPerProject: 15,
    maxEnrichmentsPerMonth: 3,
    priceMonthlyUsd: 0,
  },
  STARTER: {
    maxProjects: 3,
    maxQueriesPerProject: 250,
    maxEnrichmentsPerMonth: 25,
    priceMonthlyUsd: 49,
  },
  PRO: {
    maxProjects: 10,
    maxQueriesPerProject: 2000,
    maxEnrichmentsPerMonth: 150,
    priceMonthlyUsd: 149,
  },
  AGENCY: {
    maxProjects: 9999,
    maxQueriesPerProject: 99999,
    maxEnrichmentsPerMonth: 99999,
    priceMonthlyUsd: 499,
  },
};

export class QuotaExceededError extends Error {
  public tier: PlanTier;
  public quotaLimit: number;
  public currentUsage: number;

  constructor(message: string, tier: PlanTier, quotaLimit: number, currentUsage: number) {
    super(message);
    this.name = "QuotaExceededError";
    this.tier = tier;
    this.quotaLimit = quotaLimit;
    this.currentUsage = currentUsage;
  }
}

/**
 * Checks whether a workspace has sufficient quota for an action
 */
export async function checkWorkspaceQuota(
  workspaceId: string,
  actionType: "CREATE_PROJECT" | "CREATE_ENRICHMENT"
) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      _count: {
        select: {
          projects: true,
        },
      },
    },
  });

  if (!workspace) {
    throw new Error(`Workspace with ID '${workspaceId}' not found.`);
  }

  const tier = workspace.planTier as PlanTier;
  const quota = TIER_QUOTAS[tier] || TIER_QUOTAS.STARTER;

  if (actionType === "CREATE_PROJECT") {
    const currentProjects = workspace._count.projects;
    if (currentProjects >= quota.maxProjects) {
      throw new QuotaExceededError(
        `Workspace tier limit reached: '${tier}' tier permits up to ${quota.maxProjects} project(s). Current count: ${currentProjects}. Please upgrade to add more domains.`,
        tier,
        quota.maxProjects,
        currentProjects
      );
    }
  }

  if (actionType === "CREATE_ENRICHMENT") {
    // Count enrichments created in current calendar month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const projectIds = (
      await prisma.project.findMany({
        where: { workspaceId },
        select: { id: true },
      })
    ).map((p) => p.id);

    const monthlyEnrichments = await prisma.enrichmentAction.count({
      where: {
        projectId: { in: projectIds },
        createdAt: { gte: startOfMonth },
      },
    });

    if (monthlyEnrichments >= quota.maxEnrichmentsPerMonth) {
      throw new QuotaExceededError(
        `Monthly enrichment quota reached for '${tier}' tier (${monthlyEnrichments}/${quota.maxEnrichmentsPerMonth}). Please upgrade your workspace plan to stage additional autonomous optimizations.`,
        tier,
        quota.maxEnrichmentsPerMonth,
        monthlyEnrichments
      );
    }
  }

  return { allowed: true, tier, quota };
}

/**
 * Verifies Stripe Webhook HMAC-SHA256 signature
 * Format: t=timestamp,v1=signature
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string
): boolean {
  if (!signatureHeader || !webhookSecret) return false;

  const items = signatureHeader.split(",");
  let timestamp = "";
  const signatures: string[] = [];

  for (const item of items) {
    const [key, value] = item.trim().split("=");
    if (key === "t") timestamp = value;
    if (key === "v1") signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return false;

  // Signed payload format: timestamp + "." + rawBody
  const signedPayload = `${timestamp}.${rawBody}`;
  const hmac = crypto.createHmac("sha256", webhookSecret);
  hmac.update(signedPayload, "utf8");
  const expectedSignature = hmac.digest("hex");

  return signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(sig, "hex"),
        Buffer.from(expectedSignature, "hex")
      );
    } catch {
      return false;
    }
  });
}

/**
 * Maps price ID to workspace tier
 */
export function resolveTierFromPriceId(priceId?: string): PlanTier {
  if (!priceId) return "STARTER";
  if (priceId === process.env.STRIPE_AGENCY_PRICE_ID) return "AGENCY";
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "PRO";
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) return "STARTER";
  return "STARTER";
}
