"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Mail,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";
  const inviteToken = searchParams.get("inviteToken");

  const [email, setEmail] = useState("");
  const [ssoDomain, setSsoDomain] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSsoOpen, setIsSsoOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const supabase = createClient();
  const isSupabaseReady = Boolean(supabase);

  // If an invite token was provided, attempt automatic acceptance if logged in
  useEffect(() => {
    if (!inviteToken) return;

    async function checkInvite() {
      try {
        const res = await fetch("/api/v1/workspaces/invitations/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: inviteToken }),
        });

        if (res.ok) {
          setFeedback({
            type: "success",
            message: "Workspace invitation accepted! Redirecting to dashboard...",
          });
          setTimeout(() => router.push(redirectTo), 1500);
        }
      } catch {
        // If unauthenticated, user will sign in first and token persists in URL
      }
    }

    checkInvite();
  }, [inviteToken, redirectTo, router]);

  // Google OAuth sign in
  const handleGoogleSignIn = async () => {
    if (!supabase) {
      router.push(redirectTo);
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const redirectUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      inviteToken ? `/login?inviteToken=${inviteToken}` : redirectTo
    )}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      setFeedback({ type: "error", message: error.message });
      setIsSubmitting(false);
    }
  };

  // Magic Link / Email OTP sign in
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    if (!supabase) {
      // In dev mode without Supabase credentials, proceed immediately
      router.push(redirectTo);
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const redirectUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      inviteToken ? `/login?inviteToken=${inviteToken}` : redirectTo
    )}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    setIsSubmitting(false);

    if (error) {
      setFeedback({ type: "error", message: error.message });
    } else {
      setFeedback({
        type: "success",
        message: "Magic login link dispatched! Check your email inbox to verify.",
      });
    }
  };

  // Enterprise SSO / SAML sign in
  const handleSsoSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ssoDomain) return;

    if (!supabase) {
      router.push(redirectTo);
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const redirectUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`;

    const { error } = await supabase.auth.signInWithSSO({
      domain: ssoDomain.trim(),
      options: {
        redirectTo: redirectUrl,
      },
    });

    setIsSubmitting(false);

    if (error) {
      setFeedback({ type: "error", message: error.message });
    }
  };

  return (
    <div className="w-full max-w-md p-8 rounded-2xl border border-slate-800 bg-[#0a0f1d]/90 backdrop-blur-xl shadow-2xl space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400 mb-2 shadow-glow-cyan">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">
          OmniRank <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Enterprise</span>
        </h1>
        <p className="text-xs text-slate-400">
          Autonomous Search Intelligence & Content Staging Engine
        </p>
      </div>

      {/* Invite Token Banner */}
      {inviteToken && (
        <div className="p-3.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 text-xs font-mono flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>You have been invited to collaborate on a workspace. Sign in to accept.</span>
        </div>
      )}

      {/* Feedback Messages */}
      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs font-mono flex items-center gap-2.5 ${
            feedback.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/40 border-rose-500/30 text-rose-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Dev Mode Banner (when Supabase keys not yet set) */}
      {!isSupabaseReady && (
        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-950/20 text-amber-300 text-xs font-mono space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            Dev Auth Bypass Active
          </div>
          <p className="text-[11px] text-amber-400/80">
            Supabase credentials not yet supplied in <code className="text-amber-200">.env</code>. You can enter directly with the pre-configured session.
          </p>
          <button
            onClick={() => router.push(redirectTo)}
            className="w-full py-1.5 px-3 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-mono font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Enter Dashboard as Principal Architect</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Primary Google OAuth Button */}
      <button
        onClick={handleGoogleSignIn}
        disabled={isSubmitting}
        className="w-full py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-white text-xs font-semibold flex items-center justify-center gap-3 transition-colors shadow-sm disabled:opacity-50"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.13C3.26 21.4 7.33 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.24C.45 8.15 0 9.92 0 12s.45 3.85 1.24 5.42l4.04-3.13z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.6 1.24 6.58l4.04 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
          />
        </svg>
        <span>Continue with Google</span>
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-800" />
        <span className="text-[11px] font-mono uppercase text-slate-500">or work email</span>
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      {/* Magic Link Form */}
      <form onSubmit={handleEmailSignIn} className="space-y-3">
        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
            Work Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@company.com"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-slate-950 font-semibold text-xs transition-all shadow-glow-cyan flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>Send Magic Sign-In Link</span>
        </button>
      </form>

      {/* Enterprise SAML / SSO Accordion */}
      <div className="pt-2 border-t border-slate-800/80">
        {!isSsoOpen ? (
          <button
            type="button"
            onClick={() => setIsSsoOpen(true)}
            className="text-xs font-mono text-slate-400 hover:text-cyan-400 flex items-center gap-1.5 mx-auto transition-colors"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Sign in with Enterprise SSO / SAML</span>
          </button>
        ) : (
          <form onSubmit={handleSsoSignIn} className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-mono text-slate-400">
                Corporate SSO Domain
              </label>
              <button
                type="button"
                onClick={() => setIsSsoOpen(false)}
                className="text-[10px] text-slate-500 hover:text-slate-300"
              >
                Cancel
              </button>
            </div>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={ssoDomain}
                onChange={(e) => setSsoDomain(e.target.value)}
                placeholder="acme-corp.com"
                className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500 transition-colors font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 px-3 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors flex items-center justify-center gap-2"
            >
              <span>Authenticate with Okta / Entra / SAML</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#060a12] bg-radial-gradient relative overflow-hidden">
      {/* Decorative Glow Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      <Suspense
        fallback={
          <div className="text-xs font-mono text-cyan-400 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading authentication gateway...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
