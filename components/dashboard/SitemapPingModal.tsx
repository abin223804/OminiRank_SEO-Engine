"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Send,
  Compass,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Layers,
  Globe,
} from "lucide-react";

interface SitemapPingModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  siteUrl?: string;
  gscPropertyId?: string;
  onPingSuccess?: () => void;
}

export function SitemapPingModal({
  isOpen,
  onClose,
  projectId,
  siteUrl,
  gscPropertyId,
  onPingSuccess,
}: SitemapPingModalProps) {
  const defaultSitemap = siteUrl
    ? `${siteUrl.replace(/\/$/, "")}/sitemap.xml`
    : "";
  const [sitemapUrl, setSitemapUrl] = useState(defaultSitemap);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{
    type: "success" | "error";
    message: string;
    details?: any;
  } | null>(null);

  const handlePing = async () => {
    if (!projectId) return;
    setIsPinging(true);
    setPingResult(null);

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/sitemap/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sitemapUrl: sitemapUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit sitemap");
      }

      setPingResult({
        type: "success",
        message: data.message || "Sitemap successfully submitted to Google Search Console!",
        details: data.data,
      });

      if (onPingSuccess) onPingSuccess();
    } catch (err) {
      setPingResult({
        type: "error",
        message: err instanceof Error ? err.message : "Sitemap ping encountered an error",
      });
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-[#0a0f1d] p-6 shadow-2xl focus:outline-none">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-glow-emerald">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  Google Sitemap & Indexing Ping
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                    Webmasters API
                  </span>
                </Dialog.Title>
                <Dialog.Description className="text-xs text-slate-400">
                  Notify Google Search Console to immediately recrawl updated pages and sitemaps.
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

          {/* Feedback Result */}
          {pingResult && (
            <div
              className={`mt-4 p-3 rounded-lg border text-xs font-mono flex items-center gap-2 ${
                pingResult.type === "success"
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-950/40 border-rose-500/30 text-rose-300"
              }`}
            >
              {pingResult.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{pingResult.message}</span>
            </div>
          )}

          {/* Sitemap URL Input */}
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-mono text-slate-300">Target Sitemap Endpoint</label>
              <div className="mt-1 flex rounded-lg border border-slate-700 bg-slate-900/90 overflow-hidden focus-within:border-emerald-500">
                <span className="inline-flex items-center px-3 text-xs text-slate-500 border-r border-slate-800">
                  <Globe className="w-3.5 h-3.5" />
                </span>
                <input
                  type="url"
                  value={sitemapUrl}
                  onChange={(e) => setSitemapUrl(e.target.value)}
                  placeholder="https://example.com/sitemap.xml"
                  className="w-full bg-transparent px-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-xs font-mono">
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Property ID:</span>
                <span className="text-cyan-400 font-semibold">{gscPropertyId || "sc-domain:..."}</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Recrawl Method:</span>
                <span className="text-slate-300">RFC Authenticated GSC PUT / Indexing Pub</span>
              </div>
            </div>
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
              onClick={handlePing}
              disabled={isPinging || !projectId}
              className="px-4 py-2 rounded-lg text-xs font-mono font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 hover:brightness-110 shadow-glow-emerald flex items-center gap-2 disabled:opacity-40"
            >
              <Send className={`w-3.5 h-3.5 ${isPinging ? "animate-pulse" : ""}`} />
              <span>{isPinging ? "Submitting to Google..." : "Submit Sitemap"}</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
