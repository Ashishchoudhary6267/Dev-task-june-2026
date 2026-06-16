'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter,
    Button
} from '@/components/ui';
import { Clock, ShieldCheck, Mail, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PendingApprovalPage() {
    const router = useRouter();

    const handleBack = () => {
        router.push('/landing');
    };

    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center p-4 bg-background overflow-hidden selection:bg-primary/20">
            {/* Premium Decorative Background */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-primary/5 blur-[120px] animate-pulse" />
                <div className="absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full bg-secondary/5 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-full bg-[radial-gradient(circle_at_center,rgba(var(--primary-rgb),0.03)_0%,transparent_70%)]" />
            </div>

            <div className="relative w-full max-w-xl animate-in fade-in zoom-in-95 duration-1000">
                {/* Brand Logo */}
                <div className="mb-10 flex flex-col items-center justify-center">
                    {/* <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-[0_0_30px_rgba(var(--primary-rgb),0.3)] mb-4">
                        <Sparkles className="h-8 w-8 text-primary-foreground" />
                    </div> */}
                    {/* <h1 className="text-2xl font-bold tracking-tight">FMS Enterprise Hub</h1> */}
                </div>

                <Card className="glassmorphism border-border/40 shadow-2xl shadow-black/10 overflow-hidden">
                    <div className="h-1.5 w-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary w-2/3 animate-[shimmer_2s_infinite_linear]"
                            style={{
                                background: 'linear-gradient(90deg, transparent 0%, rgba(var(--primary-rgb),0.5) 50%, transparent 100%)',
                                backgroundSize: '200% 100%'
                            }}
                        />
                    </div>

                    <CardHeader className="text-center pt-10 pb-4">
                        {/* <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border border-primary/20 relative">
                            <Clock className="h-10 w-10 text-primary animate-pulse" />
                            <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-background border border-border flex items-center justify-center">
                                <ShieldCheck className="h-4 w-4 text-primary" />
                            </div>
                        </div> */}
                        <CardTitle className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
                            Request Under <span className="text-gradient">Verification</span>
                        </CardTitle>
                        <CardDescription className="text-base mt-4 max-w-md mx-auto">
                            Your company registration request has been received and is currently being reviewed by our Super Admin.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6 px-10 pb-8">
                        <div className="rounded-2xl border border-border/40 bg-muted/30 p-6 space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-background border border-border flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</p>
                                    <p className="text-sm font-semibold text-foreground">Awaiting Approval</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-background border border-border flex items-center justify-center shrink-0">
                                    <Mail className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notification</p>
                                    <p className="text-sm font-semibold text-foreground">Email will be sent upon approval</p>
                                </div>
                            </div>
                        </div>

                        <div className="text-center space-y-2">
                            <p className="text-sm text-muted-foreground font-medium">
                                Usually, reviews are completed within 24-48 business hours.
                            </p>
                        </div>
                    </CardContent>

                    <CardFooter className="bg-muted/10 border-t border-border/30 p-6">
                        <Button
                            variant="ghost"
                            onClick={handleBack}
                            className="w-full h-12 text-muted-foreground hover:text-foreground hover:bg-transparent"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Return to Landing Page
                        </Button>
                    </CardFooter>
                </Card>

                {/* Footer Assistance */}
                <p className="mt-8 text-center text-xs text-muted-foreground">
                    Need urgent access? Contact our registration team at <span className="text-primary font-bold hover:underline cursor-pointer">onboarding@fms.com</span>
                </p>
            </div>
        </div>
    );
}
