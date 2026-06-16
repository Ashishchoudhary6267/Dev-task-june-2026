import { callGroqAssistant } from './ai-assistant.groq.js';
import { getSupabase } from '../../config/supabase.js';

// ─────────────────────────────────────────────────────────────────────────────
// Smart Context Selector
// Instead of dumping all docs every request, we pick only the relevant sections.
// This keeps tokens lean and answers more focused.
// ─────────────────────────────────────────────────────────────────────────────

const CONTEXT_KEYWORDS = {
    workflow: ['task', 'locked', 'unlock', 'submit', 'approve', 'reject', 'pending', 'approval', 'checklist', 'in_progress', 'complete', 'sequential', 'step', 'bypass', 'manual unlock', 'overdue', 'sla', 'deadline', 'stuck', 'state machine', 'status'],
    instance: ['instance', 'spawn', 'pause', 'resume', 'scheduled', 'ongoing', 'paused', 'activate', 'workflow run', 'live run', 'deploy', 'creation', 'instance not starting'],
    auth: ['login', 'logout', 'role', 'permission', 'access', 'token', 'session', '401', '403', 'unauthorized', 'forbidden', 'admin', 'controller', 'member', 'superadmin', 'platform_role', 'workflow_role', 'blank dashboard', 'cannot log in'],
    templates: ['template', 'project', 'blueprint', 'template task', 'checklist item', 'step order', 'turnaround', 'estimated', 'assigned_role', 'copy template', 'add task'],
    architecture: ['api', 'backend', 'cloudflare', 'worker', 'cors', 'env', 'supabase', 'database', 'url', 'endpoint', 'axios', 'zustand', 'frontend', 'stack', 'deploy', 'wrangler', 'groq_api_key', 'not loading', 'network error'],
};

const DOC_SECTIONS = {
    workflow: 'instance-workflows.md',
    instance: 'instance-workflows.md',
    auth: 'auth-and-roles.md',
    templates: 'templates-and-projects.md',
    architecture: 'system-architecture.md',
};

/**
 * Picks only the doc sections relevant to the conversation.
 * @param {string} conversationText - combined text of all messages
 * @param {Record<string, string>} docs - map of filename → content
 * @returns {string} - trimmed context string
 */
function selectRelevantContext(conversationText, docs) {
    if (!docs || Object.keys(docs).length === 0) return '';

    const lower = conversationText.toLowerCase();
    const relevantFiles = new Set();

    for (const [category, keywords] of Object.entries(CONTEXT_KEYWORDS)) {
        if (keywords.some(k => lower.includes(k))) {
            relevantFiles.add(DOC_SECTIONS[category]);
        }
    }

    // If nothing matched, fall back to all docs
    const filesToUse = relevantFiles.size > 0
        ? [...relevantFiles]
        : Object.keys(docs);

    return filesToUse
        .filter(f => docs[f])
        .map(f => `=== ${f} ===\n${docs[f]}`)
        .join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// System Prompts
// ─────────────────────────────────────────────────────────────────────────────

function buildChatSystemPrompt(contextDocs) {
    return `You are the FMS (Flow Management System) Platform Intelligence Assistant.
Your role is to diagnose issues, explain platform flows, and help SuperAdmins understand what is going wrong.
You have been given ONLY the relevant documentation sections for this query — use them as your sole knowledge source.

RELEVANT PLATFORM DOCUMENTATION:
${contextDocs || '(no documentation available)'}

RESPONSE RULES:
1. Be concise and structured. Use bullet points where appropriate.
2. When a user describes a problem, always identify: the affected component, the likely cause, and the recommended resolution.
3. If the issue sounds like a code bug, say so and explain which files or functions need changing.
4. Never invent information not in the documentation.
5. If a fix requires code changes, briefly describe which files need updating so the admin can use an AI like Claude for the exact code.`;
}

function buildReportSystemPrompt(contextDocs) {
    return `You are a senior software engineering assistant analyzing an FMS(flow management system) platform issue.
Based on the conversation, generate a structured JSON issue report that a developer can paste directly into Claude or ChatGPT to get an exact fix.

RELEVANT PLATFORM DOCUMENTATION:
${contextDocs || '(no documentation available)'}

CRITICAL: Respond ONLY with valid JSON. No markdown, no code fences, no extra text.

The JSON must have exactly these keys:
{
  "title": "Short descriptive issue title (max 8 words)",
  "severity": "critical|high|medium|low",
  "category": "e.g. Task Management / Authentication / UI / API / State Management",
  "rootCause": "One clear sentence describing the likely root cause",
  "affectedAreas": ["array of file names, modules or feature areas"],
  "stepsToReproduce": ["Step 1", "Step 2", "Step 3"],
  "suggestedFix": "A clear, actionable fix recommendation",
  "claudePrompt": "A complete, ready-to-use prompt for Claude/ChatGPT. Must include: the full issue description, affected files/components, expected behavior, current (broken) behavior, and an explicit request to write the exact code fix."
}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai-assistant/chat
// Body: { messages: [{role, content}], docs: string }
// ─────────────────────────────────────────────────────────────────────────────

export async function handleChat(c) {
    try {
        const { messages, docs } = await c.req.json();

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return c.json({ message: 'messages array is required' }, 400);
        }

        const apiKey = c.env.GROQ_API_KEY;
        if (!apiKey) {
            return c.json({ message: 'GROQ_API_KEY is not configured on the server' }, 500);
        }

        // Smart context: only inject docs relevant to the conversation
        const conversationText = messages.map(m => m.content).join(' ');
        const contextDocs = selectRelevantContext(conversationText, docs);

        const systemPrompt = buildChatSystemPrompt(contextDocs);
        const fullMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
        ];

        const reply = await callGroqAssistant(apiKey, fullMessages, false);

        return c.json({ reply }, 200);

    } catch (err) {
        console.error('AI Assistant chat error:', err);
        return c.json({ message: err.message || 'AI assistant failed' }, 500);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai-assistant/report
// Body: { messages: [{role, content}], docs: string }
// ─────────────────────────────────────────────────────────────────────────────

export async function handleReport(c) {
    try {
        const { messages, docs } = await c.req.json();

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return c.json({ message: 'messages array is required' }, 400);
        }

        const apiKey = c.env.GROQ_API_KEY;
        if (!apiKey) {
            return c.json({ message: 'GROQ_API_KEY is not configured on the server' }, 500);
        }

        // Smart context: combine all message content to find relevant docs
        const conversationText = messages.map(m => m.content).join(' ');
        const contextDocs = selectRelevantContext(conversationText, docs);

        const systemPrompt = buildReportSystemPrompt(contextDocs);
        const fullMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            {
                role: 'user',
                content: 'Based on the full conversation above, generate the structured JSON issue report now.',
            }
        ];

        const rawReply = await callGroqAssistant(apiKey, fullMessages, true);

        // Parse the JSON
        let report;
        try {
            report = JSON.parse(rawReply);
        } catch {
            // Try to extract JSON if wrapped in markdown
            const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return c.json({ message: 'AI returned invalid JSON. Please try again.' }, 500);
            }
            report = JSON.parse(jsonMatch[0]);
        }

        return c.json({ report }, 200);

    } catch (err) {
        console.error('AI Assistant report error:', err);
        return c.json({ message: err.message || 'Report generation failed' }, 500);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat Persistence CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchChats(c) {
    try {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ message: 'Unauthorized' }, 401);

        const supabase = getSupabase(c.env);
        const { data, error } = await supabase
            .from('ai_assistant_chats')
            .select('id, title, updated_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return c.json({ data }, 200);
    } catch (err) {
        console.error('Error fetching chats:', err);
        return c.json({ message: 'Failed to fetch chats' }, 500);
    }
}

export async function fetchChatById(c) {
    try {
        const user = c.get('user');
        const id = c.req.param('id');
        if (!user || !user.id) return c.json({ message: 'Unauthorized' }, 401);

        const supabase = getSupabase(c.env);
        const { data, error } = await supabase
            .from('ai_assistant_chats')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (error) throw error;
        return c.json({ data }, 200);
    } catch (err) {
        console.error('Error fetching chat by id:', err);
        return c.json({ message: 'Failed to fetch chat' }, 500);
    }
}

export async function createChat(c) {
    try {
        const user = c.get('user');
        if (!user || !user.id) return c.json({ message: 'Unauthorized' }, 401);

        const { messages } = await c.req.json();
        
        let title = 'New Diagnosis';
        if (messages && messages.length > 0) {
            // grab first 40 chars of first message for title
            const firstMsg = messages[0].content || '';
            title = firstMsg.length > 40 ? firstMsg.substring(0, 40) + '...' : firstMsg;
            if (!title.trim()) title = 'New Diagnosis';
        }

        const supabase = getSupabase(c.env);
        const { data, error } = await supabase
            .from('ai_assistant_chats')
            .insert({
                user_id: user.id,
                title,
                messages: messages || []
            })
            .select()
            .single();

        if (error) throw error;
        return c.json({ data }, 201);
    } catch (err) {
        console.error('Error creating chat:', err);
        return c.json({ message: 'Failed to create chat' }, 500);
    }
}

export async function updateChat(c) {
    try {
        const user = c.get('user');
        const id = c.req.param('id');
        if (!user || !user.id) return c.json({ message: 'Unauthorized' }, 401);

        const { messages } = await c.req.json();

        const supabase = getSupabase(c.env);
        const { data, error } = await supabase
            .from('ai_assistant_chats')
            .update({
                messages: messages || [],
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;
        return c.json({ data }, 200);
    } catch (err) {
        console.error('Error updating chat:', err);
        return c.json({ message: 'Failed to update chat' }, 500);
    }
}

export async function deleteChat(c) {
    try {
        const user = c.get('user');
        const id = c.req.param('id');
        if (!user || !user.id) return c.json({ message: 'Unauthorized' }, 401);

        const supabase = getSupabase(c.env);
        const { error } = await supabase
            .from('ai_assistant_chats')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) throw error;
        return c.json({ message: 'Chat deleted' }, 200);
    } catch (err) {
        console.error('Error deleting chat:', err);
        return c.json({ message: 'Failed to delete chat' }, 500);
    }
}
