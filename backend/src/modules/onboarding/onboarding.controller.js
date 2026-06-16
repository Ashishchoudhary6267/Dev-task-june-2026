import { getSupabase } from "../../config/supabase.js";
import { sendEmail } from "../../utils/email.js";

export const submitOnboardingRequest = async (c) => {
    try {
        const {
            company_name, company_email, company_phone, company_website, company_address,
            contact_name, contact_designation, contact_email, contact_phone,
            purpose, team_size, industry, description,
        } = await c.req.json();

        if (!company_name || !company_email || !company_phone ||
            !contact_name || !contact_designation || !contact_email || !contact_phone ||
            !purpose || !team_size) {
            return c.json({ message: 'Please fill all required fields.' }, 400);
        }

        const supabase = getSupabase(c.env);
        const { data: existingRequest, error: checkError } = await supabase
            .from('onboarding_requests')
            .select('id, status')
            .eq('contact_email', contact_email)
            .maybeSingle();

        if (checkError) return c.json({ message: 'Error checking existing requests', error: checkError.message }, 500);

        if (existingRequest) {
            if (existingRequest.status === 'pending') return c.json({ message: 'A registration request with this email is already pending review.' }, 409);
            if (existingRequest.status === 'approved') return c.json({ message: 'An account with this email already exists. Please login instead.' }, 409);
            if (existingRequest.status === 'rejected') await supabase.from('onboarding_requests').delete().eq('id', existingRequest.id);
        }

        const { data: existingUser } = await supabase.from('users').select('id').eq('email', contact_email).maybeSingle();
        if (existingUser) return c.json({ message: 'An account with this email already exists. Please login instead.' }, 409);

        const { data: newRequest, error: insertError } = await supabase
            .from('onboarding_requests')
            .insert([{
                company_name, company_email, company_phone, company_website: company_website || null, company_address: company_address || null,
                contact_name, contact_designation, contact_email, contact_phone, purpose, team_size, industry: industry || null, description: description || null, status: 'pending',
            }])
            .select().single();

        if (insertError) return c.json({ message: 'Failed to submit request', error: insertError.message }, 500);

        try {
            const superadminEmail = c.env.SUPERADMIN_EMAIL || process.env.SUPERADMIN_EMAIL;
            if (superadminEmail) {
                await sendEmail(superadminEmail, '🏢 New Company Registration Request - FMS', `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #4361ee;">New Onboarding Request</h2>
                        <p>A new company wants to register on FMS:</p>
                        <div style="background-color: #f4f4f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p><strong>Company:</strong> ${company_name}</p>
                            <p><strong>Contact Person:</strong> ${contact_name}</p>
                            <p><strong>Email:</strong> ${contact_email}</p>
                        </div>
                        <p>Please log in to the Super Admin Dashboard to review and approve/reject this request.</p>
                    </div>
                `, c.env);
            }
        } catch (emailError) { console.error('Failed to send superadmin notification email:', emailError); }

        try {
            if (contact_email) {
                await sendEmail(contact_email, '🏢 New Company Registration Request - FMS', `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #4361ee;">Your registration request has been submitted successfully.</h2>
                        <p>Thank you for registering on FMS. Our team will review your request and contact you shortly.</p>
                        <p>We will notify you once your request is approved.</p>
                    </div>
                `, c.env);
            }
        } catch (emailError) { console.error('Failed to send user notification email:', emailError); }

        try {
            const { data: superadmin } = await supabase.from('users').select('*').eq('platform_role', 'superadmin').maybeSingle();
            if (superadmin) {
                await supabase.from('notifications').insert({
                    user_id: superadmin.id, type: 'onboarding_request', title: 'New Onboarding Request',
                    message: `"${company_name}" has requested to register on FMS. Open your email or check the dashboard.`, task_id: null, instance_id: null,
                });
            }
        } catch (notifError) { console.error('Failed to send in-app notification:', notifError); }

        return c.json({ message: 'Your registration request has been submitted successfully. Our team will review it and contact you shortly.', request: newRequest }, 201);
    } catch (error) {
        return c.json({ message: 'Internal Server Error', error: error.message }, 500);
    }
};
