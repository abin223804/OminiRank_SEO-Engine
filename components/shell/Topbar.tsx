"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Radio, Users, LogOut, LogIn, ChevronDown } from "lucide-react";
import { WorkspaceSwitcher, WorkspaceItem } from "./WorkspaceSwitcher";
import { ProjectSwitcher, ProjectItem } from "./ProjectSwitcher";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface TopbarProps {
  workspaces?: WorkspaceItem[];
  currentWorkspace?: WorkspaceItem | null;
  currentProject?: ProjectItem | null;
  onSelectWorkspace: (ws: WorkspaceItem) => void;
  onSelectProject: (proj: ProjectItem) => void;
  onOpenCreateWorkspaceModal: () => void;
  onOpenCreateProjectModal: () => void;
  onOpenMembersModal?: () => void;
  onTriggerSync?: () => void;
  isSyncing?: boolean;
}

export function Topbar({
  workspaces,
  currentWorkspace,
  currentProject,
  onSelectWorkspace,
  onSelectProject,
  onOpenCreateWorkspaceModal,
  onOpenCreateProjectModal,
  onOpenMembersModal,
  onTriggerSync,
  isSyncing = false,
}: TopbarProps) {
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const isGscConnected = Boolean(currentProject?.gscPropertyId);
  const supabase = createClient();

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/login");
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#070b12]/90 backdrop-blur-md px-6 flex items-center justify-between z-30 shrink-0">
      {/* Switchers */}
      <div className="flex items-center gap-3">
        <WorkspaceSwitcher
          workspaces={workspaces}
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

        {/* Team & Members Button */}
        {currentWorkspace && onOpenMembersModal && (
          <button
            onClick={onOpenMembersModal}
            className="ml-2 px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors"
            title="Manage Workspace Members & Invitations"
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>Team</span>
          </button>
        )}
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

        {/* User Dropdown Capsule */}
        <div className="relative pl-3 border-l border-slate-800">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-800/80 transition-colors focus:outline-none"
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-mono text-xs font-bold">
              OR
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-800 bg-[#0a0f1d] shadow-2xl py-1 z-50 text-xs font-mono divide-y divide-slate-800">
              <div className="px-3 py-2 text-slate-400 text-[11px]">
                Signed in as Enterprise Architect
              </div>
              <div className="py-1">
                {currentWorkspace && onOpenMembersModal && (
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenMembersModal();
                    }}
                    className="w-full px-3 py-2 text-left text-slate-300 hover:text-white hover:bg-slate-800/60 flex items-center gap-2"
                  >
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Manage Team</span>
                  </button>
                )}
                <button
                  onClick={handleSignOut}
                  className="w-full px-3 py-2 text-left text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
