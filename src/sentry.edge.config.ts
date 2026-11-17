import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn:
    process.env.SENTRY_DSN ||
    process.env.NEXT_PUBLIC_SENTRY_DSN ||
    "https://8d65c9c84e5e38d79f36d65aa7277f8c@o4512101903630336.ingest.us.sentry.io/4512447902384128",

  // Enables Tracing
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
