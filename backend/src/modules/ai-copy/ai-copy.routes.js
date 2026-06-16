import { Hono } from 'hono';
import { generateCopy, getCopiesForTask } from './ai-copy.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = new Hono();

router.post('/generate', authenticate, generateCopy);
router.get('/task/:taskId', authenticate, getCopiesForTask);

export default router;
