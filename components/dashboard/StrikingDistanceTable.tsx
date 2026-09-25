"use client";

import React, { useState } from "react";
import {
  Crosshair,
  Search,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface RankedQueryItem {
  id: string;
  query: string;
  pageUrl: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  isStrikingDistance: boolean;
  positionDelta: number | null;
}

interface StrikingDistanceTableProps {
  queries: RankedQueryItem[];
  isLoading: boolean;
  onStageEnrichment?: (query: RankedQueryItem) => void;
}

export function StrikingDistanceTable({
  queries,
  isLoading,
  onStageEnrichment,
}: StrikingDistanceTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTier, setFilterTier] = useState<"ALL" | "PAGE_2_NEAR" | "HIGH_VOLUME">("ALL");

  const filteredQueries = queries.filter((q) => {
    const matchesSearch =
      q.query.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.pageUrl.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterTier === "PAGE_2_NEAR") {
      return q.position >= 11.0 && q.position <= 15.0;
    }
    if (filterTier === "HIGH_VOLUME") {
      return q.impressions >= 500;
    }
    return true;
  });

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1d]/80 overflow-hidden shadow-2xl">
      {/* Table Header Bar */}
      <div className="p-5 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Crosshair className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Striking Distance Opportunities
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-cyan-400">
                {filteredQueries.length} Targets
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Ranked positions 11.0–30.0 with immediate potential to surge to Page 1 via autonomous E-E-A-T updates.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Filter Buttons */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-xs font-mono">
            <button
              onClick={() => setFilterTier("ALL")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors",
                filterTier === "ALL"
                  ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              All (11-30)
            </button>
            <button
              onClick={() => setFilterTier("PAGE_2_NEAR")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors",
                filterTier === "PAGE_2_NEAR"
                  ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              Near Page 1 (11-15)
            </button>
            <button
              onClick={() => setFilterTier("HIGH_VOLUME")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors",
                filterTier === "HIGH_VOLUME"
                  ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              High Vol (≥500)
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search keyword or URL..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-slate-900/90 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800/80 bg-slate-950/60 text-[11px] font-mono uppercase tracking-wider text-slate-400">
              <th className="py-3 px-4">Search Query</th>
              <th className="py-3 px-4">Target Landing Page</th>
              <th className="py-3 px-4 text-right">Impressions</th>
              <th className="py-3 px-4 text-right">Clicks</th>
              <th className="py-3 px-4 text-right">CTR</th>
              <th className="py-3 px-4 text-right">Current Position</th>
              <th className="py-3 px-4 text-right">Rank Delta</th>
              <th className="py-3 px-4 text-center">Autonomous Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 text-xs font-mono">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs">Analyzing Google Search Console snapshot...</span>
                  </div>
                </td>
              </tr>
            ) : filteredQueries.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Crosshair className="w-6 h-6 text-slate-600" />
                    <span>No striking-distance queries found matching your filters.</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredQueries.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-cyan-950/10 transition-colors group"
                >
                  {/* Query */}
                  <td className="py-3.5 px-4 font-semibold text-slate-100 max-w-[280px] truncate">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 group-hover:scale-125 transition-transform shrink-0" />
                      <span className="truncate" title={item.query}>
                        {item.query}
                      </span>
                    </div>
                  </td>

                  {/* Landing Page */}
                  <td className="py-3.5 px-4 text-slate-400 max-w-[220px] truncate text-[11px]">
                    <a
                      href={item.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-cyan-400 transition-colors flex items-center gap-1.5 truncate"
                      title={item.pageUrl}
                    >
                      <span className="truncate">{item.pageUrl.replace(/^https?:\/\/[^/]+/, "") || "/"}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60 shrink-0" />
                    </a>
                  </td>

                  {/* Impressions */}
                  <td className="py-3.5 px-4 text-right text-slate-200">
                    {item.impressions.toLocaleString()}
                  </td>

                  {/* Clicks */}
                  <td className="py-3.5 px-4 text-right text-slate-200">
                    {item.clicks.toLocaleString()}
                  </td>

                  {/* CTR */}
                  <td className="py-3.5 px-4 text-right text-slate-300">
                    {(item.ctr * 100).toFixed(1)}%
                  </td>

                  {/* Position */}
                  <td className="py-3.5 px-4 text-right">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded font-bold",
                        item.position <= 15
                          ? "bg-emerald-950/70 border border-emerald-500/30 text-emerald-400"
                          : "bg-cyan-950/70 border border-cyan-500/30 text-cyan-400"
                      )}
                    >
                      {item.position.toFixed(1)}
                    </span>
                  </td>

                  {/* Rank Delta */}
                  <td className="py-3.5 px-4 text-right">
                    {item.positionDelta === null ? (
                      <span className="text-slate-600 flex items-center justify-end gap-1">
                        <Minus className="w-3 h-3" />
                        <span>New</span>
                      </span>
                    ) : item.positionDelta > 0 ? (
                      <span className="text-emerald-400 flex items-center justify-end gap-0.5 font-bold">
                        <ArrowUp className="w-3 h-3" />
                        <span>+{item.positionDelta.toFixed(1)}</span>
                      </span>
                    ) : item.positionDelta < 0 ? (
                      <span className="text-rose-400 flex items-center justify-end gap-0.5 font-bold">
                        <ArrowDown className="w-3 h-3" />
                        <span>{item.positionDelta.toFixed(1)}</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 flex items-center justify-end gap-1">
                        <Minus className="w-3 h-3" />
                        <span>0.0</span>
                      </span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => onStageEnrichment?.(item)}
                      title="Generate schema & E-E-A-T enrichment (Phase 3)"
                      className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 transition-colors inline-flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>Stage AI</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
