import { getSupabase } from '../../config/supabase.js';
import { callGroq } from './groq.js';

/**
 * POST /api/ai-copy/generate
 */
export async function generateCopy(c) {
    try {
        const { task_id, company_id, prompt_data } = await c.req.json();

        if (!task_id || !company_id) {
            return c.json({ message: 'task_id and company_id are required' }, 400);
        }

        if (!prompt_data || !prompt_data.product_name?.trim()) {
            return c.json({ message: 'product_name is required in prompt_data' }, 400);
        }

        const apiKey = c.env.GROQ_API_KEY;
        if (!apiKey) {
            return c.json({ message: 'GROQ_API_KEY is not configured on the server' }, 500);
        }

        // Call Groq
        const generatedContent = await callGroq(apiKey, prompt_data);

        // Count existing iterations for this task
        const supabase = getSupabase(c.env);
        const { count } = await supabase
            .from('ai_generated_copies')
            .select('id', { count: 'exact', head: true })
            .eq('task_id', task_id);

        const iterationCount = (count || 0) + 1;

        // Save to DB
        const { data: saved, error: insertError } = await supabase
            .from('ai_generated_copies')
            .insert({
                task_id,
                company_id,
                prompt_context: prompt_data,
                generated_content: generatedContent,
                iteration_count: iterationCount,
                status: 'IN_REVIEW',
            })
            .select()
            .single();

        if (insertError) {
            console.error('DB insert error:', insertError);
            return c.json({ message: 'Failed to save generated copy', error: insertError.message }, 500);
        }

        return c.json({
            message: 'Copy generated successfully',
            data: saved,
        }, 200);

    } catch (err) {
        console.error('generateCopy error:', err);
        return c.json({ message: err.message || 'Failed to generate copy' }, 500);
    }
}

/**
 * GET /api/ai-copy/task/:taskId
 * Fetch all generated copies for a specific task.
 */
export async function getCopiesForTask(c) {
    try {
        const taskId = c.req.param('taskId');
        if (!taskId) return c.json({ message: 'Missing taskId' }, 400);

        const supabase = getSupabase(c.env);
        const { data, error } = await supabase
            .from('ai_generated_copies')
            .select('*')
            .eq('task_id', taskId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return c.json({ data }, 200);
    } catch (err) {
        console.error('getCopiesForTask error:', err);
        return c.json({ message: 'Failed to fetch history' }, 500);
    }
}
