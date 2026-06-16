// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  enabled: process.env.NODE_ENV === "production",
  // Set NEXT_PUBLIC_SENTRY_DSN to enable error reporting. Empty = Sentry disabled (no-op).
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  integrations: [
    Sentry.httpClientIntegration({
      // Captures full request and response bodies for any failed API calls (400-599)
      failedRequestStatusCodes: [[400, 599]],
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Automatically link Sentry and Clarity without needing dashboard setup
if (typeof window !== "undefined") {
  const interval = setInterval(() => {
    const clarity = (window as any).clarity;
    if (clarity && typeof clarity === "function") {
      // Sentry v8: attach a tag so you can search for this session in Sentry
      Sentry.setTag("clarity_active", "true");
      
      // Attempt to get the Clarity session URL if available
      try {
        clarity("event", "Sentry Integration Ready");
      } catch (e) {}
      
      clearInterval(interval);
    }
  }, 1500);
  
  // Clear interval after 15 seconds to prevent infinite loops
  setTimeout(() => clearInterval(interval), 15000);
}
