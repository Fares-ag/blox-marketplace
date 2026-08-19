import * as Sentry from '@sentry/node';

function scrubRequest(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    if (event.request.data) {
      event.request.data = '[Filtered]';
    }
  }
  return event;
}

/** No-op when SENTRY_DSN is unset. Scrubs request bodies and omits PII. */
export function initApiSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    sendDefaultPii: false,
    beforeSend: scrubRequest,
  });
}
