import * as Sentry from '@sentry/react';

function scrubRequest(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request?.data) {
    event.request.data = '[Filtered]';
  }
  return event;
}

/** No-op when VITE_SENTRY_DSN is unset. Scrubs request bodies and omits PII. */
export function initAppSentry(appName: string): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  const meta = import.meta.env as ImportMetaEnv & { MODE?: string; PROD?: boolean };

  Sentry.init({
    dsn,
    environment: meta.MODE ?? (meta.PROD ? 'production' : 'development'),
    sendDefaultPii: false,
    initialScope: {
      tags: { app: appName },
    },
    beforeSend: scrubRequest,
  });
}
