'use client';

import { useState, useEffect, Suspense } from 'react';
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
import { Lock, Eye, EyeOff, CheckCircle, KeyRound, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        const query = window.location.search;
        if (query) {
            const params = new URLSearchParams(query);
            const queryEmail = params.get('email');
            if (queryEmail) {
                setEmail(queryEmail);
                window.history.replaceState(null, '', window.location.pathname);
            }
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!email || !otp || !password || !confirmPassword) {
            addToast({
                title: 'Missing fields',
                description: 'Please fill out all fields.',
                variant: 'destructive',
            });
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters long");
            return;
        }

        if (otp.length !== 6) {
            setError("Verification code must be 6 digits");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await api.post('/reset-password', {
                email,
                otp,
                newPassword: password
            });

            setSuccess(true);
            addToast({
                title: 'Password updated',
                description: 'Your password has been successfully updated.',
                variant: 'success',
            });

            // Redirect to landing after 3 seconds
            setTimeout(() => {
                router.push('/landing');
            }, 3000);

        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to reset password. The code might be expired.';
            setError(errorMessage);
            addToast({
                title: 'Reset failed',
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
                        Set New Password
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Enter your verification code and new password
                    </p>
                </div>

                <Card className="border-border/60 shadow-xl shadow-black/5">
                    {!success ? (
                        <>
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg">Reset Password</CardTitle>
                                <CardDescription>
                                    Check your email for the 6-digit code.
                                </CardDescription>
                            </CardHeader>

                            <form onSubmit={handleSubmit}>
                                <CardContent className="space-y-4">

                                    {/* Email Field */}
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
                                                readOnly={!!email}
                                            />
                                        </div>
                                    </div>

                                    {/* OTP Field */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label htmlFor="otp">Verification Code</Label>
                                            <Button variant="link" size="sm" type="button" className="h-auto p-0 text-xs" onClick={() => router.push('/forgot-password')}>Resend Code</Button>
                                        </div>
                                        <div className="relative">
                                            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                id="otp"
                                                type="text"
                                                placeholder="123456"
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value)}
                                                className="pl-10 text-center tracking-[0.5em] font-mono"
                                                maxLength={6}
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    {/* New Password Field */}
                                    <div className="space-y-2">
                                        <Label htmlFor="password">New Password</Label>
                                        <div className="relative">
                                            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                id="password"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="pl-10 pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                                tabIndex={-1}
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Confirm Password Field */}
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                                        <div className="relative">
                                            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                id="confirmPassword"
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="pl-10 pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                                tabIndex={-1}
                                            >
                                                {showConfirmPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Error Message */}
                                    {error && (
                                        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                            {error}
                                        </div>
                                    )}
                                </CardContent>

                                <CardFooter>
                                    <Button
                                        type="submit"
                                        className="w-full"
                                        loading={loading}
                                        disabled={loading}
                                    >
                                        {loading ? 'Updating…' : 'Verify & Update Password'}
                                    </Button>
                                </CardFooter>
                            </form>
                        </>
                    ) : (
                        <>
                            <CardContent className="space-y-4 pt-8 pb-8 text-center">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/20 text-success">
                                    <CheckCircle className="h-8 w-8" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground">Password Reset Complete</h3>
                                <p className="text-sm text-muted-foreground">
                                    Your password has been successfully updated. Redirecting to login...
                                </p>
                            </CardContent>
                            <CardFooter>
                                <Button
                                    className="w-full"
                                >
                                    <Link href="/landing">
                                        Go to Login Now
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
