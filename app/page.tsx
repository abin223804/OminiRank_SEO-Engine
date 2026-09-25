"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import {
  WorkspaceSwitcher,
  WorkspaceItem,
} from "@/components/shell/WorkspaceSwitcher";
import { ProjectItem } from "@/components/shell/ProjectSwitcher";
import { CreateWorkspaceModal } from "@/components/shell/CreateWorkspaceModal";
import { CreateProjectModal } from "@/components/shell/CreateProjectModal";
import {
  StrikingDistanceTable,
  RankedQueryItem,
} from "@/components/dashboard/StrikingDistanceTable";
import { StageEnrichmentModal } from "@/components/dashboard/StageEnrichmentModal";
import { StagedActionsDrawer } from "@/components/dashboard/StagedActionsDrawer";
import { DeploymentAuditFeed } from "@/components/dashboard/DeploymentAuditFeed";
import {
  AnalyticsTrendChart,
  SnapshotItem,
} from "@/components/dashboard/AnalyticsTrendChart";
import { ExecutiveDigestModal } from "@/components/dashboard/ExecutiveDigestModal";
import { SitemapPingModal } from "@/components/dashboard/SitemapPingModal";
import {
  Crosshair,
  TrendingUp,
  MousePointerClick,
  Eye,
  Layers,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Mail,
  Send,
} from "lucide-react";

interface SnapshotData {
  id: string;
  totalImpressions: number;
  totalClicks: number;
  avgCtr: number;
  avgPosition: number;
  totalQueries: number;
  createdAt: string;
}

export default function DashboardPage() {
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceItem | null>(null);
  const [currentProject, setCurrentProject] = useState<ProjectItem | null>(null);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [queries, setQueries] = useState<RankedQueryItem[]>([]);
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [syncBanner, setSyncBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Phase 3 & 4: AI Staging & Deployment Audit State
  const [isEnrichmentModalOpen, setIsEnrichmentModalOpen] = useState(false);
  const [selectedQueryForEnrichment, setSelectedQueryForEnrichment] = useState<RankedQueryItem | null>(null);
  const [stagedRefreshCounter, setStagedRefreshCounter] = useState(0);
  const [auditRefreshCounter, setAuditRefreshCounter] = useState(0);

  // Phase 5: Executive Digest & Sitemap Modal State
  const [isDigestModalOpen, setIsDigestModalOpen] = useState(false);
  const [isSitemapModalOpen, setIsSitemapModalOpen] = useState(false);

  const loadProjectData = useCallback(async (projectId: string) => {
    setIsLoadingData(true);
    try {
      const [queriesRes, snapshotsRes] = await Promise.all([
        fetch(`/api/v1/projects/${projectId}/queries?strikingDistanceOnly=true&limit=100`),
        fetch(`/api/v1/projects/${projectId}/snapshots`),
      ]);

      if (queriesRes.ok) {
        const data = await queriesRes.json();
        setQueries(data.queries || []);
        setSnapshot(data.snapshot || null);
      }

      if (snapshotsRes.ok) {
        const snapData = await snapshotsRes.json();
        setSnapshots(snapData.snapshots || []);
      }
    } catch (err) {
      console.error("Failed to load project queries and snapshots:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (currentProject) {
      loadProjectData(currentProject.id);
    } else {
      setQueries([]);
      setSnapshot(null);
      setSnapshots([]);
    }
  }, [currentProject, loadProjectData]);

  const handleTriggerSync = async () => {
    if (!currentProject) return;
    setIsSyncing(true);
    setSyncBanner(null);

    try {
      const res = await fetch(`/api/v1/projects/${currentProject.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Sync request failed");
      }

      setSyncBanner({
        type: "success",
        text: `Search Console synchronized! Discovered ${data.data.strikingDistanceCount} striking-distance keywords ready for optimization.`,
      });

      await loadProjectData(currentProject.id);
      setAuditRefreshCounter((c) => c + 1);
    } catch (err) {
      setSyncBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Sync encountered an error",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#060a12]">
      {/* Sidebar */}
      <Sidebar planTier={currentWorkspace?.planTier || "STARTER"} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <Topbar
          currentWorkspace={currentWorkspace}
          currentProject={currentProject}
          onSelectWorkspace={(ws) => {
            setCurrentWorkspace(ws);
            setCurrentProject(null);
          }}
          onSelectProject={(proj) => setCurrentProject(proj)}
          onOpenCreateWorkspaceModal={() => setIsWorkspaceModalOpen(true)}
          onOpenCreateProjectModal={() => setIsProjectModalOpen(true)}
          onTriggerSync={handleTriggerSync}
          isSyncing={isSyncing}
        />

        {/* Scrollable Dashboard View */}
        <main className="flex-1 overflow-y-auto p-8 space-y-6 bg-radial-gradient">
          {/* Sync Notification Banner */}
          {syncBanner && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between text-xs font-mono transition-all ${
                syncBanner.type === "success"
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-950/40 border-rose-500/30 text-rose-300"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {syncBanner.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{syncBanner.text}</span>
              </div>
              <button
                onClick={() => setSyncBanner(null)}
                className="opacity-70 hover:opacity-100 text-xs px-2 py-0.5"
              >
                ✕
              </button>
            </div>
          )}

          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
                  {currentWorkspace?.name || "OmniRank Workspace"}
                </span>
                <span className="text-xs text-slate-400">/</span>
                <span className="text-xs font-mono text-slate-300">
                  {currentProject?.name || "No Active Domain"}
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                Autonomous Search Radar
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  GSC Ingestion Active
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Continuous ranking crawler tracking Page 2 & 3 striking-distance queries (positions 11.0–30.0).
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-2.5">
              {currentProject && (
                <>
                  <button
                    onClick={() => setIsDigestModalOpen(true)}
                    className="px-3 py-2 rounded-lg text-xs font-mono font-medium border border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/40 transition-colors flex items-center gap-1.5"
                    title="Send Weekly Executive Digest"
                  >
                    <Mail className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Digest</span>
                  </button>

                  <button
                    onClick={() => setIsSitemapModalOpen(true)}
                    className="px-3 py-2 rounded-lg text-xs font-mono font-medium border border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                    title="Submit Sitemap to Google Search Console"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sitemap</span>
                  </button>

                  <button
                    onClick={handleTriggerSync}
                    disabled={isSyncing}
                    className="px-3.5 py-2 rounded-lg text-xs font-mono font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 hover:brightness-110 shadow-glow-cyan flex items-center gap-2 disabled:opacity-40"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-slate-950 ${isSyncing ? "animate-spin" : ""}`}
                    />
                    <span>{isSyncing ? "Syncing..." : "Sync Radar"}</span>
                  </button>
                </>
              )}
              <button
                onClick={() => setIsProjectModalOpen(true)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700/80 transition-colors flex items-center gap-2"
              >
                <span>+ Add Domain</span>
              </button>
            </div>
          </div>

          {/* Metric Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tile 1: Striking Distance Queries */}
            <div className="p-5 rounded-xl border border-cyan-500/30 bg-gradient-to-b from-cyan-950/20 to-slate-900/40 relative overflow-hidden group shadow-glow-cyan">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-cyan-400 tracking-wider">
                  Striking Distance
                </span>
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Crosshair className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold font-mono text-white">
                  {currentProject ? queries.length : 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                  <span className="text-cyan-400 font-semibold">Pos 11.0 – 30.0</span> • High ROI Targets
                </div>
              </div>
            </div>

            {/* Tile 2: Total Impressions */}
            <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                  Total Impressions
                </span>
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <Eye className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold font-mono text-white">
                  {snapshot ? snapshot.totalImpressions.toLocaleString() : "0"}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">
                  {snapshot ? "Search Console snapshot" : "Awaiting first sync"}
                </div>
              </div>
            </div>

            {/* Tile 3: Total Organic Clicks */}
            <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                  Organic Clicks
                </span>
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <MousePointerClick className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold font-mono text-white">
                  {snapshot ? snapshot.totalClicks.toLocaleString() : "0"}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">
                  Avg CTR: {snapshot ? `${(snapshot.avgCtr * 100).toFixed(1)}%` : "0.0%"}
                </div>
              </div>
            </div>

            {/* Tile 4: Average Rank */}
            <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                  Avg Position
                </span>
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold font-mono text-white">
                  {snapshot ? snapshot.avgPosition.toFixed(1) : "--"}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">
                  {snapshot ? "Weighted by impressions" : "Awaiting Search Console Sync"}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content: Table or Empty State */}
          {!currentProject ? (
            <div className="rounded-xl border border-slate-800 bg-[#0a0f1d]/80 overflow-hidden py-16 px-6 text-center max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto shadow-glow-cyan">
                <Layers className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-100">
                  No Tracking Domain Selected
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  To view striking-distance search performance and trigger autonomous updates, select or register a domain.
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={() => setIsProjectModalOpen(true)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 hover:brightness-110 shadow-glow-cyan"
                >
                  + Add First Domain
                </button>
              </div>
            </div>
          ) : !snapshot && !isLoadingData ? (
            <div className="rounded-xl border border-slate-800 bg-[#0a0f1d]/80 overflow-hidden py-16 px-6 text-center max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto shadow-glow-cyan">
                <Crosshair className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-100">
                  Ready for Initial GSC Ingestion
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Property <span className="text-cyan-400 font-mono">{currentProject.gscPropertyId}</span> is connected.
                  Run your first sync to isolate striking-distance queries.
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={handleTriggerSync}
                  disabled={isSyncing}
                  className="px-4 py-2 rounded-lg text-xs font-mono font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 hover:brightness-110 shadow-glow-cyan flex items-center gap-2"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-slate-950 ${isSyncing ? "animate-spin" : ""}`}
                  />
                  <span>Run Initial GSC Sync</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Phase 5: Historical Performance Trend Visualization */}
              <AnalyticsTrendChart
                projectId={currentProject.id}
                snapshots={snapshots}
                isLoading={isLoadingData}
                onTriggerSync={handleTriggerSync}
                onOpenDigestModal={() => setIsDigestModalOpen(true)}
                onPingSitemap={() => setIsSitemapModalOpen(true)}
              />

              {/* Striking Distance Query Matrix */}
              <StrikingDistanceTable
                queries={queries}
                isLoading={isLoadingData}
                onStageEnrichment={(q) => {
                  setSelectedQueryForEnrichment(q);
                  setIsEnrichmentModalOpen(true);
                }}
              />

              {/* Staged E-E-A-T Actions Queue */}
              <StagedActionsDrawer
                projectId={currentProject.id}
                refreshTrigger={stagedRefreshCounter}
                onDeploySuccess={() => {
                  setAuditRefreshCounter((c) => c + 1);
                }}
              />

              {/* Phase 4: Immutable Deployment Audit Trail */}
              <DeploymentAuditFeed
                projectId={currentProject.id}
                refreshTrigger={auditRefreshCounter}
              />
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <CreateWorkspaceModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        onCreated={(ws) => setCurrentWorkspace(ws)}
      />

      <CreateProjectModal
        isOpen={isProjectModalOpen}
        workspaceId={currentWorkspace?.id}
        onClose={() => setIsProjectModalOpen(false)}
        onCreated={(proj) => setCurrentProject(proj)}
      />

      {/* Phase 3 AI Staging Modal */}
      <StageEnrichmentModal
        isOpen={isEnrichmentModalOpen}
        onClose={() => {
          setIsEnrichmentModalOpen(false);
          setSelectedQueryForEnrichment(null);
        }}
        projectId={currentProject?.id}
        targetQuery={selectedQueryForEnrichment}
        onStagedSuccess={() => {
          setStagedRefreshCounter((c) => c + 1);
        }}
      />

      {/* Phase 5 Executive Digest Modal */}
      <ExecutiveDigestModal
        isOpen={isDigestModalOpen}
        onClose={() => setIsDigestModalOpen(false)}
        projectId={currentProject?.id}
        projectName={currentProject?.name}
        onDigestSent={() => {
          setAuditRefreshCounter((c) => c + 1);
        }}
      />

      {/* Phase 5 Sitemap Ping Modal */}
      <SitemapPingModal
        isOpen={isSitemapModalOpen}
        onClose={() => setIsSitemapModalOpen(false)}
        projectId={currentProject?.id}
        siteUrl={currentProject?.siteUrl}
        gscPropertyId={currentProject?.gscPropertyId}
        onPingSuccess={() => {
          setAuditRefreshCounter((c) => c + 1);
        }}
      />
    </div>
  );
}
