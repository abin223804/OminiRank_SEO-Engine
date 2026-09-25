"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  GitPullRequest,
  RotateCcw,
  ExternalLink,
  RefreshCw,
  Clock,
  History,
  Mail,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditRecord {
  id: string;
  event: string;
  details: string | null;
  metadata?: any;
  prNumber?: number | null;
  commitSha?: string | null;
  timestamp?: string;
  createdAt?: string;
}

interface DeploymentAuditFeedProps {
  projectId?: string;
  refreshTrigger?: number;
}

export function DeploymentAuditFeed({
  projectId,
  refreshTrigger = 0,
}: DeploymentAuditFeedProps) {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadAudits = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/audits?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setAudits(data.audits || []);
      }
    } catch (err) {
      console.error("Failed to load deployment audits:", err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadAudits();
  }, [loadAudits, refreshTrigger]);

  if (!projectId || audits.length === 0) {
    return null;
  }

  const getEventBadge = (event: string) => {
    switch (event) {
      case "BUILD_PASSED":
        return {
          icon: ShieldCheck,
          label: "Sandbox Pass",
          style: "bg-emerald-950/70 border-emerald-500/40 text-emerald-400",
        };
      case "BUILD_FAILED":
        return {
          icon: AlertTriangle,
          label: "Sandbox Failed",
          style: "bg-rose-950/70 border-rose-500/40 text-rose-400",
        };
      case "COMMIT_SUCCESS":
        return {
          icon: GitPullRequest,
          label: "PR Deployed",
          style: "bg-cyan-950/70 border-cyan-500/40 text-cyan-400",
        };
      case "ROLLBACK_TRIGGERED":
        return {
          icon: RotateCcw,
          label: "Rollback",
          style: "bg-amber-950/70 border-amber-500/40 text-amber-400",
        };
      case "DIGEST_SENT":
        return {
          icon: Mail,
          label: "Digest Sent",
          style: "bg-indigo-950/70 border-indigo-500/40 text-indigo-400",
        };
      case "SITEMAP_PINGED":
        return {
          icon: Send,
          label: "Sitemap Ping",
          style: "bg-teal-950/70 border-teal-500/40 text-teal-400",
        };
      default:
        return {
          icon: Clock,
          label: event,
          style: "bg-slate-900 border-slate-700 text-slate-400",
        };
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1d]/80 overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
              Git Deployment &amp; Sandbox Audit Trail
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-400">
                Phase 4 Verified
              </span>
            </h3>
          </div>
        </div>

        <button
          onClick={loadAudits}
          className="text-slate-400 hover:text-slate-200 text-xs p-1"
          title="Refresh audit log"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
        </button>
      </div>

      <div className="divide-y divide-slate-800/50 text-xs font-mono">
        {audits.map((item) => {
          const badge = getEventBadge(item.event);
          const Icon = badge.icon;
          return (
            <div
              key={item.id}
              className="p-3.5 hover:bg-slate-900/40 transition-colors flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={cn(
                    "flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border shrink-0",
                    badge.style
                  )}
                >
                  <Icon className="w-3 h-3" />
                  <span>{badge.label}</span>
                </span>

                <div className="truncate">
                  {item.event === "COMMIT_SUCCESS" && (item.metadata?.prNumber || item.prNumber) && (
                    <span className="text-slate-200">
                      GitHub Pull Request{" "}
                      <span className="text-cyan-400 font-semibold">
                        #{item.metadata?.prNumber || item.prNumber}
                      </span>
                    </span>
                  )}
                  {item.event === "BUILD_PASSED" && (
                    <span className="text-slate-300">
                      Isolated syntax &amp; XSS dry-run check passed cleanly
                    </span>
                  )}
                  {item.event === "BUILD_FAILED" && (
                    <span className="text-rose-400">
                      Blocked deployment due to sandbox validation failures
                    </span>
                  )}
                  {item.event === "ROLLBACK_TRIGGERED" && (
                    <span className="text-amber-400">
                      Automated rollback reverted staged deployment
                    </span>
                  )}
                  {(item.metadata?.commitSha || item.commitSha) && (
                    <span className="text-[10px] text-slate-500 ml-2">
                      [{(item.metadata?.commitSha || item.commitSha).slice(0, 7)}]
                    </span>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-slate-500 shrink-0">
                {new Date(item.timestamp || item.createdAt || Date.now()).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
