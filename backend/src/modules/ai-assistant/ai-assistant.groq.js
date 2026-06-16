/**
 * Groq AI Assistant for FMS Platform Intelligence.
 * Handles chat completions and structured issue report generation.
 * Uses the server-side GROQ_API_KEY so the key is never exposed to the browser.
 */

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

// Platform documentation is injected server-side via the system prompt.
// The frontend sends the raw docs content it already fetches from /public/docs.

/**
 * Core Groq call function.
 * @param {string} apiKey - from c.env.GROQ_API_KEY
 * @param {Array}  messages - OpenAI-format messages array
 * @param {boolean} jsonMode - whether to force JSON response_format
 */
export async function callGroqAssistant(apiKey, messages, jsonMode = false) {
    const body = {
        model: MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 4096,
    };

    if (jsonMode) {
        body.response_format = { type: 'json_object' };
    }

    const res = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Groq API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
}
