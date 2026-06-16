'use client';

import { useState } from 'react';
import {
    Button,
    Input,
    Label,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { Mail, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const { addToast } = useToast();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!email) {
            addToast({
                title: 'Missing email',
                description: 'Please enter your email address.',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await api.post('/forgot-password', { email });
            setSuccess(true);
            addToast({
                title: 'Email Sent',
                description: 'Check your email for a 6-digit verification code.',
                variant: 'success',
            });
            setTimeout(() => {
                router.push(`/reset-password?email=${encodeURIComponent(email)}`);
            }, 1000);
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to send reset email. Please try again.';
            setError(errorMessage);
            addToast({
                title: 'Request failed',
                description: errorMessage,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            {/* Decorative background elements */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
                <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Forgot Password
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Enter your email to receive a reset link
                    </p>
                </div>

                <Card className="border-border/60 shadow-xl shadow-black/5">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Reset Password</CardTitle>
                        <CardDescription>
                            We'll send a password reset link to your email.
                        </CardDescription>
                    </CardHeader>

                    {!success ? (
                        <form onSubmit={handleSubmit}>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <div className="relative">
                                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="you@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="pl-10"
                                            autoComplete="email"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                        {error}
                                    </div>
                                )}
                            </CardContent>

                            <CardFooter className="flex-col gap-4 pt-2">
                                <Button
                                    type="submit"
                                    className="w-full"
                                    loading={loading}
                                    disabled={loading}
                                >
                                    {loading ? 'Sending link…' : 'Send Reset Link'}
                                </Button>
                                <Button
                                    variant="link"
                                    className="w-full text-sm font-normal text-muted-foreground hover:text-foreground"

                                >
                                    <Link href="/login" className="flex items-center justify-center gap-2">
                                        <ArrowLeft className="h-4 w-4" />
                                        Back to Login
                                    </Link>
                                </Button>
                            </CardFooter>
                        </form>
                    ) : (
                        <>
                            <CardContent className="space-y-4 pt-4 pb-8 text-center">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/20 text-success">
                                    <Mail className="h-8 w-8" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground">Check your email</h3>
                                <p className="text-sm text-muted-foreground">
                                    We have sent a 6-digit verification code to <strong>{email}</strong>. Redirecting...
                                </p>
                            </CardContent>
                            <CardFooter>
                                <Button
                                    className="w-full"
                                    variant="outline"

                                >
                                    <Link href="/login">
                                        Return to Login
                                    </Link>
                                </Button>
                            </CardFooter>
                        </>
                    )}
                </Card>
            </div>
        </div>
    );
}
