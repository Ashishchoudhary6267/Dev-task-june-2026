/**
 * Gemini 1.5 Flash REST API helper for Cloudflare Workers.
 * No SDK — plain fetch to keep the worker bundle small.
 */

const GEMINI_ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

/**
 * System prompt that teaches Gemini how to produce structured email marketing copy.
 * The output must be valid JSON so the frontend can render each section independently.
 */
const SYSTEM_PROMPT = `You are a world-class email marketing copywriter. 
Given the details the user provides (product name, brand, audience, tone, type, and any extra requirements), produce a complete email marketing copy.

IMPORTANT: You MUST respond with ONLY valid JSON — no markdown, no code fences, no extra text.

The JSON object must have exactly these keys (use empty string "" if a section is not applicable):

{
  "subject_line": "The email subject line",
  "preview_text": "The preview / preheader text",
  "headline": "Main headline",
  "subheadline": "Supporting subheadline",
  "cta_button_text": "Call-to-action button text",
  "body": "Main body copy (can include multiple paragraphs, separated by \\n\\n)",
  "product_headline": "A catchy product-focused headline",
  "closing_section": "Closing / urgency text",
  "footer_text": "Optional footer note or legal text"
}

Guidelines:
- Keep the tone consistent with what the user requests.
- Make the copy persuasive, benefit-driven, and action-oriented.
- If the user specifies a text length (short / medium / long), adjust accordingly.
- Use line breaks (\\n) within body text for readability.
- Do NOT wrap your response in markdown code fences or add any explanation outside the JSON.`;

/**
 * Call Gemini 1.5 Flash and return the parsed copy object.
 *
 * @param {string} apiKey  – GEMINI_API_KEY from env
 * @param {object} promptData – { product_name, brand_name, target_audience, tone, copy_type, additional_requirements }
 * @returns {Promise<object>} parsed JSON copy
 */
export async function callGemini(apiKey, promptData) {
    const {
        product_name = '',
        brand_name = '',
        target_audience = '',
        tone = 'professional',
        copy_type = 'Email Marketing',
        additional_requirements = '',
    } = promptData;

    const userMessage = [
        `Product Name: ${product_name}`,
        brand_name && `Brand Name: ${brand_name}`,
        target_audience && `Target Audience: ${target_audience}`,
        `Tone: ${tone}`,
        `Copy Type: ${copy_type}`,
        additional_requirements && `Additional Requirements: ${additional_requirements}`,
    ]
        .filter(Boolean)
        .join('\n');

    const body = {
        system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
            {
                role: 'user',
                parts: [{ text: userMessage }],
            },
        ],
        generationConfig: {
            temperature: 0.9,
            topP: 0.95,
            maxOutputTokens: 2048,
        },
    };

    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${errText}`);
    }

    const data = await res.json();

    // Extract text from the first candidate
    const rawText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip possible markdown fences (```json ... ```)
    const cleaned = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();

    try {
        return JSON.parse(cleaned);
    } catch {
        // If parsing fails, return raw text wrapped in body
        return {
            subject_line: '',
            preview_text: '',
            headline: '',
            subheadline: '',
            cta_button_text: '',
            body: rawText,
            product_headline: '',
            closing_section: '',
            footer_text: '',
        };
    }
}
