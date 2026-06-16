import { captureException } from '../config/sentry.js';

export const sentryErrorHandler = async (err, c) => {
    const isProduction = c.env?.ENVIRONMENT === 'production';
    
    // Capture error in Sentry (production only)
    if (isProduction) {
        captureException(err, {
            env: c.env,
            path: c.req.path,
            method: c.req.method,
            user: c.get('user'),
            headers: {
                'user-agent': c.req.header('user-agent'),
                'x-forwarded-for': c.req.header('x-forwarded-for'),
            },
        });
    }

    // Log to console in all environments
    console.error('Error:', {
        message: err.message,
        stack: err.stack,
        path: c.req.path,
        method: c.req.method,
    });

    // Return error response
    return c.json(
        {
            message: isProduction ? 'Internal Server Error' : err.message,
            ...(isProduction ? {} : { stack: err.stack }),
        },
        500
    );
};
