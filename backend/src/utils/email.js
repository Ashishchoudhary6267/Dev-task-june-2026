/**
 * Sends an email via Gmail REST API using OAuth2.
 * Works on Cloudflare Workers (no googleapis/nodemailer needed — pure fetch).
 */

async function getAccessToken(env) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: env.OAUTH_CLIENT_ID,
            client_secret: env.OAUTH_CLIENT_SECRET,
            refresh_token: env.OAUTH_REFRESH_TOKEN,
            grant_type: "refresh_token",
        }),
    });
    const data = await res.json();
    if (!data.access_token) throw new Error("Failed to get Gmail access token");
    return data.access_token;
}

function buildRawEmail(from, to, subject, html) {
    const boundary = "----=_Part_" + Math.random().toString(36).slice(2);
    // Encode the subject line to properly handle emojis (RFC 2047)
    const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;

    const message = [
        `From: FMS Application <${from}>`,
        `To: ${to}`,
        `Subject: ${encodedSubject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: text/html; charset=UTF-8`,
        `Content-Transfer-Encoding: base64`,
        ``,
        btoa(unescape(encodeURIComponent(html))),
        `--${boundary}--`,
    ].join("\r\n");

    return btoa(unescape(encodeURIComponent(message)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export const sendEmail = async (to, subject, html, env) => {
    try {
        const accessToken = await getAccessToken(env);
        const raw = buildRawEmail(env.OAUTH_EMAIL, to, subject, html);

        const res = await fetch(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ raw }),
            }
        );

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err?.error?.message || "Gmail API error");
        }

        const result = await res.json();
        console.log("Email sent:", result.id);
        return result;
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
};

export const sendPasswordResetEmail = async (to, otp, env) => {
    const subject = "Your Password Reset Code - FMS";
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>You recently requested to reset your password for your FMS account.</p>
            <p>Please use the following 6-digit code to complete the reset process:</p>
            <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
                <h1 style="color: #0066cc; margin: 0; letter-spacing: 5px;">${otp}</h1>
            </div>
            <p><strong>Note:</strong> This code is only valid for exactly <strong>2 minutes</strong>.</p>
            <p>If you did not request a password reset, please ignore this email or contact your administrator.</p>
            <br/>
            <p>Best regards,<br/>The FMS Team</p>
        </div>
    `;
    return sendEmail(to, subject, html, env);
};

export const sendConfirmationEmail = async (to, request, tempPassword, env) => {
    const subject = "🎉 Welcome to FMS - Your Account is Ready!";
    const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4361ee;">Welcome to FMS, ${request.contact_name}!</h2>
                    <p>Great news! Your company <strong>${request.company_name}</strong> has been approved and your admin account is now active.</p>
                    <div style="background-color: #f0f4ff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #c7d2fe;">
                        <h3 style="margin-top: 0; color: #4338ca;">Your Login Credentials</h3>
                        <p><strong>Email:</strong> ${request.contact_email}</p>
                        <p><strong>Temporary Password:</strong> ${tempPassword}</p>
                    </div>
                    <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fecaca;">
                        <p style="color: #991b1b; margin: 0;"><strong>⚠️ Important:</strong> Please change your password as soon as possible after your first login.</p>
                    </div>
                    <p>You can now log in and start managing your company on FMS.</p>
                    <br/>
                    <p>Best regards,<br/>The FMS Team</p>
                </div>`;
    return sendEmail(to, subject, html, env);
};

export const sendRejectionEmail = async (to, request, rejection_reason, env) => {
    const subject = "Your Company Request has been Rejected - FMS";
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Registration Update</h2>
            <p>Dear ${request.contact_name},</p>
            <p>Thank you for your interest in FMS. After reviewing your registration request for <strong>${request.company_name}</strong>, we are unable to approve it at this time.</p>
            ${rejection_reason ? `
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Reason:</strong> ${rejection_reason}</p>
            </div>
            ` : ""}
            <p>If you have any questions, please feel free to reach out to our team.</p>
            <br/>
            <p>Best regards,<br/>The FMS Team</p>
        </div>
    `;
    return sendEmail(to, subject, html, env);
};

export const sendAdminChangePasswordEmail = async (to, env) => {
    const subject = "Security Alert: Your Password has been Changed - FMS";
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Security Alert</h2>
            <p>This is to inform you that your password for your FMS account has been changed by an administrator.</p>
            <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fecaca;">
                <p style="color: #991b1b; margin: 0;"><strong>Important:</strong> If you were not aware of this change, please contact your administrator immediately.</p>
            </div>
            <p>Please contact your administrator to receive your new login credentials.</p>
            <br/>
            <p>Best regards,<br/>The FMS Team</p>
        </div>
    `;
    return sendEmail(to, subject, html, env);
};

export const sendSupportTicketEmail = async (userEmail, userName, message, env) => {
    // The email will be sent to the configured OAUTH_EMAIL (which acts as the support inbox)
    // and we'll mention the user's email in the body for follow-up.
    const to = env.OAUTH_EMAIL; // Alternatively env.SUPPORT_EMAIL if configured
    const subject = `AI Support Ticket: from ${userName || 'User'}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Support Request via AI Widget</h2>
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>From:</strong> ${userName || 'Unknown User'} (${userEmail})</p>
                <p><strong>Query:</strong></p>
                <p style="white-space: pre-wrap;">${message}</p>
            </div>
            <p>Please follow up with the user directly at <a href="mailto:${userEmail}">${userEmail}</a>.</p>
        </div>
    `;
    return sendEmail(to, subject, html, env);
};