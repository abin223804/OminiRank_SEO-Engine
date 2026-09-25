"use client";

import { useState, useEffect } from "react";
import { Globe, ChevronDown, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProjectItem {
  id: string;
  name: string;
  siteUrl: string;
  gscPropertyId: string;
  deploymentMode: string;
  _count?: {
    snapshots: number;
    queries: number;
  };
}

interface ProjectSwitcherProps {
  workspaceId?: string;
  currentProjectId?: string;
  onSelectProject?: (p: ProjectItem) => void;
  onOpenCreateProjectModal?: () => void;
}

export function ProjectSwitcher({
  workspaceId,
  currentProjectId,
  onSelectProject,
  onOpenCreateProjectModal,
}: ProjectSwitcherProps) {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) {
      setProjects([]);
      return;
    }

    async function loadProjects() {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/projects?workspaceId=${workspaceId}`);
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects || []);
          if (data.projects?.length > 0 && !currentProjectId && onSelectProject) {
            onSelectProject(data.projects[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load projects:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, [workspaceId, currentProjectId, onSelectProject]);

  const activeProject =
    projects.find((p) => p.id === currentProjectId) || projects[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800/80 transition-colors text-xs font-medium text-slate-200"
      >
        <Globe className="w-3.5 h-3.5 text-blue-400" />
        <span className="font-semibold truncate max-w-[140px]">
          {loading
            ? "Loading..."
            : activeProject?.name || "Select Project / Domain"}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 mt-1.5 w-72 rounded-xl border border-slate-800 bg-[#0b101b] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-400">
              Verified Domains & Projects
            </div>
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {projects.length === 0 ? (
                <div className="px-3 py-3 text-center text-xs text-slate-400">
                  No projects in this workspace yet.
                </div>
              ) : (
                projects.map((proj) => {
                  const isSelected = proj.id === activeProject?.id;
                  return (
                    <button
                      key={proj.id}
                      onClick={() => {
                        onSelectProject?.(proj);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors text-left",
                        isSelected
                          ? "bg-blue-500/10 text-blue-300 font-semibold"
                          : "text-slate-300 hover:bg-slate-800/70"
                      )}
                    >
                      <div className="flex flex-col truncate">
                        <span className="truncate">{proj.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono truncate">
                          {proj.siteUrl}
                        </span>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="pt-1.5 mt-1 border-t border-slate-800/80">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenCreateProjectModal?.();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-blue-400 hover:bg-blue-500/10 transition-colors font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Domain / Project</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
