"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Radar,
  Crosshair,
  Sparkles,
  GitPullRequest,
  ShieldCheck,
  Settings,
  Activity,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  workspaceSlug?: string;
  planTier?: string;
}

const navItems = [
  {
    title: "Striking Distance Radar",
    href: "/radar",
    icon: Crosshair,
    badge: "11–30",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  },
  {
    title: "Competitor Intelligence",
    href: "/competitors",
    icon: Radar,
  },
  {
    title: "AI Enrichments",
    href: "/enrichments",
    icon: Sparkles,
    badge: "E-E-A-T",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  },
  {
    title: "Git Deployments",
    href: "/deployments",
    icon: GitPullRequest,
  },
  {
    title: "Sandbox & Audit Logs",
    href: "/audit",
    icon: ShieldCheck,
  },
  {
    title: "Settings & Integrations",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar({ planTier = "STARTER" }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-[#070b12] flex flex-col shrink-0">
      {/* Brand Header */}
      <div className="h-16 border-b border-slate-800/80 px-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-glow-cyan text-slate-950 font-bold">
            <Activity className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold tracking-wider text-sm bg-gradient-to-r from-cyan-400 to-blue-300 bg-clip-text text-transparent font-mono">
              OMNIRANK
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
              Autonomous SEO
            </span>
          </div>
        </Link>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 font-semibold uppercase">
          {planTier}
        </span>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-4 px-3 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-widest text-slate-400">
          Intelligence Engine
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group",
                isActive
                  ? "bg-cyan-950/40 text-cyan-300 border border-cyan-500/30 shadow-glow-cyan"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={cn(
                    "w-4 h-4 transition-colors",
                    isActive
                      ? "text-cyan-400"
                      : "text-slate-400 group-hover:text-slate-300"
                  )}
                />
                <span>{item.title}</span>
              </div>
              {item.badge && (
                <span
                  className={cn(
                    "text-[10px] font-mono px-1.5 py-0.5 rounded border",
                    item.badgeColor || "border-slate-700 bg-slate-800 text-slate-400"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* System Status Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-[#05080f]/80">
        <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Engine Active
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">v1.0-alpha</span>
        </div>
      </div>
    </aside>
  );
}
