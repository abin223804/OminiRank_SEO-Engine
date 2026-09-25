"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Sparkles,
  ShieldCheck,
  Code2,
  FileText,
  Table,
  Tags,
  Check,
  Copy,
  X,
  Loader2,
  Eye,
} from "lucide-react";
import { RankedQueryItem } from "./StrikingDistanceTable";
import { EnrichmentType } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

interface StageEnrichmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  targetQuery?: RankedQueryItem | null;
  onStagedSuccess?: () => void;
}

export function StageEnrichmentModal({
  isOpen,
  onClose,
  projectId,
  targetQuery,
  onStagedSuccess,
}: StageEnrichmentModalProps) {
  const [selectedType, setSelectedType] = useState<EnrichmentType>("FAQ");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!targetQuery) return null;

  const handleGenerate = async () => {
    if (!projectId) return;
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/enrichments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queryId: targetQuery.id,
          queryText: targetQuery.query,
          targetPageUrl: targetQuery.pageUrl,
          type: selectedType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Generation failed");
      }

      setGeneratedResult(data.enrichment);
      onStagedSuccess?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to generate enrichment");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-[#080d19] border border-cyan-500/30 rounded-2xl p-6 shadow-2xl z-50 max-h-[90vh] overflow-y-auto text-slate-100 font-sans">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-white flex items-center gap-2">
                  Autonomous E-E-A-T Content Generator
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
                    Phase 3 Active
                  </span>
                </Dialog.Title>
                <Dialog.Description className="text-xs text-slate-400 mt-0.5">
                  Target: <span className="text-cyan-300 font-mono font-semibold">"{targetQuery.query}"</span> (Rank {targetQuery.position.toFixed(1)})
                </Dialog.Description>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Type Selector Tabs */}
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-2">
                Select Enrichment Asset Type:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "FAQ", label: "FAQ Schema", icon: FileText, desc: "JSON-LD FAQPage" },
                  { id: "COMPARISON", label: "Comparison", icon: Table, desc: "Matrix Table" },
                  { id: "CODE_SNIPPET", label: "Code Snippet", icon: Code2, desc: "Production API" },
                  { id: "META_TAGS", label: "Meta Tags", icon: Tags, desc: "High-CTR SERP" },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedType(item.id as EnrichmentType);
                        setGeneratedResult(null);
                      }}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all flex flex-col justify-between",
                        isSelected
                          ? "bg-cyan-950/40 border-cyan-500/50 shadow-glow-cyan text-white"
                          : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <Icon className={cn("w-4 h-4", isSelected ? "text-cyan-400" : "text-slate-500")} />
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-none">{item.label}</div>
                        <div className="text-[10px] text-slate-500 mt-1">{item.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono">
                ✕ {errorMsg}
              </div>
            )}

            {/* Generate Trigger */}
            {!generatedResult && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full py-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 hover:brightness-110 shadow-glow-cyan flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Synthesizing E-E-A-T Content with Gemini &amp; Sanitizer...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-slate-950" />
                      <span>Generate &amp; Stage {selectedType} Asset</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Generated Result Preview */}
            {generatedResult && (
              <div className="mt-4 space-y-3 pt-3 border-t border-slate-800 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Staged &amp; XSS-Sanitized in PostgreSQL</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          JSON.stringify(generatedResult.payload, null, 2)
                        )
                      }
                      className="text-xs font-mono text-slate-400 hover:text-cyan-400 flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? "Copied" : "Copy Payload"}</span>
                    </button>
                  </div>
                </div>

                {/* Preview Box */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-[300px]">
                  {selectedType === "FAQ" && generatedResult.payload?.data?.faqs && (
                    <div className="space-y-3">
                      <div className="text-cyan-400 font-bold">Generated FAQ Entities:</div>
                      {generatedResult.payload.data.faqs.map((faq: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded bg-slate-900/60 border border-slate-800/80 space-y-1">
                          <div className="text-slate-200 font-semibold">Q: {faq.question}</div>
                          <div className="text-slate-400 text-[11px] leading-relaxed">
                            A: {faq.answerPlain}
                          </div>
                        </div>
                      ))}
                      <div className="pt-2">
                        <div className="text-slate-500 text-[11px] mb-1">Embedded JSON-LD Schema:</div>
                        <pre className="text-[10px] text-emerald-400/90 overflow-x-auto bg-slate-900/90 p-2 rounded">
                          {JSON.stringify(generatedResult.payload.data.jsonLdSchema, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {selectedType === "COMPARISON" && (
                    <div className="space-y-2">
                      <div className="text-cyan-400 font-bold">{generatedResult.payload?.data?.title}</div>
                      <pre className="text-[11px] text-slate-300 whitespace-pre-wrap">
                        {generatedResult.payload?.data?.markdownTable}
                      </pre>
                    </div>
                  )}

                  {selectedType === "CODE_SNIPPET" && (
                    <div className="space-y-2">
                      <div className="text-slate-400 text-[11px]">
                        File: <span className="text-cyan-400">{generatedResult.payload?.data?.fileName}</span>
                      </div>
                      <pre className="text-emerald-400 text-[11px]">
                        {generatedResult.payload?.data?.code}
                      </pre>
                    </div>
                  )}

                  {selectedType === "META_TAGS" && (
                    <div className="space-y-3 font-sans">
                      <div className="text-xs font-mono text-slate-400">SERP Appearance Preview:</div>
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-1">
                        <div className="text-blue-400 text-sm hover:underline cursor-pointer truncate">
                          {generatedResult.payload?.data?.titleTag}
                        </div>
                        <div className="text-emerald-400 text-xs font-mono">
                          {targetQuery.pageUrl}
                        </div>
                        <div className="text-slate-300 text-xs leading-relaxed">
                          {generatedResult.payload?.data?.metaDescription}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Staging Complete Actions */}
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-mono">
                    Status: <span className="text-cyan-400 font-semibold">STAGED</span> (Ready for Git/CMS deploy)
                  </span>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
