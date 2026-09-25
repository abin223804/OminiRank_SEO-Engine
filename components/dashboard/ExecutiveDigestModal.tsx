"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Mail,
  Send,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  TrendingUp,
  MousePointerClick,
  Compass,
} from "lucide-react";

interface ExecutiveDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  projectName?: string;
  onDigestSent?: () => void;
}

export function ExecutiveDigestModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  onDigestSent,
}: ExecutiveDigestModalProps) {
  const [recipientInput, setRecipientInput] = useState("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load preview data when modal opens
  useEffect(() => {
    if (isOpen && projectId) {
      loadDigestPreview(projectId);
    } else {
      setPreviewData(null);
      setStatusMessage(null);
    }
  }, [isOpen, projectId]);

  const loadDigestPreview = async (projId: string) => {
    setIsLoadingPreview(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/v1/projects/${projId}/digest/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewOnly: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewData(data.preview);
      }
    } catch (err) {
      console.error("Failed to load digest preview:", err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSendDigest = async () => {
    if (!projectId) return;
    setIsSending(true);
    setStatusMessage(null);

    const recipients = recipientInput
      .split(",")
      .map((e) => e.trim())
      .filter((e) => Boolean(e) && e.includes("@"));

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/digest/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmails: recipients.length > 0 ? recipients : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch digest");
      }

      setStatusMessage({
        type: "success",
        text: `Weekly Executive Digest dispatched to ${data.data.recipients.join(", ")}! (ID: ${data.data.messageId.substring(0, 16)}...)`,
      });

      if (onDigestSent) onDigestSent();
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Dispatch failed",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-[#0a0f1d] p-6 shadow-2xl focus:outline-none max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-glow-cyan">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  Executive Intelligence Digest
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
                    Resend Engine
                  </span>
                </Dialog.Title>
                <Dialog.Description className="text-xs text-slate-400">
                  Automated weekly Search Console & striking-distance surge report for stakeholders.
                </Dialog.Description>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Feedback Status */}
          {statusMessage && (
            <div
              className={`mt-4 p-3 rounded-lg border text-xs font-mono flex items-center gap-2 ${
                statusMessage.type === "success"
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-950/40 border-rose-500/30 text-rose-300"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Recipient Input */}
          <div className="mt-4 space-y-2">
            <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
              <span>Recipients (Comma-separated emails)</span>
              <span className="text-[10px] text-slate-500">
                Leave blank to email workspace owners
              </span>
            </label>
            <input
              type="text"
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              placeholder="e.g. founder@domain.com, cto@domain.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Live Preview Box */}
          <div className="mt-4 border border-slate-800 rounded-xl bg-slate-950/60 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                Live Digest Snapshot Preview
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {previewData ? previewData.data.reportDate : "Loading..."}
              </span>
            </div>

            {isLoadingPreview ? (
              <div className="py-8 text-center text-xs font-mono text-slate-500 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <span>Generating digest preview...</span>
              </div>
            ) : previewData ? (
              <div className="space-y-3 text-xs">
                {/* Metric Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono">
                    <div className="text-[10px] text-slate-400 uppercase">Impressions</div>
                    <div className="text-sm font-bold text-white">
                      {previewData.data.kpis.impressions.current.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-emerald-400">
                      +{previewData.data.kpis.impressions.percentageChange}%
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono">
                    <div className="text-[10px] text-slate-400 uppercase">Clicks</div>
                    <div className="text-sm font-bold text-white">
                      {previewData.data.kpis.clicks.current.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-emerald-400">
                      +{previewData.data.kpis.clicks.percentageChange}%
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono">
                    <div className="text-[10px] text-slate-400 uppercase">Avg CTR</div>
                    <div className="text-sm font-bold text-white">
                      {previewData.data.kpis.ctr.current.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-slate-500">Active</div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono">
                    <div className="text-[10px] text-slate-400 uppercase">Avg Position</div>
                    <div className="text-sm font-bold text-cyan-400">
                      {previewData.data.kpis.avgPosition.current.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-cyan-400">Page 1-3</div>
                  </div>
                </div>

                {/* Top Surging Striking Distance Targets */}
                <div>
                  <div className="text-[11px] font-mono text-cyan-400 mb-1 flex items-center justify-between">
                    <span>Surging Striking Queries ({previewData.data.totalStrikingCount} Total)</span>
                    <span className="text-[10px] text-slate-500">Pos 11.0 – 30.0</span>
                  </div>
                  <div className="space-y-1 font-mono text-[11px]">
                    {previewData.data.strikingDistanceQueries.slice(0, 3).map((q: any, i: number) => (
                      <div
                        key={i}
                        className="p-2 rounded bg-slate-900/80 border border-slate-800 flex items-center justify-between"
                      >
                        <span className="text-slate-200 truncate max-w-[260px]">"{q.query}"</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-cyan-400 font-bold">Pos {q.position.toFixed(1)}</span>
                          <span className="text-slate-400">{q.impressions.toLocaleString()} imp</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs font-mono text-slate-500">
                Run a Search Console sync to populate digest data.
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-mono font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSendDigest}
              disabled={isSending || isLoadingPreview}
              className="px-4 py-2 rounded-lg text-xs font-mono font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 hover:brightness-110 shadow-glow-cyan flex items-center gap-2 disabled:opacity-40"
            >
              <Send className={`w-3.5 h-3.5 ${isSending ? "animate-pulse" : ""}`} />
              <span>{isSending ? "Dispatching..." : "Dispatch Digest Now"}</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
