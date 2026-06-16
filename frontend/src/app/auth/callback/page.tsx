'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/zustand/user/user';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
    const router = useRouter();
    const { checkGoogleLoginStatus } = useAuthStore();
    const [statusText, setStatusText] = useState('Verifying your session...');

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Give Supabase a tiny bit of time to parse the URL fragments/code
                await new Promise(resolve => setTimeout(resolve, 500));

                const result = await checkGoogleLoginStatus();
                console.log('Google login check result:', result);

                if (result.status === 'LOGGED_IN') {
                    // Redirect to dashboard if logged in
                    setStatusText('Success! Redirecting to dashboard...');
                    const user = useAuthStore.getState().user;
                    if (user && user.login_count <= 1) {
                        sessionStorage.setItem('fms-show-onboarding', 'true');
                    }
                    router.push('/dashboard');
                } else if (result.status === 'NOT_REGISTERED') {
                    // Redirect to register page with pre-fill data
                    setStatusText('New user detected. Redirecting to registration...');

                    // Store google user info in session storage to pre-fill the form
                    if (result.googleUser) {
                        sessionStorage.setItem('fms-google-user', JSON.stringify(result.googleUser));
                    }

                    router.push('/register?source=google');
                } else if (result.status === 'PENDING_APPROVAL') {
                    setStatusText('Your registration is pending approval. Redirecting...');
                    router.push('/auth/pending');
                } else if (result.status === 'DEACTIVATED') {
                    setStatusText('Account deactivated. Please contact support.');
                    router.push('/landing?error=deactivated');
                } else {
                    setStatusText('Authentication failed. Returning to login...');
                    router.push('/login?error=failed');
                }
            } catch (error) {
                console.error('Callback error:', error);
                router.push('/login?error=callback_error');
            }
        };

        handleCallback();
    }, [checkGoogleLoginStatus, router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <Card className="w-full max-w-md border-none shadow-none bg-transparent">
                <CardContent className="flex flex-col items-center space-y-4 pt-6">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <h2 className="text-xl font-semibold">{statusText}</h2>
                    <p className="text-sm text-muted-foreground text-center">
                        Please wait while we set up your secure session.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
