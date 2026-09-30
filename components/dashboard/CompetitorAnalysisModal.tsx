"use client";

import { useState, useEffect, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Radar,
  Sparkles,
  ExternalLink,
  Plus,
  Loader2,
  X,
  FileText,
  Tag,
  Hash,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Globe,
} from "lucide-react";

interface CompetitorItem {
  id: string;
  domain: string;
  scrapeUrl: string;
  lastScrapedAt: string | null;
  extractedKeywords?: string[];
  contentTopics?: string[];
}

interface CompetitorAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  projectName?: string;
}

export function CompetitorAnalysisModal({
  isOpen,
  onClose,
  projectId,
  projectName,
}: CompetitorAnalysisModalProps) {
  const [competitors, setCompetitors] = useState<CompetitorItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const loadCompetitors = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/competitors`);
      if (res.ok) {
        const data = await res.json();
        setCompetitors(data.competitors || []);
      }
    } catch (err) {
      console.error("Failed to load competitors:", err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen && projectId) {
      loadCompetitors();
      setFeedback(null);
      setScrapeUrl("");
      setTargetKeyword("");
    }
  }, [isOpen, projectId, loadCompetitors]);

  const handleScrapeCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !scrapeUrl) return;

    setIsScraping(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scrapeUrl,
          targetKeyword: targetKeyword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reverse engineer competitor");
      }

      setFeedback({
        type: "success",
        message: `Successfully analyzed ${data.competitor.domain}! Extracted ${data.competitor.contentTopics?.length || 0} headings and ${data.competitor.extractedKeywords?.length || 0} semantic keywords.`,
      });
      setScrapeUrl("");
      setTargetKeyword("");
      await loadCompetitors();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to analyze competitor",
      });
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 transition-opacity" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-800 bg-[#070b13] p-6 shadow-2xl z-50 focus:outline-none">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-glow-purple">
                <Radar className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-white flex items-center gap-2">
                  <span>Competitor Intelligence & Grounding</span>
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-purple-950/60 border border-purple-500/30 text-purple-400">
                    {projectName || "Current Domain"}
                  </span>
                </Dialog.Title>
                <Dialog.Description className="text-xs text-slate-400 mt-0.5">
                  Reverse-engineer top-ranking SERP competitors to ground autonomous Gemini 2.5 content optimizations.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/80 transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`mt-4 p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
                feedback.type === "success"
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-950/40 border-rose-500/30 text-rose-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}

          {/* Add Competitor Form */}
          <form
            onSubmit={handleScrapeCompetitor}
            className="mt-5 p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-200">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Analyze Top-Ranking Competitor Page</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-7 relative">
                <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="url"
                  required
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  placeholder="https://competitor.com/blog/best-practices"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="sm:col-span-3">
                <input
                  type="text"
                  value={targetKeyword}
                  onChange={(e) => setTargetKeyword(e.target.value)}
                  placeholder="Target Keyword (optional)"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500 transition-colors font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isScraping || !scrapeUrl}
                className="sm:col-span-2 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 hover:brightness-110 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 shrink-0 shadow-sm"
              >
                {isScraping ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Analyze</span>
              </button>
            </div>
          </form>

          {/* Competitor Fleet Breakdown */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase tracking-wider">
              <span>Competitor Fleet ({competitors.length})</span>
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />}
            </div>

            {competitors.length === 0 && !isLoading ? (
              <div className="p-8 rounded-xl border border-slate-800 bg-[#060a12]/60 text-center space-y-2">
                <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="text-xs font-semibold text-slate-300">
                  No Competitors Analyzed Yet
                </div>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Add competitor URLs ranking on Page 1 for your striking-distance keywords. Their heading structures and keyword density will ground Gemini 2.5 generations.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {competitors.map((comp) => {
                  const topics = (comp.contentTopics || []) as string[];
                  const keywords = (comp.extractedKeywords || []) as string[];

                  return (
                    <div
                      key={comp.id}
                      className="p-4 rounded-xl border border-slate-800 bg-[#060a12]/80 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-purple-400" />
                          <span className="text-xs font-bold text-white font-mono">
                            {comp.domain}
                          </span>
                        </div>
                        <a
                          href={comp.scrapeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-mono text-cyan-400 hover:underline flex items-center gap-1"
                        >
                          <span className="truncate max-w-xs">{comp.scrapeUrl}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>

                      {/* Extracted Headings / Topics */}
                      {topics.length > 0 && (
                        <div>
                          <div className="text-[10px] font-mono uppercase text-slate-400 mb-1.5 flex items-center gap-1">
                            <Hash className="w-3 h-3 text-purple-400" />
                            <span>Competitor Content Structure ({topics.length} headings)</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {topics.slice(0, 6).map((topic, i) => (
                              <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Extracted Keywords */}
                      {keywords.length > 0 && (
                        <div>
                          <div className="text-[10px] font-mono uppercase text-slate-400 mb-1.5 flex items-center gap-1">
                            <Tag className="w-3 h-3 text-cyan-400" />
                            <span>Top Extracted Keywords</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {keywords.slice(0, 10).map((kw, i) => (
                              <span
                                key={i}
                                className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-300"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Grounding Active: All AI enrichments incorporate these signals</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
