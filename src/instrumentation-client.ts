import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,

    // Enables Tracing
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

    integrations: [
      Sentry.replayIntegration(),
    ],

    // Capture replays for 10% of all sessions,
    // plus for 100% of sessions with an error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
