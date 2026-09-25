"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  RefreshCw,
  GitPullRequest,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StagedItem {
  id: string;
  projectId: string;
  targetPageUrl: string;
  triggerQueries: string[];
  generatedType: string;
  payload: any;
  status: string;
  createdAt: string;
}

interface StagedActionsDrawerProps {
  projectId?: string;
  refreshTrigger?: number;
  onDeploySuccess?: () => void;
}

export function StagedActionsDrawer({
  projectId,
  refreshTrigger = 0,
  onDeploySuccess,
}: StagedActionsDrawerProps) {
  const [items, setItems] = useState<StagedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deployFeedback, setDeployFeedback] = useState<string | null>(null);

  const loadStagedActions = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/enrichments?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load staged enrichments:", err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadStagedActions();
  }, [loadStagedActions, refreshTrigger]);

  const handleUpdateStatus = async (enrichmentId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/enrichments/${enrichmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await loadStagedActions();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleDeploy = async (enrichmentId: string) => {
    if (!projectId) return;
    setDeployingId(enrichmentId);
    setDeployFeedback(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrichmentId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Deployment failed");
      }

      setDeployFeedback(
        `✓ PR #${data.deployment.prNumber} opened on branch '${data.deployment.branchName}'!`
      );
      await loadStagedActions();
      onDeploySuccess?.();
    } catch (err) {
      setDeployFeedback(
        `✕ Deployment error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setDeployingId(null);
    }
  };

  const handleDelete = async (enrichmentId: string) => {
    if (!confirm("Are you sure you want to discard this staged enrichment?")) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/enrichments/${enrichmentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadStagedActions();
      }
    } catch (err) {
      console.error("Failed to delete enrichment:", err);
    }
  };

  if (!projectId || items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1d]/80 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
              Staged E-E-A-T Enrichment Queue
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-semibold">
                {items.length} Actions
              </span>
            </h3>
          </div>
        </div>

        <button
          onClick={loadStagedActions}
          className="text-slate-400 hover:text-slate-200 text-xs p-1"
          title="Refresh queue"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* List */}
      <div className="divide-y divide-slate-800/50">
        {items.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <div key={item.id} className="p-4 hover:bg-slate-900/40 transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      "text-[10px] font-mono font-bold px-2 py-0.5 rounded shrink-0",
                      item.status === "APPROVED"
                        ? "bg-emerald-950/80 border border-emerald-500/40 text-emerald-400"
                        : item.status === "REJECTED"
                        ? "bg-rose-950/80 border border-rose-500/40 text-rose-400"
                        : "bg-cyan-950/80 border border-cyan-500/40 text-cyan-400"
                    )}
                  >
                    {item.status}
                  </span>

                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-200 flex items-center gap-2 truncate">
                      <span className="truncate">{item.triggerQueries.join(", ")}</span>
                      <span className="text-[10px] font-mono text-slate-500">[{item.generatedType}]</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                      <span className="truncate">{item.targetPageUrl}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.status === "STAGED" && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(item.id, "APPROVED")}
                        className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono flex items-center gap-1"
                        title="Approve for deployment"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(item.id, "REJECTED")}
                        className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-mono flex items-center gap-1"
                        title="Reject"
                      >
                        <XCircle className="w-3 h-3" />
                        <span>Reject</span>
                      </button>
                    </>
                  )}

                  {item.status === "APPROVED" && (
                    <button
                      onClick={() => handleDeploy(item.id)}
                      disabled={deployingId === item.id}
                      className="px-2.5 py-1 rounded bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-[11px] font-mono flex items-center gap-1.5 hover:brightness-110 shadow-glow-cyan disabled:opacity-50"
                      title="Run build sandbox & deploy PR"
                    >
                      <GitPullRequest className={cn("w-3 h-3", deployingId === item.id && "animate-spin")} />
                      <span>{deployingId === item.id ? "Validating & Deploying..." : "Deploy PR"}</span>
                    </button>
                  )}

                  {item.status === "COMMITTED" && (
                    <span className="px-2.5 py-1 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 text-[11px] font-mono flex items-center gap-1 font-bold">
                      <GitPullRequest className="w-3 h-3" />
                      <span>PR #{item.payload?.gitPrNumber || "Deployed"}</span>
                    </span>
                  )}

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    title={isExpanded ? "Collapse" : "Expand preview"}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1 rounded text-slate-600 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                    title="Delete action"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] space-y-2">
                  <div className="flex items-center justify-between text-slate-500 text-[10px]">
                    <span>Created: {new Date(item.createdAt).toLocaleString()}</span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <ShieldCheck className="w-3 h-3" /> Sanitized
                    </span>
                  </div>
                  <pre className="text-slate-300 overflow-x-auto max-h-[220px] bg-slate-900/60 p-2.5 rounded">
                    {JSON.stringify(item.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
