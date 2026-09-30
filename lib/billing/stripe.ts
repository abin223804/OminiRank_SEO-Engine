import crypto from "node:crypto";
import Stripe from "stripe";
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
 * Returns an authenticated Stripe client or null if not configured
 */
export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey, {
    apiVersion: "2025-02-24.acacia" as any,
  });
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
 * Creates a Stripe Checkout Session for subscription upgrade
 */
export async function createCheckoutSession(params: {
  workspaceId: string;
  userEmail: string;
  userName?: string | null;
  targetTier: PlanTier;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; sessionId?: string; isMock: boolean }> {
  const stripe = getStripeClient();
  const workspace = await prisma.workspace.findUnique({
    where: { id: params.workspaceId },
  });

  if (!workspace) {
    throw new Error(`Workspace '${params.workspaceId}' not found`);
  }

  // Graceful fallback for local development & testing when keys are omitted
  if (!stripe) {
    const mockSessionId = `mock_cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mockUrl = `${params.successUrl}?session_id=${mockSessionId}&mock=true&tier=${params.targetTier}`;
    return { url: mockUrl, sessionId: mockSessionId, isMock: true };
  }

  // Resolve or create customer in Stripe
  let customerId = workspace.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: params.userEmail,
      name: params.userName || undefined,
      metadata: {
        workspaceId: workspace.id,
        workspaceSlug: workspace.slug,
      },
    });
    customerId = customer.id;
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const quota = TIER_QUOTAS[params.targetTier];
  const configuredPriceId =
    params.targetTier === "AGENCY"
      ? process.env.STRIPE_AGENCY_PRICE_ID
      : params.targetTier === "PRO"
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_STARTER_PRICE_ID;

  let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

  if (configuredPriceId) {
    lineItems = [{ price: configuredPriceId, quantity: 1 }];
  } else {
    // Dynamic price definition if pre-created Stripe price IDs are not configured
    lineItems = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `OmniRank ${params.targetTier} Plan`,
            description: `Autonomous Search Console Intelligence (${quota.maxProjects} Domains, ${quota.maxEnrichmentsPerMonth} Monthly AI Enrichments)`,
          },
          unit_amount: quota.priceMonthlyUsd * 100,
          recurring: {
            interval: "month",
          },
        },
        quantity: 1,
      },
    ];
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: lineItems,
    metadata: {
      workspaceId: workspace.id,
      planTier: params.targetTier,
    },
    client_reference_id: workspace.id,
    success_url: `${params.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: params.cancelUrl,
  });

  return { url: session.url || params.cancelUrl, sessionId: session.id, isMock: false };
}

/**
 * Creates a Stripe Billing Portal session for managing subscriptions & invoices
 */
export async function createCustomerPortalSession(params: {
  workspaceId: string;
  returnUrl: string;
}): Promise<{ url: string; isMock: boolean }> {
  const stripe = getStripeClient();
  const workspace = await prisma.workspace.findUnique({
    where: { id: params.workspaceId },
  });

  if (!workspace) {
    throw new Error(`Workspace '${params.workspaceId}' not found`);
  }

  if (!stripe) {
    return {
      url: `${params.returnUrl}?portal_mock=true`,
      isMock: true,
    };
  }

  if (!workspace.stripeCustomerId) {
    throw new Error("No active Stripe customer account associated with this workspace.");
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: workspace.stripeCustomerId,
    return_url: params.returnUrl,
  });

  return { url: portalSession.url, isMock: false };
}

/**
 * Verifies Stripe Webhook HMAC-SHA256 signature
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
