// Sentry Server-side Configuration for OmniRank

export const SentryServerConfig = {
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  debug: false,
  environment: process.env.NODE_ENV || "development",
  enabled: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
};

export function initSentryServer() {
  if (!SentryServerConfig.enabled) return;
  try {
    const Sentry = require("@sentry/nextjs");
    Sentry.init(SentryServerConfig);
  } catch {
    // Sentry package optional in local/mock environments
  }
}

initSentryServer();
