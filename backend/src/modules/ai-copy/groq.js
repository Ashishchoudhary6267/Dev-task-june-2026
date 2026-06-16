/**
 * Groq REST API helper for Cloudflare Workers.
 * Uses Groq's OpenAI-compatible endpoint for blazing fast inference.
 */

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * System prompt that teaches the model how to produce structured email marketing copy.
 * The output must be valid JSON so the frontend can render each section independently.
 */
const SYSTEM_PROMPT = `You are a world-class email marketing copywriter known for writing extremely concise, punchy, and highly human-sounding copy. 

Given the details the user provides, produce a complete marketing copy structure.

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

STRICT GUIDELINES:
1. EXTREME CONCISENESS & HARD LIMITS: You MUST obey these exact length constraints or you will be penalized:
   - "subject_line": MAX 6 words.
   - "preview_text": MAX 8 words.
   - "headline": MAX 6 words.
   - "subheadline": MAX 10 words.
   - "body": MAXIMUM 2-3 short sentences. Absolutely NO long paragraphs. Get straight to the value in under 30 words.
   - "product_headline": MAX 5 words.
   - "closing_section": MAX 1 sentence.
2. BANNED WORDS: You are STRICTLY FORBIDDEN from using any of the following words: "elevate", "unlock", "game-changer", "cutting-edge", "unleash", "delve", "supercharge", "revolutionary", "next-level", "transform". Write like a normal human marketer.
3. ABSOLUTELY NO FAKE DISCOUNTS: You MUST NOT invent, guess, or hallucinate discount codes or percentages. If (and ONLY if) the user explicitly provides a discount in the "Additional Requirements", you may use it. If no discount is provided, DO NOT mention any sales, percentages off, or codes anywhere.
4. NO HALLUCINATION: DO NOT invent features, benefits, materials, or facts about the product that the user did not explicitly provide. Stick EXCLUSIVELY to what is given. If the user only gives a name, do not make up a fabric type.
5. If a real discount IS provided by the user, you MUST feature it prominently in the "subject_line".
6. ONLY output the JSON object. Do NOT wrap it in backticks or markdown fences.`;

/**
 * Call Groq (Llama 3.1) and return the parsed copy object.
 *
 * @param {string} apiKey  – GROQ_API_KEY from env
 * @param {object} promptData – user prompt fields
 * @returns {Promise<object>} parsed JSON copy1
 */
export async function callGroq(apiKey, promptData) {
    const {
        product_name = '',
        brand_name = '',
        target_audience = '',
        tone = 'professional',
        copy_type = 'Email Marketing',
        additional_requirements = '',
        image_links = [],
        previous_generation = null,
    } = promptData;

    const userMessage = [
        `Product Name: ${product_name}`,
        brand_name && `Brand Name: ${brand_name}`,
        target_audience && `Target Audience: ${target_audience}`,
        `Tone: ${tone}`,
        `Copy Type: ${copy_type}`,
        additional_requirements && `Additional Requirements/Feedback: ${additional_requirements}`,
        image_links.length > 0 && `Image Links to include: ${image_links.join(', ')}`,
    ]
        .filter(Boolean)
        .join('\n');

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT }
    ];

    if (previous_generation) {
        messages.push({ role: 'user', content: `Here is the original request details:\n\n${userMessage}\n\nCan you generate the copy for me?` });
        messages.push({ role: 'assistant', content: typeof previous_generation === 'string' ? previous_generation : JSON.stringify(previous_generation) });
        messages.push({ role: 'user', content: 'Here is my updated feedback and instructions. Please refine your previous version to comply strictly with these updated rules:\n\n' + userMessage });
    } else {
        messages.push({ role: 'user', content: userMessage });
    }

    const body = {
        model: 'llama-3.3-70b-versatile', // Upgraded to 70B for strict adherence to constraints
        response_format: { type: 'json_object' },
        messages: messages,
        temperature: 0.7,
        max_tokens: 2048,
    };

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

    // Extract text from the first choice
    const rawText = data.choices?.[0]?.message?.content || '{}';

    try {
        return JSON.parse(rawText);
    } catch {
        // Fallback if parsing fails (though json_object format forces JSON)
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
