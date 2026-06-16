import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { initSentry } from './config/sentry.js';
import { sentryErrorHandler } from './middleware/sentry.middleware.js';

import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import companyRoutes from './modules/company/company.routes.js';
import projectRoutes from './modules/projects/project.routes.js';
import taskRoutes from './modules/tasks/task.routes.js';
import clientRoutes from './modules/client/client.routes.js';
import instanceRoutes from './modules/instances/instance.routes.js';
import holidayRoutes from './modules/holidays/holiday.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import performanceRoutes from './modules/performance/performance.routes.js';
import reportRoutes from './modules/reports/report.routes.js';
import superadminRoutes from './modules/superadmin/superadmin.routes.js';
import onboardingRoutes from './modules/onboarding/onboarding.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import chatRoutes from './modules/chat/chat.routes.js';
import aiCopyRoutes from './modules/ai-copy/ai-copy.routes.js';
import aiAssistantRoutes from './modules/ai-assistant/ai-assistant.routes.js';
import aiSupportRoutes from './modules/ai-support/ai-support.routes.js';
import pushRoutes from './modules/push/push.routes.js';
import heartbeatRoutes from './modules/heartbeat/routes.heartbeat.js';
import clientApprovalRoutes from './modules/client-approvals/client-approval.routes.js';
import slaExtensionRoutes from './modules/sla-extension/sla-extension.routes.js';
import { handleFollowUpCron } from './workflow/followup.cron.js';
import { runOverdueCheck } from './modules/sla-extension/sla-extension.scheduler.js';

const app = new Hono();

// Global error handler
app.onError(sentryErrorHandler);

// Global CORS Middleware
app.use(
    '*',
    cors({
        origin: (origin, c) => {
            // Allowed origins are configured via the ALLOWED_ORIGINS env var
            // (comma-separated). Falls back to localhost for local development.
            // Example: ALLOWED_ORIGINS="http://localhost:3000,https://your-frontend.example.com"
            const allowedOrigins = (c?.env?.ALLOWED_ORIGINS || 'http://localhost:3000')
                .split(',')
                .map((o) => o.trim())
                .filter(Boolean);

            if (!origin || allowedOrigins.includes(origin)) {
                return origin || '*';
            }
            return null; // Reject CORS
        },
        credentials: true,
    })
);

// Health check endpoint
app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() }, 200);
});

app.route('/api', authRoutes);
app.route('/api', userRoutes);
app.route('/api', companyRoutes);
app.route('/api', projectRoutes);
app.route('/api/tasks', taskRoutes);
app.route('/api', clientRoutes);
app.route('/api', instanceRoutes);
app.route('/api/holidays', holidayRoutes);
app.route('/api/notifications', notificationRoutes);
app.route('/api/performance', performanceRoutes);
app.route('/api/reports', reportRoutes);
app.route('/api/superadmin', superadminRoutes);
app.route('/api/onboarding', onboardingRoutes);
app.route('/api/dashboard', dashboardRoutes);
app.route('/api', chatRoutes);
app.route('/api/ai-copy', aiCopyRoutes);
app.route('/api/ai-assistant', aiAssistantRoutes);
app.route('/api/ai-support', aiSupportRoutes);
app.route('/api/push', pushRoutes);
app.route('/api', heartbeatRoutes);
app.route('/api/client-approvals', clientApprovalRoutes);
app.route('/api', slaExtensionRoutes);

export default {
    fetch(request, env, ctx) {
        // Initialize Sentry in production
        initSentry(env);
        return app.fetch(request, env, ctx);
    },
    async scheduled(event, env, ctx) {
        initSentry(env);
        // Daily follow-up cron (10:00 AM UTC)
        ctx.waitUntil(handleFollowUpCron(env));
        // Every 5 min: auto-generate TAT extension requests for overdue tasks
        ctx.waitUntil(runOverdueCheck(env));
    },
};
