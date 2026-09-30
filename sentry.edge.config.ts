// Sentry Edge Middleware Configuration for OmniRank

export const SentryEdgeConfig = {
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  debug: false,
  environment: process.env.NODE_ENV || "development",
  enabled: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
};

export function initSentryEdge() {
  if (!SentryEdgeConfig.enabled) return;
  try {
    const Sentry = require("@sentry/nextjs");
    Sentry.init(SentryEdgeConfig);
  } catch {
    // Sentry package optional in local/mock environments
  }
}

initSentryEdge();
