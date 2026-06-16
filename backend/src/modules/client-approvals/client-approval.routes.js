import { Hono } from 'hono';
import { authenticate } from '../../middleware/auth.middleware.js';
import { listClientApprovals, resolveClientApproval, countPendingClientApprovals } from './client-approval.controller.js';
import { handleFollowUpCron } from '../../workflow/followup.cron.js';

const router = new Hono();

router.get('/', authenticate, listClientApprovals);
router.get('/count', authenticate, countPendingClientApprovals);
router.post('/:id/resolve', authenticate, resolveClientApproval);

// Temporary endpoint to test the cron job manually
router.get('/test-cron', async (c) => {
    await handleFollowUpCron(c.env);
    return c.json({ message: 'Cron job executed manually.' }, 200);
});

export default router;
