import { getSupabase } from "../../config/supabase.js";
import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { sendEmail, sendConfirmationEmail, sendRejectionEmail } from "../../utils/email.js";
import { generateTempPassword } from "../../utils/generateTempPass.js";

export const getCompanies = async (c) => {
    try {
        const supabase = getSupabase(c.env);
        const { data: companies, error } = await supabase
            .from('companies')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const companyWithUsers = await Promise.all(companies.map(async (company) => {
            const { error: usersError, count } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', company.id);

            if (usersError) throw usersError;

            return { ...company, team_size: count || 0 };
        }));
        return c.json(companyWithUsers, 200);
    } catch (error) {
        return c.json({ message: 'Error fetching companies', error: error.message }, 500);
    }
};

export const createCompanyAndAdmin = async (c) => {
    try {
        const { companyName, companyEmail, companyPhone, companyAddress, companyWebsite, companyDescription, adminName, adminEmail, adminPassword } = await c.req.json();

        const supabase = getSupabase(c.env);
        const supabaseAdmin = getSupabaseAdmin(c.env);

        const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(adminEmail).catch(() => ({ data: null }));

        const { data: newCompany, error: companyError } = await supabase
            .from('companies')
            .insert([{ name: companyName, email: companyEmail, phone: companyPhone, address: companyAddress, website: companyWebsite, description: companyDescription }])
            .select().single();

        if (companyError) return c.json({ message: 'Failed to create company', error: companyError.message }, 400);

        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: adminEmail, password: adminPassword, email_confirm: true, user_metadata: { name: adminName }
        });

        if (authError) {
            await supabase.from('companies').delete().eq('id', newCompany.id);
            return c.json({ message: 'Failed to create admin auth user', error: authError.message }, 400);
        }

        const { data: userRecord, error: userError } = await supabase
            .from('users')
            .insert([{ id: authUser.user.id, email: adminEmail, name: adminName, platform_role: 'admin', company_id: newCompany.id }])
            .select().single();

        if (userError) {
            await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
            await supabase.from('companies').delete().eq('id', newCompany.id);
            return c.json({ message: 'Failed to create user record', error: userError.message }, 400);
        }

        // Seed default templates for the new company
        await seedCompanyTemplates(supabase, newCompany.id);

        return c.json({ message: 'Company and Admin created successfully', company: newCompany, user: userRecord }, 201);
    } catch (error) {
        return c.json({ message: 'Internal Server Error', error: error.message }, 500);
    }
};

export const getOnboardingRequests = async (c) => {
    try {
        const { status } = c.req.query();
        const supabase = getSupabase(c.env);

        let query = supabase.from('onboarding_requests').select('*').order('created_at', { ascending: false });
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
            query = query.eq('status', status);
        }

        const { data: requests, error } = await query;
        if (error) throw error;

        return c.json(requests, 200);
    } catch (error) {
        return c.json({ message: 'Error fetching onboarding requests', error: error.message }, 500);
    }
};

export const approveOnboardingRequest = async (c) => {
    try {
        const id = c.req.param('id');
        const supabase = getSupabase(c.env);
        const supabaseAdmin = getSupabaseAdmin(c.env);

        const { data: request, error: fetchError } = await supabase
            .from('onboarding_requests').select('*').eq('id', id).single();

        if (fetchError || !request) return c.json({ message: 'Onboarding request not found' }, 404);
        if (request.status !== 'pending') return c.json({ message: `This request has already been ${request.status}` }, 400);

        const tempPassword = generateTempPassword();

        const { data: newCompany, error: companyError } = await supabase
            .from('companies')
            .insert([{
                name: request.company_name, email: request.company_email, phone: request.company_phone, address: request.company_address, website: request.company_website,
                description: request.description, industry: request.industry, team_size: request.team_size, purpose: request.purpose,
            }])
            .select().single();

        if (companyError) return c.json({ message: 'Failed to create company', error: companyError.message }, 400);

        // Check if user already exists in Supabase Auth (e.g., they used Google)
        let authUser;
        let isNewAuthUser = false;

        // Note: getUserByEmail might not be available in all versions of the client,
        // so we list and find as a fallback or if it's cleaner.
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users.find(u => u.email === request.contact_email);

        if (existingUser) {
            authUser = { user: existingUser };
        } else {
            const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email: request.contact_email, password: tempPassword, email_confirm: true,
                user_metadata: { name: request.contact_name }
            });

            if (authError) {
                await supabase.from('companies').delete().eq('id', newCompany.id);
                return c.json({ message: 'Failed to create admin user', error: authError.message }, 400);
            }
            authUser = newAuthUser;
            isNewAuthUser = true;
        }

        const { data: userRecord, error: userError } = await supabase
            .from('users')
            .insert([{
                id: authUser.user.id,
                email: request.contact_email,
                name: request.contact_name,
                platform_role: 'admin',
                company_id: newCompany.id,
                login_count: 0
            }])
            .select().single();

        if (userError) {
            if (isNewAuthUser) await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
            await supabase.from('companies').delete().eq('id', newCompany.id);
            return c.json({ message: 'Failed to create user record', error: userError.message }, 400);
        }

        await supabase.from('companies').update({ admin_id: authUser.user.id }).eq('id', newCompany.id);

        // Seed default templates for the new company
        await seedCompanyTemplates(supabase, newCompany.id);

        await supabase.from('onboarding_requests').update({
            status: 'approved', reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', id);

        try {
            // Only send confirmation email with password if we created a new password-based user
            if (isNewAuthUser) {
                await sendConfirmationEmail(request.contact_email, request, tempPassword, c.env);
            } else {
                // For Google users, just send a welcome email without password
                await sendEmail(request.contact_email, '🏢 Welcome to FMS - Your request is approved!', `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #4361ee;">Welcome to FMS!</h2>
                        <p>Hi ${request.contact_name},</p>
                        <p>Your registration request for <strong>${request.company_name}</strong> has been approved.</p>
                        <p>Since you registered using Google, you can now log in directly using your Google account.</p>
                        <div style="margin: 30px 0;">
                            <a href="${c.env.FRONTEND_URL}/login" style="background-color: #4361ee; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Login to Dashboard</a>
                        </div>
                    </div>
                `, c.env);
            }
        } catch (emailError) { console.error('Failed to send welcome email:', emailError); }

        return c.json({ message: 'Request approved. Company and admin created successfully.', company: newCompany, user: userRecord }, 200);

    } catch (error) {
        return c.json({ message: 'Internal Server Error', error: error.message }, 500);
    }
};

export const rejectOnboardingRequest = async (c) => {
    try {
        const id = c.req.param('id');
        const { rejection_reason } = await c.req.json();

        const supabase = getSupabase(c.env);

        const { data: request, error: fetchError } = await supabase
            .from('onboarding_requests').select('*').eq('id', id).single();

        if (fetchError || !request) return c.json({ message: 'Onboarding request not found' }, 404);
        if (request.status !== 'pending') return c.json({ message: `This request has already been ${request.status}` }, 400);

        const { error: updateError } = await supabase
            .from('onboarding_requests')
            .update({
                status: 'rejected', rejection_reason: rejection_reason || 'No reason provided',
                reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            }).eq('id', id);

        if (updateError) return c.json({ message: 'Failed to reject request', error: updateError.message }, 500);

        try {
            await sendRejectionEmail(request.contact_email, request, rejection_reason, c.env);
        } catch (emailError) { console.error('Failed to send rejection email:', emailError); }

        return c.json({ message: 'Request has been rejected successfully.' }, 200);
    } catch (error) {
        return c.json({ message: 'Internal Server Error', error: error.message }, 500);
    }
};

export const companydetailsbyid = async (c) => {
    try {
        const id = c.req.param('id');
        const supabase = getSupabase(c.env);
        const { data: company, error } = await supabase
            .from('companies').select('*').eq('id', id).single();
        if (error) return c.json({ message: 'Company not found' }, 404);

        const [
            { count: usersCount }, { count: tasksCount }, { count: instancesCount }, { count: templatesCount }
        ] = await Promise.all([
            supabase.from('users').select('*', { count: 'exact', head: true }).eq('company_id', id),
            supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('company_id', id),
            supabase.from('instances').select('*', { count: 'exact', head: true }).eq('company_id', id),
            supabase.from('projects').select('*', { count: 'exact', head: true }).eq('company_id', id)
        ]);

        const companyStats = {
            ...company,
            stats: { totalUsers: usersCount || 0, totalTasks: tasksCount || 0, totalInstances: instancesCount || 0, totalTemplates: templatesCount || 0 }
        };

        return c.json(companyStats, 200);
    } catch (error) {
        return c.json({ message: 'Internal Server Error', error: error.message }, 500);
    }
}

export const getCompanyUsers = async (c) => {
    try {
        const id = c.req.param('id');
        const supabase = getSupabase(c.env);
        const { data, error } = await supabase.from("users").select("*").eq("company_id", id).order("created_at", { ascending: false });

        if (error) return c.json({ message: error.message }, 400);
        return c.json({ data, count: data.length }, 200);
    } catch (error) {
        return c.json({ message: 'Error fetching users', error: error.message }, 500);
    }
};

export const getSuperAdminStats = async (c) => {
    try {
        const supabase = getSupabase(c.env);

        const { data, error } = await supabase.rpc('get_superadmin_dashboard_stats');

        if (error) throw error;

        return c.json({
            total_companies: data?.total_companies || 0,
            pending_requests: data?.pending_requests || 0,
            total_users: data?.total_users || 0,
            total_templates: data?.total_templates || 0,
            total_tasks: data?.total_tasks || 0,
            total_instances: data?.total_instances || 0,
            last_updated: new Date().toISOString()
        }, 200);
    } catch (error) {
        return c.json({ message: 'Error fetching Super Admin stats', error: error.message }, 500);
    }
};

export const getSACompanyProjects = async (c) => {
    try {
        const companyId = c.req.param('id');
        const { page = 1, limit = 10, search, type, status, category, sortBy } = c.req.query();
        const supabase = getSupabase(c.env);

        let query = supabase.from('projects').select('*, clients(name)', { count: 'exact' });
        if (companyId === 'global' || companyId === 'null') {
            query = query.is('company_id', null);
        } else {
            query = query.eq('company_id', companyId);
        }

        if (search) query = query.ilike('name', `%${search}%`);
        if (type && type !== 'all') query = query.eq('type', type);
        if (status && status !== 'all') query = query.eq('status', status);
        if (category && category !== 'all') query = query.eq('category', category);

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;
        query = query.range(from, to);

        if (sortBy === 'recently_created') query = query.order('created_at', { ascending: false });
        else if (sortBy === 'recently_updated') query = query.order('updated_at', { ascending: false });
        else if (sortBy === 'name_asc') query = query.order('name', { ascending: true });
        else if (sortBy === 'name_desc') query = query.order('name', { ascending: false });
        else query = query.order('created_at', { ascending: false });

        const { data, count, error } = await query;
        if (error) throw error;

        const formatted = (data || []).map(p => ({ ...p, client_name: p.clients?.name || null }));
        return c.json({ data: formatted, count, page: pageNum, totalPages: Math.ceil((count || 0) / limitNum) }, 200);
    } catch (error) {
        return c.json({ message: 'Error fetching projects', error: error.message }, 500);
    }
};

export const getSACompanyClients = async (c) => {
    try {
        const companyId = c.req.param('id');
        const { page = 1, limit = 10, search } = c.req.query();
        const supabase = getSupabase(c.env);

        let query = supabase.from('clients').select('*', { count: 'exact' }).eq('company_id', companyId);

        if (search) query = query.ilike('name', `%${search}%`);

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;
        query = query.range(from, to).order('created_at', { ascending: false });

        const { data, count, error } = await query;
        if (error) throw error;

        return c.json({ data: data || [], pagination: { totalCount: count || 0, totalPages: Math.ceil((count || 0) / limitNum), page: pageNum, limit: limitNum } }, 200);
    } catch (error) {
        return c.json({ message: 'Error fetching clients', error: error.message }, 500);
    }
};

export const getSACompanyTasks = async (c) => {
    try {
        const companyId = c.req.param('id');
        const { page = 1, limit = 20 } = c.req.query();
        const supabase = getSupabase(c.env);

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;

        const { data, count, error } = await supabase
            .from('tasks')
            .select('*', { count: 'exact' })
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;
        return c.json({ data: data || [], count, page: pageNum, totalPages: Math.ceil((count || 0) / limitNum) }, 200);
    } catch (error) {
        return c.json({ message: 'Error fetching tasks', error: error.message }, 500);
    }
};

export const impersonateUser = async (c) => {
    try {
        const targetUserId = c.req.param('id');
        const supabase = getSupabase(c.env);

        // Fetch target user profile
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', targetUserId)
            .maybeSingle();

        if (profileError || !profile) {
            return c.json({ message: 'User not found' }, 404);
        }

        // Fetch permissions if they are a controller
        if (profile.platform_role === 'controller') {
            const { data: permissions } = await supabase
                .from("controller_permissions")
                .select("*")
                .eq("user_id", targetUserId);
            profile.permissions = permissions || [];
        }

        return c.json({
            message: 'Impersonation data fetched',
            userData: profile
        }, 200);
    } catch (error) {
        return c.json({ message: 'Error fetching impersonation data', error: error.message }, 500);
    }
};

async function seedCompanyTemplates(supabase, companyId) {
    try {
        // 1. Fetch all global templates (projects where company_id is null)
        const { data: globalProjects, error: projectsError } = await supabase
            .from('projects')
            .select('*')
            .is('company_id', null);

        if (projectsError) {
            console.error('Error fetching global projects:', projectsError);
            return;
        }

        // 2. If no global templates exist, seed the initial default templates first
        if (!globalProjects || globalProjects.length === 0) {
            await seedInitialGlobalTemplates(supabase);
            // Re-run the seeding function to copy the newly seeded global templates
            return seedCompanyTemplates(supabase, companyId);
        }

        // 3. Duplicate each global template for the new company
        for (const gp of globalProjects) {
            const { data: newProject, error: newProjectError } = await supabase
                .from('projects')
                .insert({
                    company_id: companyId,
                    name: gp.name,
                    description: gp.description,
                    status: 'active',
                    type: gp.type,
                    category: gp.category,
                    start_date: gp.start_date
                })
                .select()
                .single();

            if (newProjectError) {
                console.error(`Failed to copy global project ${gp.id}:`, newProjectError);
                continue;
            }

            // Fetch template tasks for this global project
            const { data: globalTasks, error: tasksError } = await supabase
                .from('template_tasks')
                .select('*')
                .eq('project_id', gp.id);

            if (tasksError) {
                console.error(`Failed to fetch tasks for global project ${gp.id}:`, tasksError);
                continue;
            }

            for (const gt of globalTasks) {
                // Copy task
                const { data: newTask, error: newTaskError } = await supabase
                    .from('template_tasks')
                    .insert({
                        project_id: newProject.id,
                        company_id: companyId,
                        title: gt.title,
                        description: gt.description,
                        step_order: gt.step_order,
                        estimated_minutes: gt.estimated_minutes,
                        approval_required: gt.approval_required,
                        assigned_role: gt.assigned_role,
                        approval_levels: gt.approval_levels,
                        turnaround_minutes: gt.turnaround_minutes
                    })
                    .select()
                    .single();

                if (newTaskError) {
                    console.error(`Failed to copy global task ${gt.id}:`, newTaskError);
                    continue;
                }

                // Fetch checklist items for this global task
                const { data: globalChecklist, error: checklistError } = await supabase
                    .from('template_task_checklist_items')
                    .select('*')
                    .eq('template_task_id', gt.id);

                if (checklistError) {
                    console.error(`Failed to fetch checklist for global task ${gt.id}:`, checklistError);
                    continue;
                }

                const newChecklist = globalChecklist.map(gc => ({
                    template_task_id: newTask.id,
                    company_id: companyId,
                    item_text: gc.item_text,
                    sort_order: gc.sort_order,
                    requires_input: gc.requires_input,
                    input_label: gc.input_label,
                    input_placeholder: gc.input_placeholder
                }));

                if (newChecklist.length > 0) {
                    const { error: insertChecklistError } = await supabase
                        .from('template_task_checklist_items')
                        .insert(newChecklist);

                    if (insertChecklistError) {
                        console.error(`Failed to insert checklist items for task ${newTask.id}:`, insertChecklistError);
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error in seedCompanyTemplates:', err);
    }
}

async function seedInitialGlobalTemplates(supabase) {
    try {
        console.log('Seeding initial global templates...');
        const templates = [
            {
                project: {
                    name: 'Email Marketing Campaign',
                    description: 'Predefined template for managing an end-to-end email marketing campaign.',
                    type: 'one-time',
                    category: 'Email Marketing'
                },
                tasks: [
                    {
                        title: 'Email Copy',
                        description: 'Write email subject lines, body copy, and A/B test details.',
                        step_order: 1,
                        estimated_minutes: 60,
                        turnaround_minutes: 960,
                        approval_required: true,
                        approval_levels: 1,
                        assigned_role: 'copywriter',
                        checklist: [
                            { item_text: 'A/B test details included (Include a dedicated column for A/B testing. If any part of the email is being tested (e.g., subject line, CTA, content variation), it should be clearly reflected in the copy.)', requires_input: false },
                            { item_text: 'Personalization done in subject line', requires_input: false },
                            { item_text: 'Subject Line (60 characters)', requires_input: true, input_label: 'Subject Line' },
                            { item_text: 'Preview Text', requires_input: true, input_label: 'Preview Text' },
                            { item_text: 'Body: (Captures attention,- Clear and concise)', requires_input: false },
                            { item_text: 'Body: (Captures attention,- Clear and concise within 150 words)', requires_input: false },
                            { item_text: 'No of words in copy', requires_input: true, input_label: 'Screenshot Link: ' },
                            { item_text: 'Target Segment Defined Before Copywriting (Messaging aligned to the defined segment.)', requires_input: false },
                            { item_text: 'CTA used in Hero Image', requires_input: false },
                            { item_text: 'CTAs used in Body', requires_input: false },
                            { item_text: 'CTA matches the content', requires_input: false },
                            { item_text: 'Value Proposition(Communicates benefits, Compelling and relevant)', requires_input: false },
                            { item_text: 'Promo code added in the hero image', requires_input: false },
                            { item_text: 'Promo code added in email body', requires_input: false },
                            { item_text: 'Signature in the end', requires_input: false },
                            { item_text: 'Personalization in content', requires_input: false },
                            { item_text: 'Tone and Voice(Friendly and conversational) (sapling,logic balls) according to the brand', requires_input: true, input_label: 'Screenshot Link: ' },
                            { item_text: 'Grammar and Spelling(Proofread for errors,Accurate spelling,Proper punctuation)', requires_input: true, input_label: 'Screenshot Link: ' },
                            { item_text: 'Conduct a final review and obtain approval before sending.', requires_input: false },
                            { item_text: 'Smooth, natural sentence flow ( The email should read naturally with a smooth, logical flow. Avoid broken or fragmented sentences.)', requires_input: false }
                        ]
                    },
                    {
                        title: 'Email Design',
                        description: 'Design responsive HTML email template and verify brand colors.',
                        step_order: 2,
                        estimated_minutes: 90,
                        turnaround_minutes: 960,
                        approval_required: true,
                        approval_levels: 2,
                        assigned_role: 'designer',
                        checklist: [
                            { item_text: 'Conduct a final review and obtain approval before sending.', requires_input: false },
                            { item_text: 'Emotion-based hero image (necessary in B2C)', requires_input: false },
                            { item_text: 'Emotion-based hero image (not necessary in B2B)', requires_input: false },
                            { item_text: 'Header image with navigation bar', requires_input: false },
                            { item_text: 'Check brand guidlines color', requires_input: false },
                            { item_text: 'CTA should be in visible without first scroll', requires_input: false },
                            { item_text: 'Thoroughly match each and every word from the email copy', requires_input: false },
                            { item_text: 'Make Sure Only the First Letter of Word is capitalised for headings.', requires_input: false },
                            { item_text: 'Ensure Only First letter of the sentence is capitalised in rest of the copy.', requires_input: false },
                            { item_text: 'Chat-GPT  review & rating of design', requires_input: false },
                            { item_text: 'Verify content consistency with the written part.', requires_input: false },
                            { item_text: 'Check for spelling errors.', requires_input: false },
                            { item_text: 'Ensure correct grammar', requires_input: false },
                            { item_text: 'Topic and content should be matching', requires_input: false },
                            { item_text: 'Maintain text hierarchy', requires_input: false },
                            { item_text: 'Font Readibility', requires_input: false },
                            { item_text: 'Confirm colors are consistent with the brand\'s style guide.', requires_input: false },
                            { item_text: 'Does Call-to-Action (CTA) stands out and is attention grabbing', requires_input: false },
                            { item_text: 'Promo code should be visible in the hero image', requires_input: false },
                            { item_text: 'Promo code added in email body', requires_input: false }
                        ]
                    },
                    {
                        title: 'Frame message for design',
                        description: 'Frame the message details for the client review.',
                        step_order: 3,
                        estimated_minutes: 30,
                        turnaround_minutes: 960,
                        approval_required: true,
                        approval_levels: 2,
                        assigned_role: 'manager',
                        checklist: []
                    },
                    {
                        title: 'Give Slices',
                        description: 'Slice the HTML design for testing.',
                        step_order: 4,
                        estimated_minutes: 30,
                        turnaround_minutes: 960,
                        approval_required: true,
                        approval_levels: 1,
                        assigned_role: 'designer',
                        checklist: []
                    },
                    {
                        title: 'Implement Slices and send testing email',
                        description: 'Implement slices in the email platform and trigger a test email.',
                        step_order: 5,
                        estimated_minutes: 45,
                        turnaround_minutes: 480,
                        approval_required: true,
                        approval_levels: 1,
                        assigned_role: 'developer',
                        checklist: []
                    },
                    {
                        title: 'Deployment and schedule',
                        description: 'Schedule campaign deployment and verify target list segments.',
                        step_order: 6,
                        estimated_minutes: 30,
                        turnaround_minutes: 480,
                        approval_required: true,
                        approval_levels: 1,
                        assigned_role: 'marketer',
                        checklist: [
                            { item_text: 'Client Name', requires_input: true, input_label: 'Client Name' },
                            { item_text: 'Client approved email for deployment', requires_input: false },
                            { item_text: 'Campaign Name', requires_input: true, input_label: 'Campaign Name' },
                            { item_text: 'Sending test campaign to team', requires_input: true },
                            { item_text: 'Personalization done in subject line', requires_input: true },
                            { item_text: 'Smart Sending is enabled', requires_input: true },
                            { item_text: 'Subject Line (60 characters)', requires_input: true, input_label: 'Subject Line' },
                            { item_text: 'Preview Text', requires_input: true, input_label: 'Preview Text' },
                            { item_text: 'Feedback from client reg subject and preview', requires_input: true, input_label: 'Feedback' },
                            { item_text: 'Lists Name', requires_input: true },
                            { item_text: 'Excluded Segment', requires_input: true },
                            { item_text: 'Segment Name', requires_input: true },
                            { item_text: 'Total no. of contacts', requires_input: true, input_label: 'Total' },
                            { item_text: 'Link Check (Desktop)', requires_input: true },
                            { item_text: 'Link Check (Mobile)', requires_input: true },
                            { item_text: 'Account Manager Approval', requires_input: true },
                            { item_text: 'Campaign Schedule Time', requires_input: true },
                            { item_text: 'Schedule in application', requires_input: true },
                            { item_text: 'Deliverability score', requires_input: true },
                            { item_text: 'utm parameters', requires_input: true },
                            { item_text: 'A/B testing', requires_input: true }
                        ]
                    }
                ]
            },
            {
                project: {
                    name: 'Video Editing Workflow',
                    description: 'Predefined workflow for professional video editing companies. Cover all stages from sorting raw footage to final client delivery.',
                    type: 'one-time',
                    category: 'Video Editing'
                },
                tasks: [
                    {
                        title: 'Footage Sorting & Syncing',
                        description: 'Organize raw footage bins, sync audio/video tracks, and flag bad footage.',
                        step_order: 1,
                        estimated_minutes: 60,
                        turnaround_minutes: 240,
                        approval_required: false,
                        assigned_role: 'editor',
                        checklist: [
                            { item_text: 'Sync audio and video tracks', requires_input: false },
                            { item_text: 'Organize A-roll and B-roll into folders', requires_input: false },
                            { item_text: 'Flag blurry or unusable footage', requires_input: false }
                        ]
                    },
                    {
                        title: 'Rough Cut Drafting',
                        description: 'Assemble storyline, select soundtrack, and construct first draft.',
                        step_order: 2,
                        estimated_minutes: 180,
                        turnaround_minutes: 480,
                        approval_required: false,
                        assigned_role: 'editor',
                        checklist: [
                            { item_text: 'Assemble storyline on timeline', requires_input: false },
                            { item_text: 'Select appropriate soundtrack', requires_input: false },
                            { item_text: 'Apply pacing guidelines', requires_input: false }
                        ]
                    },
                    {
                        title: 'Review & Rough Cut Approval',
                        description: 'Director checks pacing, narrative flow, and music choice.',
                        step_order: 3,
                        estimated_minutes: 30,
                        turnaround_minutes: 240,
                        approval_required: true,
                        approval_levels: 1,
                        assigned_role: 'director',
                        checklist: [
                            { item_text: 'Storyline flow review', requires_input: false },
                            { item_text: 'Pacing review', requires_input: false }
                        ]
                    },
                    {
                        title: 'Color Grading & Audio Mixing',
                        description: 'Color correction, dialog volume balancing, and sound design.',
                        step_order: 4,
                        estimated_minutes: 120,
                        turnaround_minutes: 480,
                        approval_required: false,
                        assigned_role: 'editor',
                        checklist: [
                            { item_text: 'Color correct all clips', requires_input: false },
                            { item_text: 'Balance dialogue levels', requires_input: false },
                            { item_text: 'Add transitions and sound effects', requires_input: false }
                        ]
                    },
                    {
                        title: 'Final Export & Delivery',
                        description: 'Render final cut, generate captions, and upload.',
                        step_order: 5,
                        estimated_minutes: 45,
                        turnaround_minutes: 120,
                        approval_required: false,
                        assigned_role: 'editor',
                        checklist: [
                            { item_text: 'Export in 4K H.264 format', requires_input: false },
                            { item_text: 'Generate subtitles/captions', requires_input: true, input_label: 'SRT File Link' },
                            { item_text: 'Upload video to delivery folder', requires_input: true, input_label: 'Video Link' }
                        ]
                    }
                ]
            }
        ];

        for (const t of templates) {
            // Insert project
            const { data: proj, error: projErr } = await supabase
                .from('projects')
                .insert({
                    company_id: null,
                    name: t.project.name,
                    description: t.project.description,
                    status: 'active',
                    type: t.project.type,
                    category: t.project.category
                })
                .select()
                .single();

            if (projErr) {
                console.error('Error inserting global project seed:', projErr);
                continue;
            }

            for (const task of t.tasks) {
                // Insert task
                const { data: tTask, error: tTaskErr } = await supabase
                    .from('template_tasks')
                    .insert({
                        project_id: proj.id,
                        company_id: null,
                        title: task.title,
                        description: task.description,
                        step_order: task.step_order,
                        estimated_minutes: task.estimated_minutes,
                        turnaround_minutes: task.turnaround_minutes,
                        approval_required: task.approval_required,
                        assigned_role: task.assigned_role,
                        approval_levels: task.approval_levels || 1
                    })
                    .select()
                    .single();

                if (tTaskErr) {
                    console.error('Error inserting global template task seed:', tTaskErr);
                    continue;
                }

                if (task.checklist && task.checklist.length > 0) {
                    const checklistRows = task.checklist.map((item, idx) => ({
                        template_task_id: tTask.id,
                        company_id: null,
                        item_text: item.item_text,
                        sort_order: idx,
                        requires_input: item.requires_input,
                        input_label: item.input_label || null,
                        input_placeholder: item.input_placeholder || null
                    }));

                    const { error: chkErr } = await supabase
                        .from('template_task_checklist_items')
                        .insert(checklistRows);

                    if (chkErr) {
                        console.error('Error inserting global checklist seed:', chkErr);
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error in seedInitialGlobalTemplates:', err);
    }
}

