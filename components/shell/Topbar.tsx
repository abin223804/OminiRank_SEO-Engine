"use client";

import { RefreshCw, Radio, Shield, User } from "lucide-react";
import { WorkspaceSwitcher, WorkspaceItem } from "./WorkspaceSwitcher";
import { ProjectSwitcher, ProjectItem } from "./ProjectSwitcher";
import { cn } from "@/lib/utils";

interface TopbarProps {
  currentWorkspace?: WorkspaceItem | null;
  currentProject?: ProjectItem | null;
  onSelectWorkspace: (ws: WorkspaceItem) => void;
  onSelectProject: (proj: ProjectItem) => void;
  onOpenCreateWorkspaceModal: () => void;
  onOpenCreateProjectModal: () => void;
  onTriggerSync?: () => void;
  isSyncing?: boolean;
}

export function Topbar({
  currentWorkspace,
  currentProject,
  onSelectWorkspace,
  onSelectProject,
  onOpenCreateWorkspaceModal,
  onOpenCreateProjectModal,
  onTriggerSync,
  isSyncing = false,
}: TopbarProps) {
  const isGscConnected = Boolean(currentProject?.gscPropertyId);

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#070b12]/90 backdrop-blur-md px-6 flex items-center justify-between z-30 shrink-0">
      {/* Switchers */}
      <div className="flex items-center gap-3">
        <WorkspaceSwitcher
          currentWorkspaceId={currentWorkspace?.id}
          onSelectWorkspace={onSelectWorkspace}
          onOpenCreateModal={onOpenCreateWorkspaceModal}
        />
        <span className="text-slate-700">/</span>
        <ProjectSwitcher
          workspaceId={currentWorkspace?.id}
          currentProjectId={currentProject?.id}
          onSelectProject={onSelectProject}
          onOpenCreateProjectModal={onOpenCreateProjectModal}
        />
      </div>

      {/* Right status & actions */}
      <div className="flex items-center gap-4">
        {/* GSC Status Capsule */}
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border",
            isGscConnected
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
          )}
        >
          <Radio
            className={cn(
              "w-3 h-3",
              isGscConnected ? "text-emerald-400 animate-pulse" : "text-amber-400"
            )}
          />
          <span>
            {isGscConnected
              ? `GSC: ${currentProject?.gscPropertyId || "Linked"}`
              : "GSC: Disconnected"}
          </span>
        </div>

        {/* Sync Radar Button */}
        <button
          onClick={onTriggerSync}
          disabled={!currentProject || isSyncing}
          className={cn(
            "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono uppercase tracking-wider transition-all",
            "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 hover:brightness-110 shadow-glow-cyan",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          )}
        >
          <RefreshCw
            className={cn("w-3.5 h-3.5 text-slate-950", isSyncing && "animate-spin")}
          />
          <span>{isSyncing ? "Syncing..." : "Sync Radar"}</span>
        </button>

        {/* User Capsule */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <User className="w-4 h-4" />
          </div>
        </div>
      </div>
    </header>
  );
}
