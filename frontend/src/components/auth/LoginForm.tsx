'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/zustand/user/user';
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
import { LogIn, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface LoginFormProps {
    setShowLogin?: (show: boolean) => void;
    onclose?: () => void;
    openRegister?: () => void;
    isModal?: boolean;
}

export function LoginForm({ setShowLogin, onclose, openRegister, isModal = false }: LoginFormProps) {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const { login, signInWithGoogle, loading, error, user } = useAuthStore();

    const { addToast } = useToast();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!email || !password) {
            addToast({
                title: 'Missing fields',
                description: 'Please fill all the fields.',
                variant: 'destructive',
            });
            return;
        }

        const success = await login(email, password);

        if (success) {
            addToast({
                title: 'Welcome back!',
                description: 'You have been logged in successfully.',
                variant: 'success',
            });

            // Set onboarding flag in sessionStorage BEFORE redirect.
            // Only show on first login (when login_count is 1 after increment)
            const currentUser = useAuthStore.getState().user;
            if (currentUser && currentUser.login_count === 1) {
                sessionStorage.setItem('fms-show-onboarding', 'true');
            }

            router.refresh();          // force middleware to re-read the fresh cookie
            router.push('/dashboard');
            onclose?.();
        } else {
            addToast({
                title: 'Login failed',
                description: error || 'Invalid email or password. Please try again.',
                variant: 'destructive',
            });
        }
    };

    const handleRegister = () => {
        if (isModal && openRegister) {
            openRegister();
        } else {
            router.push('/register');
        }
    }

    return (
        <div className={cn(
            "flex items-center justify-center px-4 transition-all duration-300 ",
            !isModal ? "min-h-screen bg-background" : "bg-transparent p-4"
        )}>
            {/* Decorative background elements - only show if not in modal */}
            {!isModal && (
                <div className="pointer-events-none fixed inset-0 overflow-hidden">
                    <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
                    <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
                </div>
            )}

            <div className={cn("relative w-full", isModal ? "max-w-full" : "max-w-md")}>
                {/* Logo / Brand */}
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Welcome to FMS
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Sign in to your account to continue
                    </p>
                </div>

                {/* Login Card */}
                <Card className={cn(
                    "border-border/60 shadow-xl shadow-black/5",
                    isModal && "border-none shadow-none bg-transparent"
                )}>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Sign In</CardTitle>
                        <CardDescription>
                            Enter your credentials below
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
                                        autoComplete="email"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                    <Link
                                        href="/forgot-password"
                                        className="text-xs text-primary hover:underline underline-offset-4"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10 pr-10"
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                        {showPassword ? (
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

                        <CardFooter className="flex flex-col gap-4 pt-2">
                            <Button
                                type="submit"
                                className="w-full"
                                loading={loading}
                            >
                                {loading ? 'Signing in…' : 'Sign In'}
                            </Button>

                            <div className="relative w-full">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-border" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-card px-2 text-muted-foreground">or</span>
                                </div>
                            </div>

                            <Button
                                type="button"
                                className="w-full"
                                variant='outline'
                                onClick={handleRegister}
                            >
                                Register Your Organisation
                            </Button>
                        </CardFooter>
                    </form>


                    <Button
                        type="button"
                        onClick={async () => {
                            setGoogleLoading(true);
                            try {
                                await signInWithGoogle();
                            } catch (err) {
                                setGoogleLoading(false);
                            }
                        }}
                        loading={googleLoading}
                        className="flex items-center justify-center gap-3 px-5 py-3 w-full rounded-xl border border-gray-300 bg-white text-gray-700 font-medium shadow-sm hover:shadow-md hover:bg-gray-50 transition-all duration-200"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 48 48"
                            className="w-5 h-5 shrink-0"
                        >
                            <path
                                fill="#FFC107"
                                d="M43.611 20.083H42V20H24v8h11.303C33.659 32.657 29.21 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                            />
                            <path
                                fill="#FF3D00"
                                d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
                            />
                            <path
                                fill="#4CAF50"
                                d="M24 44c5.166 0 9.86-1.977 13.409-5.193l-6.19-5.238C29.165 35.091 26.715 36 24 36c-5.19 0-9.63-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
                            />
                            <path
                                fill="#1976D2"
                                d="M43.611 20.083H42V20H24v8h11.303c-1.064 3.104-3.338 5.615-6.084 7.091l.003-.002 6.19 5.238C33.971 42.091 44 36 44 24c0-1.341-.138-2.65-.389-3.917z"
                            />
                        </svg>

                        Continue with Google
                    </Button>
                </Card>

                {/* Footer */}
                <p className="mt-6 text-center text-xs text-muted-foreground">
                    By signing in, you agree to our{' '}
                    <span className="underline underline-offset-4 hover:text-foreground cursor-pointer">
                        Terms of Service
                    </span>{' '}
                    and{' '}
                    <span className="underline underline-offset-4 hover:text-foreground cursor-pointer">
                        Privacy Policy
                    </span>
                </p>
            </div>
        </div >
    );
}
