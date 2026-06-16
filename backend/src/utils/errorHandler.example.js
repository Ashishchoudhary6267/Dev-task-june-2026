// Example: How to update your controllers to use Sentry error tracking

import { handleControllerError } from '../../utils/errorHandler.js';

// BEFORE (old way):
export const oldController = async (c) => {
    try {
        // your logic
    } catch (err) {
        console.error("Error:", err);
        return c.json({ message: "Internal Server Error" }, 500);
    }
};

// AFTER (with Sentry):
export const newController = async (c) => {
    try {
        // your logic
    } catch (err) {
        return handleControllerError(err, c, 'Controller Operation Name', {
            // Add any additional context you want to track
            taskId: c.req.param('id'),
            userId: c.get('user')?.id,
        });
    }
};

// Example with your reopenTaskForClientRevision controller:
export const reopenTaskForClientRevision = async (c) => {
    try {
        const taskId = c.req.param('id');
        const { reason, client_comment } = await c.req.json();
        const user = c.get('user');
        
        // ... your existing logic ...
        
    } catch (err) {
        return handleControllerError(err, c, 'Reopen Task For Client Revision', {
            taskId: c.req.param('id'),
            userId: user?.id,
            companyId: user?.company_id,
        });
    }
};
