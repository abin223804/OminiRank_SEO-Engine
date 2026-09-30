// Sentry Client-side Configuration for OmniRank

export const SentryClientConfig = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || "",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  debug: false,
  environment: process.env.NODE_ENV || "development",
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN),
};

export function initSentryClient() {
  if (!SentryClientConfig.enabled) return;
  try {
    const Sentry = require("@sentry/nextjs");
    Sentry.init(SentryClientConfig);
  } catch {
    // Sentry package optional in local/mock environments
  }
}

initSentryClient();
