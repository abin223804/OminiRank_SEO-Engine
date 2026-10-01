"use client";

import { useState, useEffect } from "react";
import { X, Globe, GitBranch, KeyRound, Sparkles, Building2 } from "lucide-react";
import { ProjectItem } from "./ProjectSwitcher";
import { WorkspaceItem } from "./WorkspaceSwitcher";

interface CreateProjectModalProps {
  isOpen: boolean;
  workspaceId?: string;
  workspaces?: WorkspaceItem[];
  onOpenCreateWorkspaceModal?: () => void;
  onClose: () => void;
  onCreated: (proj: ProjectItem, workspace?: WorkspaceItem) => void;
}

export function CreateProjectModal({
  isOpen,
  workspaceId,
  workspaces,
  onOpenCreateWorkspaceModal,
  onClose,
  onCreated,
}: CreateProjectModalProps) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(workspaceId || "");
  const [workspacesList, setWorkspacesList] = useState<WorkspaceItem[]>(workspaces || []);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [name, setName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [gscPropertyId, setGscPropertyId] = useState("");
  const [deploymentMode, setDeploymentMode] = useState<"AUTO_PR" | "DIRECT_COMMIT" | "WEBHOOK_ONLY">("AUTO_PR");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubBranch, setGithubBranch] = useState("main");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (workspaceId) {
        setSelectedWorkspaceId(workspaceId);
      }
      if (workspaces && workspaces.length > 0) {
        setWorkspacesList(workspaces);
        if (!workspaceId) {
          setSelectedWorkspaceId(workspaces[0].id);
        }
      } else {
        setIsLoadingWorkspaces(true);
        fetch("/api/v1/workspaces")
          .then((r) => r.json())
          .then((d) => {
            const list = d.workspaces || [];
            if (list.length > 0) {
              setWorkspacesList(list);
              if (!workspaceId) {
                setSelectedWorkspaceId(list[0].id);
              }
            }
          })
          .catch(console.error)
          .finally(() => setIsLoadingWorkspaces(false));
      }
    }
  }, [isOpen, workspaceId, workspaces]);

  if (!isOpen) return null;

  const handleUrlChange = (url: string) => {
    setSiteUrl(url);
    if (!gscPropertyId) {
      try {
        const u = new URL(url);
        setGscPropertyId(`sc-domain:${u.hostname}`);
      } catch {
        // url is still being typed
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const targetWsId = selectedWorkspaceId || workspaceId;

    try {
      const res = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(targetWsId ? { workspaceId: targetWsId } : {}),
          name,
          siteUrl,
          gscPropertyId,
          deploymentMode,
          githubRepo: githubRepo ? githubRepo.trim() : null,
          githubBranch,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      onCreated(data.project, data.workspace);
      setName("");
      setSiteUrl("");
      setGscPropertyId("");
      setGithubRepo("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#090e18] shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Add Tracking Project & Domain</h3>
            <p className="text-xs text-slate-400">
              Connect a website domain to enable autonomous striking distance monitoring.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Workspace Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-mono text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Target Workspace</span>
              </label>
              {onOpenCreateWorkspaceModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCreateWorkspaceModal();
                  }}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono transition-colors"
                >
                  + New Workspace
                </button>
              )}
            </div>
            {workspacesList.length > 0 ? (
              <select
                value={selectedWorkspaceId || workspacesList[0]?.id}
                onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-cyan-500 transition-colors"
              >
                {workspacesList.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name} ({ws.planTier})
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800/80 text-xs text-slate-400 font-mono flex items-center justify-between">
                <span>{isLoadingWorkspaces ? "Detecting workspace..." : "Default workspace will be created automatically"}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Project Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Tekora Primary"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Site URL
              </label>
              <input
                type="url"
                required
                placeholder="https://example.com"
                value={siteUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Google Search Console Property ID
            </label>
            <input
              type="text"
              required
              placeholder="sc-domain:example.com or https://example.com/"
              value={gscPropertyId}
              onChange={(e) => setGscPropertyId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-cyan-500 transition-colors"
            />
            <span className="text-[10px] text-slate-400 font-mono mt-1 block">
              Match the exact domain or URL property registered in your GSC dashboard.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Deployment Mode
              </label>
              <select
                value={deploymentMode}
                onChange={(e) =>
                  setDeploymentMode(
                    e.target.value as "AUTO_PR" | "DIRECT_COMMIT" | "WEBHOOK_ONLY"
                  )
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500"
              >
                <option value="AUTO_PR">Automated Pull Request (Safe)</option>
                <option value="DIRECT_COMMIT">Direct Commit to Branch</option>
                <option value="WEBHOOK_ONLY">Webhook Notification Only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                GitHub Branch
              </label>
              <input
                type="text"
                placeholder="main"
                value={githubBranch}
                onChange={(e) => setGithubBranch(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              GitHub Repository (Optional)
            </label>
            <input
              type="text"
              placeholder="owner/repo (e.g. acme/website)"
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 text-slate-950 hover:brightness-110 shadow-glow-cyan disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{loading ? "Adding..." : "Add Project"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
