import { Hono } from 'hono';
import { handleChat, handleReport, fetchChats, fetchChatById, createChat, updateChat, deleteChat } from './ai-assistant.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = new Hono();

// POST /api/ai-assistant/chat    - Send a message, get an AI reply
router.post('/chat', authenticate, handleChat);

// POST /api/ai-assistant/report  - Generate a structured issue report from the conversation
router.post('/report', authenticate, handleReport);

// ─── Chat Persistence ───
// GET /api/ai-assistant/chats        - List all chats for the user
router.get('/chats', authenticate, fetchChats);

// GET /api/ai-assistant/chats/:id    - Get a specific chat
router.get('/chats/:id', authenticate, fetchChatById);

// POST /api/ai-assistant/chats       - Create a new chat session
router.post('/chats', authenticate, createChat);

// PUT /api/ai-assistant/chats/:id    - Update (append to) an existing chat
router.put('/chats/:id', authenticate, updateChat);

// DELETE /api/ai-assistant/chats/:id - Delete a chat session
router.delete('/chats/:id', authenticate, deleteChat);

export default router;
