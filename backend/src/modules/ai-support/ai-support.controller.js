import { callGroqAssistant } from '../ai-assistant/ai-assistant.groq.js';
import { sendSupportTicketEmail } from '../../utils/email.js';

export const handleAsk = async (c) => {
    try {
        const { message, role, docsContext, recentHistory } = await c.req.json();
        const user = c.get('user');

        if (!message) {
            return c.json({ error: 'Message is required' }, 400);
        }

        const systemPrompt = `You are the FMS Platform Support Guide. You are assisting a user with the role of "${role || 'member'}".
Your goal is to answer their questions about the platform strictly based on the provided documentation context.
Always be polite, concise, and helpful.

CRITICAL INSTRUCTIONS:
1. If the user asks a question that is COMPLETELY IRRELEVANT to the FMS platform (e.g., "how to bake a cake", "what is the capital of France"), you MUST reply EXACTLY with the phrase: "FALLBACK_REQUIRED" and absolutely nothing else.
2. If the user asks a question that is related to the platform but you DO NOT KNOW the answer based on the context provided, you MUST reply EXACTLY with the phrase: "FALLBACK_REQUIRED" and absolutely nothing else.
3. NEVER return technical details such as API endpoints, HTTP methods, JSON payloads, database schemas, or code snippets. The user is a non-technical platform end-user. Answer ONLY by explaining how to navigate and use the user interface (UI) to achieve their goal.
4. If you can answer the question, format your response in clean Markdown.

Here is the platform documentation context to help you answer:
"""
${docsContext || 'No context provided. Use your general knowledge of standard work management platforms but be very careful not to hallucinate specific FMS features.'}
"""
`;

        let messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Append past conversation context if provided
        if (Array.isArray(recentHistory)) {
            messages = messages.concat(recentHistory.map(m => ({
                role: m.role === 'ai' ? 'assistant' : (m.role || 'user'),
                content: m.content || ''
            })));
        }

        messages.push({ role: 'user', content: message });

        const apiKey = c.env.GROQ_API_KEY;
        const aiResponse = await callGroqAssistant(apiKey, messages);

        // Check if the AI returned the exact fallback phrase (allowing for minor punctuation or whitespace)
        const isFallback = aiResponse.trim().toUpperCase().includes('FALLBACK_REQUIRED');

        if (isFallback) {
            return c.json({
                success: true,
                fallbackRequired: true,
                reply: null
            });
        }

        return c.json({
            success: true,
            fallbackRequired: false,
            reply: aiResponse
        });

    } catch (error) {
        console.error('AI Support Ask Error:', error);
        return c.json({ success: false, error: 'Failed to process AI request' }, 500);
    }
};

export const handleSupportEmail = async (c) => {
    try {
        const { message } = await c.req.json();
        const user = c.get('user');

        if (!message) {
            return c.json({ error: 'Message is required to send support email' }, 400);
        }

        await sendSupportTicketEmail(user.email, user.name, message, c.env);

        return c.json({ success: true, message: 'Support email sent successfully' });
    } catch (error) {
        console.error('AI Support Email Error:', error);
        return c.json({ success: false, error: 'Failed to send support email' }, 500);
    }
};
