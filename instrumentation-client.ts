// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://5303059aca77170166cd0f637781ffda@o4509677223477248.ingest.us.sentry.io/4509677230751744",

  // Add optional integrations for additional features
  integrations: [
    Sentry.replayIntegration(),
  ],

  // Reduce noise from known benign third-party errors (Telegram widget)
  ignoreErrors: [
    /TelegramGameProxy/i,
    /window\.?TelegramGameProxy/i,
  ],
  // Optionally drop events originating from the Telegram widget script URL
  denyUrls: [
    /telegram\.org\/js\/telegram-widget\.js/i,
  ],
  // Last-resort filter to prevent noisy events from being sent
  beforeSend(event) {
    try {
      const val = event?.exception?.values?.[0];
      const message = (val?.value || event?.message || "") as string;
      if (typeof message === 'string' && message.toLowerCase().includes('telegramgameproxy')) {
        // Drop this noisy, third-party error
        return null;
      }
    } catch (_) {
      // Never let filtering throw
    }
    return event;
  },

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;