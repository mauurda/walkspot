// instrument.ts — Sentry, initialized before anything else. app.ts imports
// this first, which covers both entrypoints (src/server.ts and api/index.ts).
//
// dotenv must load here, not just in env.ts: this module runs before env.ts,
// and an init that can't see SENTRY_DSN silently disables the SDK.
import "dotenv/config";
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn), // no DSN = local dev — run silently without Sentry
  environment: process.env.NODE_ENV === "production" ? "production" : "development",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  includeLocalVariables: true,
  enableLogs: true,
});
