"use client";

import { useState, useEffect } from "react";
import { Building2, ChevronDown, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  planTier: string;
  role: string;
}

interface WorkspaceSwitcherProps {
  currentWorkspaceId?: string;
  onSelectWorkspace?: (ws: WorkspaceItem) => void;
  onOpenCreateModal?: () => void;
}

export function WorkspaceSwitcher({
  currentWorkspaceId,
  onSelectWorkspace,
  onOpenCreateModal,
}: WorkspaceSwitcherProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWorkspaces() {
      try {
        const res = await fetch("/api/v1/workspaces");
        if (res.ok) {
          const data = await res.json();
          setWorkspaces(data.workspaces || []);
          if (data.workspaces?.length > 0 && !currentWorkspaceId && onSelectWorkspace) {
            onSelectWorkspace(data.workspaces[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load workspaces:", err);
      } finally {
        setLoading(false);
      }
    }
    loadWorkspaces();
  }, [currentWorkspaceId, onSelectWorkspace]);

  const activeWorkspace =
    workspaces.find((w) => w.id === currentWorkspaceId) || workspaces[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800/80 transition-colors text-xs font-medium text-slate-200"
      >
        <Building2 className="w-3.5 h-3.5 text-cyan-400" />
        <span className="font-semibold truncate max-w-[130px]">
          {loading ? "Loading..." : activeWorkspace?.name || "Select Workspace"}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 mt-1.5 w-60 rounded-xl border border-slate-800 bg-[#0b101b] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-400">
              Workspaces
            </div>
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {workspaces.map((ws) => {
                const isSelected = ws.id === activeWorkspace?.id;
                return (
                  <button
                    key={ws.id}
                    onClick={() => {
                      onSelectWorkspace?.(ws);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors text-left",
                      isSelected
                        ? "bg-cyan-500/10 text-cyan-300 font-semibold"
                        : "text-slate-300 hover:bg-slate-800/70"
                    )}
                  >
                    <div className="flex flex-col truncate">
                      <span className="truncate">{ws.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {ws.slug} • {ws.planTier}
                      </span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-1.5 mt-1 border-t border-slate-800/80">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenCreateModal?.();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-cyan-400 hover:bg-cyan-500/10 transition-colors font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Workspace</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
