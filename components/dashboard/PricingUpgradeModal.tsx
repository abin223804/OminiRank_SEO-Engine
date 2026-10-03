"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Sparkles,
  Check,
  CreditCard,
  X,
  Zap,
  Shield,
  Layers,
  ExternalLink,
  Loader2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { PlanTier, TIER_QUOTAS } from "@/lib/billing/stripe";

interface PricingUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string;
  workspaceName?: string;
  currentTier?: PlanTier;
  quotaErrorMessage?: string | null;
}

interface PlanDefinition {
  tier: PlanTier;
  name: string;
  price: number;
  badge?: string;
  description: string;
  features: string[];
}

const PLANS: PlanDefinition[] = [
  {
    tier: "FREE",
    name: "Free Sandbox",
    price: 0,
    description: "Trial intelligence engine for solo developers & hobby projects.",
    features: [
      "1 Tracked Domain",
      "15 SEO Opportunities Identified",
      "3 Content & Schema Optimizations / mo",
      "Manual Search Console Sync",
      "Community Support",
    ],
  },
  {
    tier: "STARTER",
    name: "Starter Radar",
    price: 49,
    description: "Continuous rank monitoring and autonomous FAQ generation for growing brands.",
    features: [
      "3 Tracked Domains",
      "250 SEO Opportunities Identified",
      "25 Content & Schema Optimizations / mo",
      "Weekly Executive Email Digest",
      "Google Sitemap Auto-Ping",
    ],
  },
  {
    tier: "PRO",
    name: "Pro Autonomous",
    price: 149,
    badge: "Most Popular",
    description: "High-scale multi-domain automation with automated Git PR deployments.",
    features: [
      "10 Tracked Domains",
      "2,000 SEO Opportunities Identified",
      "150 Content & Schema Optimizations / mo",
      "Automated Git PR Branching",
      "Instant Indexing API Publishing",
      "Automated Safety Net & Code Verification",
      "Team Collaborators & Multi-Tenancy",
    ],
  },
  {
    tier: "AGENCY",
    name: "Agency Scale",
    price: 499,
    badge: "Unlimited",
    description: "Full white-label fleet capability for digital agencies and enterprises.",
    features: [
      "Unlimited Tracked Domains",
      "Unlimited SEO Opportunities & Rankings",
      "Unlimited Content & Schema Optimizations",
      "Multi-Tenant Client Organizations",
      "Dedicated High-Concurrency Queues",
      "Enterprise SAML & SSO Provisioning",
      "24/7 Priority Engineering SLA",
    ],
  },
];

export function PricingUpgradeModal({
  isOpen,
  onClose,
  workspaceId,
  workspaceName,
  currentTier = "STARTER",
  quotaErrorMessage,
}: PricingUpgradeModalProps) {
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleSelectTier = async (targetTier: PlanTier) => {
    if (!workspaceId || targetTier === currentTier || targetTier === "FREE") return;

    setLoadingTier(targetTier);
    setActionError(null);

    try {
      const res = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          targetTier,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate checkout session");
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to redirect to checkout");
      setLoadingTier(null);
    }
  };

  const handleOpenCustomerPortal = async () => {
    if (!workspaceId) return;

    setIsPortalLoading(true);
    setActionError(null);

    try {
      const res = await fetch("/api/v1/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to open customer billing portal");
      }

      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to load billing portal");
      setIsPortalLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 transition-opacity" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-[#070b13] p-6 sm:p-8 shadow-2xl z-50 focus:outline-none">
          {/* Header */}
          <div className="flex items-start justify-between pb-6 border-b border-slate-800/80">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
                  {workspaceName || "Current Workspace"}
                </span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs font-mono text-slate-400">
                  Active Tier: <strong className="text-white">{currentTier}</strong>
                </span>
              </div>
              <Dialog.Title className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                Scale Your Autonomous Search Operations
              </Dialog.Title>
              <Dialog.Description className="text-xs text-slate-400 mt-1 max-w-2xl">
                Upgrade your plan to unlock more SEO opportunities identified, stage additional optimizations, and accelerate ranking growth.
              </Dialog.Description>
            </div>
            <Dialog.Close className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/80 transition-colors">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          {/* Contextual Quota Error Alert */}
          {quotaErrorMessage && (
            <div className="mt-4 p-4 rounded-xl border border-amber-500/40 bg-amber-950/30 text-amber-200 text-xs font-mono flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="block text-amber-300 font-bold mb-0.5">
                  Plan Quota Exceeded
                </strong>
                <span>{quotaErrorMessage}</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {actionError && (
            <div className="mt-4 p-3.5 rounded-lg border border-rose-500/30 bg-rose-950/40 text-rose-300 text-xs font-mono">
              {actionError}
            </div>
          )}

          {/* Plans Grid */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((plan) => {
              const isCurrent = plan.tier === currentTier;
              const isPopular = plan.tier === "PRO";

              return (
                <div
                  key={plan.tier}
                  className={`rounded-xl border p-5 flex flex-col justify-between transition-all relative ${
                    isCurrent
                      ? "bg-slate-900/60 border-cyan-500/50 shadow-glow-cyan"
                      : isPopular
                      ? "bg-gradient-to-b from-cyan-950/20 to-slate-900/40 border-cyan-500/40"
                      : "bg-slate-900/30 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* Badge */}
                  {plan.badge && (
                    <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-sm">
                      {plan.badge}
                    </div>
                  )}

                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white font-mono uppercase">
                        {plan.name}
                      </h4>
                      {isCurrent && (
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                          Active
                        </span>
                      )}
                    </div>

                    {/* Price */}
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-white font-mono">
                        ${plan.price}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">/month</span>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-2 min-h-[32px]">
                      {plan.description}
                    </p>

                    {/* Feature List */}
                    <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2.5">
                      {plan.features.map((feature, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-[11px] text-slate-300"
                        >
                          <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="mt-6 pt-4 border-t border-slate-800/60">
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-2 px-3 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-mono font-semibold cursor-default"
                      >
                        Current Plan
                      </button>
                    ) : plan.price === 0 ? (
                      <button
                        disabled
                        className="w-full py-2 px-3 rounded-lg border border-slate-800 text-slate-500 text-xs font-mono cursor-default"
                      >
                        Default Tier
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSelectTier(plan.tier)}
                        disabled={loadingTier !== null}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-mono font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                          isPopular
                            ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-slate-950 shadow-glow-cyan"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                        }`}
                      >
                        {loadingTier === plan.tier ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <span>Upgrade to {plan.tier}</span>
                            <ArrowRight className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer with Billing Portal access */}
          <div className="mt-8 pt-5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <CreditCard className="w-4 h-4 text-cyan-400" />
              <span>Secure billing infrastructure powered by Stripe. Cancel or modify anytime.</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenCustomerPortal}
                disabled={isPortalLoading}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isPortalLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5" />
                )}
                <span>Manage Subscriptions & Invoices</span>
              </button>

              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
