import { captureException } from '../config/sentry.js';

/**
 * Handles errors in controllers with Sentry logging
 * @param {Error} error - The error object
 * @param {Object} c - Hono context
 * @param {string} operation - Description of the operation (e.g., "Update Approval Levels")
 * @param {Object} additionalContext - Additional context to log
 * @returns {Response} JSON error response
 */
export function handleControllerError(error, c, operation, additionalContext = {}) {
    const isProduction = c.env?.ENVIRONMENT === 'production';
    
    // Capture in Sentry (production only)
    if (isProduction) {
        captureException(error, {
            env: c.env,
            operation,
            path: c.req.path,
            method: c.req.method,
            user: c.get('user'),
            ...additionalContext,
        });
    }

    // Console log in all environments
    console.error(`${operation} Error:`, {
        message: error.message,
        stack: error.stack,
        ...additionalContext,
    });

    // Return appropriate response
    return c.json(
        {
            message: isProduction ? 'Internal Server Error' : error.message,
            ...(isProduction ? {} : { stack: error.stack }),
        },
        500
    );
}
