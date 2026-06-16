import api from '../api';

export interface AskAiResponse {
    success: boolean;
    fallbackRequired: boolean;
    reply: string | null;
    error?: string;
}

export interface SupportEmailResponse {
    success: boolean;
    message?: string;
    error?: string;
}

/**
 * Sends a question to the AI Support Guide, including conversation history.
 */
export const askAiGuide = async (message: string, role: string, docsContext: string, recentHistory: any[] = []): Promise<AskAiResponse> => {
    try {
        const response = await api.post('/ai-support/ask', {
            message,
            role,
            docsContext,
            recentHistory,
        });
        return response.data;
    } catch (error: any) {
        console.error('Ask AI API error:', error);
        return {
            success: false,
            fallbackRequired: false,
            reply: null,
            error: error?.response?.data?.error || 'Failed to connect to AI Guide',
        };
    }
};

/**
 * Triggers the backend to send a fallback support email.
 */
export const sendSupportEmail = async (message: string): Promise<SupportEmailResponse> => {
    try {
        const response = await api.post('/ai-support/email', {
            message,
        });
        return response.data;
    } catch (error: any) {
        console.error('Support Email API error:', error);
        return {
            success: false,
            error: error?.response?.data?.error || 'Failed to send support request',
        };
    }
};
