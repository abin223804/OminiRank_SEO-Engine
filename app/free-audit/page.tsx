"use client";

import { useState, useEffect, useCallback } from "react";
import type { AuditResult, OpportunityGroup, OpportunityRow, OpportunityType } from "@/app/api/v1/free-audit/run/route";

/* ─── Colour maps ────────────────────────────────────────────────────────────── */
const COLOR_MAP: Record<string, { badge: string; pill: string; glow: string; dot: string }> = {
  cyan: {
    badge: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
    pill:  "bg-cyan-500/10 border-cyan-500/25 text-cyan-400",
    glow:  "shadow-glow-cyan",
    dot:   "bg-cyan-400",
  },
  violet: {
    badge: "bg-violet-500/10 border-violet-500/30 text-violet-300",
    pill:  "bg-violet-500/10 border-violet-500/25 text-violet-400",
    glow:  "shadow-glow-violet",
    dot:   "bg-violet-400",
  },
  amber: {
    badge: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    pill:  "bg-amber-500/10 border-amber-500/25 text-amber-400",
    glow:  "shadow-[0_0_20px_-3px_rgba(245,158,11,0.25)]",
    dot:   "bg-amber-400",
  },
  emerald: {
    badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    pill:  "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
    glow:  "shadow-glow-emerald",
    dot:   "bg-emerald-400",
  },
  rose: {
    badge: "bg-rose-500/10 border-rose-500/30 text-rose-300",
    pill:  "bg-rose-500/10 border-rose-500/25 text-rose-400",
    glow:  "shadow-[0_0_20px_-3px_rgba(244,63,94,0.25)]",
    dot:   "bg-rose-400",
  },
};

const PRIORITY_MAP = {
  HIGH:   "bg-rose-500/20 text-rose-300 border border-rose-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-300 border border-amber-500/25",
  LOW:    "bg-slate-500/15 text-slate-400 border border-slate-500/20",
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
function fmtNum(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1) + "k" : n.toString();
}
function fmtCtr(ctr: number): string {
  return (ctr * 100).toFixed(1) + "%";
}
function fmtPos(p: number): string {
  return p.toFixed(1);
}
function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const p = u.pathname === "/" ? "" : u.pathname;
    return u.hostname.replace(/^www\./, "") + p;
  } catch {
    return url;
  }
}

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type Step = "idle" | "connecting" | "scanning" | "results" | "error";

/* ─── Opportunity Row Card ───────────────────────────────────────────────────── */
function RowCard({ row, color, rank }: { row: OpportunityRow; color: string; rank: number }) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.cyan;
  return (
    <div className="px-5 py-4 hover:bg-white/[0.02] transition-colors border-b border-cyber-border last:border-0">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-5 h-5 mt-0.5 rounded-full bg-cyber-surface border border-cyber-border text-[10px] text-slate-500 flex items-center justify-center font-mono">
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-medium text-slate-100 text-sm leading-snug">{row.query}</p>
            {row.priority !== "LOW" && (
              <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PRIORITY_MAP[row.priority]}`}>
                {row.priority}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mb-2 truncate">{shortUrl(row.pageUrl)}</p>

          {/* Metric pills */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${c.pill}`}>
              Pos {fmtPos(row.position)}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/60 border border-cyber-border text-[11px] text-slate-400">
              {fmtNum(row.impressions)} impr
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/60 border border-cyber-border text-[11px] text-slate-400">
              CTR {fmtCtr(row.ctr)}
            </span>
            {row.trafficUpside > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-medium">
                +{fmtNum(row.trafficUpside)} clicks/mo
              </span>
            )}
          </div>

          {/* Action label */}
          <p className="text-[11px] text-slate-400 leading-snug italic">
            → {row.actionLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Opportunity Group Panel ────────────────────────────────────────────────── */
function GroupPanel({ group, defaultOpen }: { group: OpportunityGroup; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const c = COLOR_MAP[group.color] ?? COLOR_MAP.cyan;
  const totalUpside = group.rows.reduce((s, r) => s + r.trafficUpside, 0);
  const highCount = group.rows.filter((r) => r.priority === "HIGH").length;

  return (
    <div className={`glass-panel rounded-2xl border overflow-hidden transition-all ${open ? `border-${group.color}-500/25` : "border-cyber-border"}`}>
      {/* Header — always visible */}
      <button
        id={`group-toggle-${group.type}`}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl leading-none select-none">{group.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-100 text-sm">{group.label}</span>
              {/* Count badge */}
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${c.badge}`}>
                {group.rows.length} {group.rows.length === 1 ? "query" : "queries"}
              </span>
              {highCount > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/25">
                  {highCount} HIGH
                </span>
              )}
            </div>
            <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{group.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          {totalUpside > 0 && (
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-emerald-400 font-bold text-sm">+{fmtNum(totalUpside)}</span>
              <span className="text-slate-500 text-[10px]">clicks/mo upside</span>
            </div>
          )}
          <svg
            className={`w-4 h-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded rows */}
      {open && (
        <div className="border-t border-cyber-border">
          {group.rows.map((row, i) => (
            <RowCard key={row.query} row={row} color={group.color} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Page Component ─────────────────────────────────────────────────────────── */
export default function FreeAuditPage() {
  const [step, setStep] = useState<Step>("idle");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  /* ── Handle OAuth callback ── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("gsc_token");
    const site = params.get("site");
    if (token && site) {
      window.history.replaceState({}, "", "/free-audit");
      setUrl(decodeURIComponent(site));
      runAudit(token, decodeURIComponent(site));
    }
  }, []);

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim().toLowerCase();
    if (!trimmed || (!trimmed.startsWith("http") && !trimmed.includes("."))) {
      setError("Please enter a valid website URL — e.g. https://yoursite.com");
      return;
    }
    setError("");
    setStep("connecting");
  }

  function handleGoogleConnect() {
    const encodedSite = encodeURIComponent(url.trim());
    window.location.href = `/api/v1/free-audit/oauth-start?site=${encodedSite}`;
  }

  const runAudit = useCallback(async (token: string, siteUrl: string) => {
    setStep("scanning");
    try {
      const res = await fetch("/api/v1/free-audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, siteUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Audit failed. Please try again.");
      }
      const data: AuditResult = await res.json();
      setResult(data);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStep("error");
    }
  }, []);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    await fetch("/api/v1/free-audit/capture-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, siteUrl: result?.siteUrl }),
    });
    setEmailSubmitted(true);
  }

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* ── Derived summary stats from groups ── */
  const summaryGroups = result?.groups ?? [];
  const highPriorityCount = summaryGroups.reduce(
    (s, g) => s + g.rows.filter((r) => r.priority === "HIGH").length,
    0
  );

  /* ─── Render ───────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#050810] bg-cyber-grid text-slate-100 flex flex-col">

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-[600px] h-[600px] bg-violet-500/4 rounded-full blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <a href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-glow-cyan">
            <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-slate-100 tracking-tight">OmniRank</span>
        </a>
        <a href="/login" className="text-sm text-slate-400 hover:text-cyan-400 transition-colors">Sign in →</a>
      </nav>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-start px-4 pt-14 pb-20">

        {/* ── IDLE ── */}
        {step === "idle" && (
          <div className="w-full max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-6 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
              Free · No account required · Results in 30 seconds
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-4 leading-[1.1]">
              Find your hidden{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
                SEO opportunities
              </span>{" "}
              in 30 seconds
            </h1>
            <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
              Connect your Google Search Console and get a{" "}
              <strong className="text-slate-200">full breakdown of every SEO opportunity</strong> your site
              has right now — grouped by type, prioritised by impact.
            </p>
            <form onSubmit={handleUrlSubmit} className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🌐</span>
                <input
                  id="site-url-input"
                  type="text"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setError(""); }}
                  placeholder="https://yourwebsite.com"
                  className="w-full pl-9 pr-4 py-3.5 rounded-xl bg-cyber-surface border border-cyber-border text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500/60 focus:shadow-glow-cyan transition-all"
                  autoFocus
                />
              </div>
              <button
                id="start-audit-btn"
                type="submit"
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black font-bold text-sm transition-all shadow-glow-cyan active:scale-95 whitespace-nowrap"
              >
                Audit My Site →
              </button>
            </form>
            {error && <p className="mt-3 text-rose-400 text-sm">{error}</p>}

            {/* What the audit detects */}
            <div className="mt-12 text-left max-w-xl mx-auto space-y-3">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-4 text-center">
                What the audit detects
              </p>
              {[
                { icon: "🎯", label: "Quick Wins", desc: "Pos 5–15 with high impressions — small fix = page 1" },
                { icon: "🔗", label: "Page Clusters", desc: "One page, multiple striking queries — fix once, win many" },
                { icon: "📉", label: "CTR Leaks", desc: "Page 1 rankings getting far fewer clicks than they should" },
                { icon: "📈", label: "Rising Stars", desc: "Pos 16–30 — content upgrade can climb pages in weeks" },
                { icon: "⚡", label: "High-Volume Untapped", desc: "Thousands of impressions, almost no clicks yet" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 glass-panel rounded-xl px-4 py-3 border border-cyber-border">
                  <span className="text-lg select-none">{item.icon}</span>
                  <div>
                    <span className="text-slate-200 text-sm font-semibold">{item.label}</span>
                    <span className="text-slate-500 text-xs ml-2">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CONNECTING ── */}
        {step === "connecting" && (
          <div className="w-full max-w-md text-center">
            <div className="glass-panel rounded-2xl p-8 border border-cyber-border">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 flex items-center justify-center">
                <svg className="w-7 h-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 6.627 5.373 12 12 12 6.627 0 12-5.373 12-12s-5.373-12-12-12c-.413 0-.82.025-1.22.07" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Connect Google Search Console</h2>
              <p className="text-slate-400 text-sm mb-2 leading-relaxed">
                We need <strong className="text-slate-300">read-only access</strong> to run the opportunity audit on:
              </p>
              <div className="bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-cyan-400 text-sm font-mono mb-6 truncate">
                {url}
              </div>
              <ul className="text-left space-y-2 mb-6">
                {["Read-only — we cannot modify your site", "No account created yet", "Token expires after your session"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-slate-400 text-xs">
                    <svg className="w-4 h-4 text-cyber-emerald flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <button
                id="connect-gsc-btn"
                onClick={handleGoogleConnect}
                className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-black font-semibold text-sm transition-all shadow-lg active:scale-95"
              >
                <svg className="w-5 h-5" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                </svg>
                Connect with Google
              </button>
              <button onClick={() => setStep("idle")} className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                ← Change URL
              </button>
            </div>
          </div>
        )}

        {/* ── SCANNING ── */}
        {step === "scanning" && (
          <div className="w-full max-w-md text-center">
            <div className="glass-panel rounded-2xl p-10 border border-cyber-border">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-cyan-500/30 animate-ping [animation-delay:300ms]" />
                <div className="absolute inset-4 rounded-full border-2 border-cyan-500/40 animate-ping [animation-delay:600ms]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-8 h-8 text-cyan-400 animate-spin [animation-duration:3s]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Scanning your GSC data…</h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Analysing queries across 5 opportunity types. Usually 10–20 seconds.
              </p>
              <div className="space-y-2">
                {[
                  "Pulling 90 days of Search Analytics…",
                  "Detecting Quick Wins, CTR Leaks & Page Clusters…",
                  "Estimating traffic upside for each opportunity…",
                ].map((msg, i) => (
                  <div key={msg} className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" style={{ animationDelay: `${i * 400}ms` }} />
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {step === "error" && (
          <div className="w-full max-w-md text-center">
            <div className="glass-panel rounded-2xl p-8 border border-rose-500/30">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Audit failed</h2>
              <p className="text-slate-400 text-sm mb-5">{error}</p>
              <button id="retry-btn" onClick={() => { setStep("idle"); setError(""); }}
                className="px-5 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 text-sm font-medium transition-all">
                Try again
              </button>
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {step === "results" && result && (
          <div className="w-full max-w-3xl">

            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Audit complete · {result.scannedAt}
              </div>

              <h2 className="text-3xl font-extrabold text-white mb-2">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
                  {result.totalOpportunities} SEO opportunities
                </span>{" "}
                identified
              </h2>
              <p className="text-slate-400 text-base">
                on <span className="text-cyan-400 font-medium">{result.siteUrl}</span>{" "}
                across <span className="text-slate-200 font-medium">{result.groups.length} opportunity types</span>
              </p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { label: "Total Opportunities", value: result.totalOpportunities.toString(), sub: "across all types", color: "text-cyan-400", icon: "🔍" },
                { label: "High Priority", value: highPriorityCount.toString(), sub: "need immediate action", color: "text-rose-400", icon: "🚨" },
                { label: "Opportunity Types", value: result.groups.length.toString(), sub: "different issues found", color: "text-violet-400", icon: "📊" },
                { label: "Potential Extra Clicks", value: `+${fmtNum(result.totalUpsideClicks)}/mo`, sub: "if top fixes applied", color: "text-emerald-400", icon: "📈" },
              ].map((card) => (
                <div key={card.label} className="glass-panel rounded-xl p-4 border border-cyber-border text-center">
                  <div className="text-xl mb-1">{card.icon}</div>
                  <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
                  <div className="text-slate-500 text-[10px] mt-0.5 leading-snug">{card.label}</div>
                </div>
              ))}
            </div>

            {/* Opportunity groups — expandable */}
            <div className="space-y-3 mb-8">
              {result.groups.map((group, i) => (
                <GroupPanel key={group.type} group={group} defaultOpen={i === 0} />
              ))}
            </div>

            {/* CTA */}
            <div className="relative rounded-2xl overflow-hidden border border-cyan-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-violet-500/5" />
              <div className="relative p-7 sm:p-9">
                <div className="max-w-xl mx-auto text-center">
                  {!emailSubmitted ? (
                    <>
                      <h3 className="text-2xl font-bold text-white mb-2">
                        Fix your top {Math.min(3, highPriorityCount)} priorities in one click
                      </h3>
                      <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                        OmniRank generates the exact schema markup, rewritten titles, and FAQ sections for each opportunity —
                        grounded in your real GSC data — then <strong className="text-slate-200">pushes them to WordPress or GitHub in one click.</strong>
                      </p>
                      <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-4">
                        <input
                          id="email-capture-input"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your@email.com"
                          required
                          className="flex-1 px-4 py-3 rounded-xl bg-cyber-surface border border-cyber-border text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:shadow-glow-cyan transition-all"
                        />
                        <button
                          id="get-access-btn"
                          type="submit"
                          className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black font-bold text-sm transition-all shadow-glow-cyan whitespace-nowrap active:scale-95"
                        >
                          Get Early Access →
                        </button>
                      </form>
                      <div className="flex items-center justify-center gap-4">
                        <a id="start-trial-btn" href="/login?plan=professional"
                          className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors">
                          Start free trial — no credit card
                        </a>
                        <span className="text-slate-600 text-xs">·</span>
                        <button id="copy-results-btn" onClick={handleCopy}
                          className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                          {copied ? "✓ Copied" : "Share results"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="py-4">
                      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                        <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">You're on the list! 🎉</h3>
                      <p className="text-slate-400 text-sm mb-5">Access link on its way to <strong className="text-slate-200">{email}</strong></p>
                      <a href="/login?plan=professional"
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-black font-bold text-sm shadow-glow-cyan hover:from-cyan-400 hover:to-cyan-500 transition-all">
                        Start free trial now →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="relative z-10 border-t border-white/5 px-6 py-4 text-center text-xs text-slate-600">
        OmniRank by Tekora ·{" "}
        <a href="/privacy" className="hover:text-slate-400 transition-colors">Privacy</a> ·{" "}
        <a href="/login" className="hover:text-slate-400 transition-colors">Sign in</a>
      </footer>
    </div>
  );
}
