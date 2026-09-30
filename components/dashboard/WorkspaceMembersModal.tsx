"use client";

import { useState, useEffect, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Copy,
  Check,
  X,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Crown,
} from "lucide-react";

interface MemberItem {
  id: string;
  role: string;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

interface InvitationItem {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  token: string;
}

interface WorkspaceMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string;
  workspaceName?: string;
}

export function WorkspaceMembersModal({
  isOpen,
  onClose,
  workspaceId,
  workspaceName,
}: WorkspaceMembersModalProps) {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [callerRole, setCallerRole] = useState<string>("MEMBER");
  const [isLoading, setIsLoading] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Feedback Notification
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadMembers = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setInvitations(data.invitations || []);
        setCallerRole(data.callerRole || "MEMBER");
      }
    } catch (err) {
      console.error("Failed to load workspace members:", err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (isOpen && workspaceId) {
      loadMembers();
      setFeedback(null);
      setInviteEmail("");
    }
  }, [isOpen, workspaceId, loadMembers]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !inviteEmail) return;

    setIsInviting(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create invitation");
      }

      setFeedback({
        type: "success",
        text: `Invitation generated for ${inviteEmail}! Shareable link created.`,
      });
      setInviteEmail("");
      await loadMembers();
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to invite member",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/login?inviteToken=${token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (!workspaceId) return;
    try {
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/invitations/${invitationId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        await loadMembers();
        setFeedback({
          type: "success",
          text: "Invitation revoked successfully.",
        });
      }
    } catch (err) {
      console.error("Failed to revoke invite:", err);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: "ADMIN" | "MEMBER") => {
    if (!workspaceId) return;
    try {
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/members/${memberId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        }
      );
      if (res.ok) {
        await loadMembers();
        setFeedback({
          type: "success",
          text: "Member role updated successfully.",
        });
      }
    } catch (err) {
      console.error("Failed to update role:", err);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!workspaceId) return;
    if (!confirm(`Are you sure you want to remove ${memberName} from this workspace?`)) {
      return;
    }

    try {
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/members/${memberId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove member");
      }
      await loadMembers();
      setFeedback({
        type: "success",
        text: "Member removed from workspace.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to remove member",
      });
    }
  };

  const canManage = callerRole === "OWNER" || callerRole === "ADMIN";

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-800 bg-[#0a0f1d] p-6 shadow-2xl z-50 focus:outline-none">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-glow-cyan">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-white flex items-center gap-2">
                  <span>Workspace Team & Members</span>
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
                    {workspaceName || "Current Workspace"}
                  </span>
                </Dialog.Title>
                <Dialog.Description className="text-xs text-slate-400 mt-0.5">
                  Manage collaborators, assign administrative privileges, and issue invitation links.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/80 transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`mt-4 p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
                feedback.type === "success"
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-950/40 border-rose-500/30 text-rose-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}

          {/* Invite Member Section (ADMIN & OWNER only) */}
          {canManage && (
            <form onSubmit={handleSendInvite} className="mt-5 p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-200">
                <UserPlus className="w-4 h-4 text-cyan-400" />
                <span>Invite New Teammate</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@domain.com"
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "MEMBER")}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="MEMBER">Role: Member</option>
                  <option value="ADMIN">Role: Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={isInviting || !inviteEmail}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 shrink-0 shadow-glow-cyan"
                >
                  {isInviting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5" />
                  )}
                  <span>Generate Invite</span>
                </button>
              </div>
            </form>
          )}

          {/* Active Members List */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase tracking-wider">
              <span>Workspace Members ({members.length})</span>
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
            </div>

            <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-[#060a12]/60 overflow-hidden">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-800/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={m.user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.userId}`}
                      alt={m.user.name || m.user.email}
                      className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                        <span>{m.user.name || m.user.email.split("@")[0]}</span>
                        {m.role === "OWNER" && (
                          <span title="Workspace Owner">
                            <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate">
                        {m.user.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {/* Role Badge or Selector */}
                    {callerRole === "OWNER" && m.role !== "OWNER" ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleUpdateRole(m.id, e.target.value as "ADMIN" | "MEMBER")}
                        className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] font-mono text-cyan-400 focus:outline-none"
                      >
                        <option value="MEMBER">MEMBER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    ) : (
                      <span
                        className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                          m.role === "OWNER"
                            ? "bg-violet-950/60 border-violet-500/40 text-violet-300"
                            : m.role === "ADMIN"
                            ? "bg-cyan-950/60 border-cyan-500/40 text-cyan-300"
                            : "bg-slate-800 border-slate-700 text-slate-300"
                        }`}
                      >
                        {m.role}
                      </span>
                    )}

                    {/* Remove Member Button */}
                    {canManage && m.role !== "OWNER" && (
                      <button
                        onClick={() => handleRemoveMember(m.id, m.user.name || m.user.email)}
                        className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Invitations Section */}
          {invitations.length > 0 && canManage && (
            <div className="mt-6 space-y-3">
              <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                Pending Invitations ({invitations.length})
              </div>

              <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-[#060a12]/60 overflow-hidden">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{inv.email}</div>
                      <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="text-cyan-400">Role: {inv.role}</span>
                        <span>•</span>
                        <span>Expires {new Date(inv.expiresAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyLink(inv.token)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
                      >
                        {copiedToken === inv.token ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-400" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleRevokeInvite(inv.id)}
                        className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                        title="Revoke invitation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-mono font-medium border border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
