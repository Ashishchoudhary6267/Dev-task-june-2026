import { Hono } from 'hono';
import { handleAsk, handleSupportEmail } from './ai-support.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = new Hono();

// POST /api/ai-support/ask - Ask a question to the AI Guide
router.post('/ask', authenticate, handleAsk);

// POST /api/ai-support/email - Send a support email as a fallback
router.post('/email', authenticate, handleSupportEmail);

export default router;
