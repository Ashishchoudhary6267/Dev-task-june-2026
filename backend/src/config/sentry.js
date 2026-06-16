import * as Sentry from '@sentry/cloudflare';

export function initSentry(env) {
    const isProduction = env.ENVIRONMENT === 'production';
    
    if (!isProduction) {
        return null;
    }

    Sentry.init({
        dsn: env.SENTRY_DSN,
        environment: env.ENVIRONMENT || 'production',
        tracesSampleRate: 1.0,
        beforeSend(event) {
            // Filter out sensitive data
            if (event.request?.headers) {
                delete event.request.headers['authorization'];
                delete event.request.headers['cookie'];
            }
            return event;
        },
    });

    return Sentry;
}

export function captureException(error, context = {}) {
    if (context.env?.ENVIRONMENT === 'production') {
        Sentry.captureException(error, {
            extra: context,
        });
    }
}

export function captureMessage(message, level = 'info', context = {}) {
    if (context.env?.ENVIRONMENT === 'production') {
        Sentry.captureMessage(message, {
            level,
            extra: context,
        });
    }
}
