'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '@/lib/zustand/user/user';
import { useCompanyStore } from '@/lib/zustand/copmpany/company';
import { Check, Zap, Users, Briefcase, Layers, Info, ShieldCheck, Mail } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const PLAN_DETAILS = [
    {
        tier: 'starter',
        name: 'Starter Plan',
        description: 'Perfect for small teams and startups just getting started.',
        price: 'Free / Internal',
        features: [
            { icon: Users, text: 'Up to 10 User Seats', value: '10' },
            { icon: Briefcase, text: 'Up to 5 Active Projects', value: '5' },
            { icon: Layers, text: 'Up to 10 Total Instances', value: '10' },
            { icon: Info, text: 'Basic Workflow Support', value: 'Included' },
        ],
        color: 'blue',
        highlight: false,
    },
    {
        tier: 'pro',
        name: 'Pro Plan',
        description: 'Ideal for growing businesses with multiple teams and complex projects.',
        price: 'Contact for Quote',
        features: [
            { icon: Users, text: 'Up to 20 User Seats', value: '20' },
            { icon: Briefcase, text: 'Up to 15 Active Projects', value: '15' },
            { icon: Layers, text: 'Up to 50 Total Instances', value: '50' },
            { icon: Info, text: 'Advanced Reporting', value: 'Included' },
            { icon: ShieldCheck, text: 'Priority Support', value: 'Included' },
        ],
        color: 'primary',
        highlight: true,
    },
    {
        tier: 'enterprise',
        name: 'Enterprise Plan',
        description: 'Unlimited power for high-scale organizations and custom needs.',
        price: 'Custom Pricing',
        features: [
            { icon: Users, text: 'Unlimited User Seats', value: 'Unlimited' },
            { icon: Briefcase, text: 'Unlimited Active Projects', value: 'Unlimited' },
            { icon: Layers, text: 'Unlimited Total Instances', value: 'Unlimited' },
            { icon: Info, text: 'Custom Workflow Roles', value: 'Tailored' },
            { icon: ShieldCheck, text: '24/7 Dedicated Support', value: 'Included' },
        ],
        color: 'purple',
        highlight: false,
    }
];

export default function PlansPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const { fetchCompany, company, companyloading } = useCompanyStore();

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/landing');
            return;
        }
        fetchCompany();
    }, [isAuthenticated, fetchCompany, router]);

    const currentTier = (company?.tier || 'starter').toLowerCase();

    const getBadgeColor = (color: string) => {
        switch (color) {
            case 'blue': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
            case 'purple': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
            default: return 'bg-primary/10 text-primary border-primary/20';
        }
    };

    const getButtonVariant = (highlight: boolean) => highlight ? 'default' : 'outline';

    if (companyloading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <main className="mx-auto py-12 px-6 max-w-7xl space-y-12 animate-in fade-in duration-700">
            {/* ── Page Header ── */}
            <div className="text-center space-y-4">
                <Badge variant="outline" className="px-3 py-1 text-xs uppercase tracking-widest bg-primary/5 text-primary border-primary/20">
                    Platform Tiers
                </Badge>
                <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                    Scale your management with ease
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    Compare our subscription plans and find the perfect fit for your company.
                    Limits are enforced securely at the platform level.
                </p>
            </div>

            {/* ── Pricing Grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
                {PLAN_DETAILS.map((plan) => {
                    const isCurrent = currentTier === plan.tier;

                    return (
                        <Card
                            key={plan.tier}
                            className={cn(
                                "flex flex-col relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-border/50 overflow-hidden",
                                plan.highlight ? "ring-2 ring-primary shadow-lg scale-105 z-10" : "bg-card/50"
                            )}
                        >
                            {plan.highlight && (
                                <div className="absolute top-0 right-0 left-0 bg-primary text-primary-foreground text-[10px] font-bold py-1 text-center uppercase tracking-widest">
                                    Most Popular
                                </div>
                            )}

                            <CardHeader className={cn("pt-8 pb-6", plan.highlight ? "bg-primary/5" : "bg-muted/30")}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className={cn("p-2 rounded-lg", getBadgeColor(plan.color))}>
                                        <Zap className="h-5 w-5" />
                                    </div>
                                    {isCurrent && (
                                        <Badge className="bg-green-500 text-white border-none shadow-sm uppercase text-[10px]">
                                            Your Current Plan
                                        </Badge>
                                    )}
                                </div>
                                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                                <CardDescription className="min-h-[40px] mt-1">{plan.description}</CardDescription>
                                <div className="mt-4 flex items-baseline gap-1">
                                    <span className="text-3xl font-bold tracking-tight">{plan.price.split(' ')[0]}</span>
                                    <span className="text-muted-foreground text-sm font-medium">{plan.price.split(' ').slice(1).join(' ')}</span>
                                </div>
                            </CardHeader>

                            <CardContent className="flex-1 p-6 space-y-6">
                                <ul className="space-y-4">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-3 group">
                                            <div className="h-5 w-5 rounded-full bg-green-500/10 flex items-center justify-center mt-0.5 group-hover:bg-green-500/20 transition-colors">
                                                <Check className="h-3 w-3 text-green-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-foreground">{feature.text}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>

                            <CardFooter className="p-6 pt-0">
                                <Button
                                    className="w-full gap-2 font-semibold h-11"
                                    variant={isCurrent ? 'outline' : getButtonVariant(plan.highlight)}

                                >
                                    <a href={isCurrent ? '#' : 'mailto:support@fms.com?subject=Subscription Upgrade'}>
                                        {isCurrent ? 'Plan Active' : 'Contact to Upgrade'}
                                        {!isCurrent && <Mail className="h-4 w-4" />}
                                    </a>
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>

            {/* ── Help Section ── */}
            <div className="bg-muted/30 rounded-2xl border border-border/50 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Info className="h-5 w-5 text-primary" />
                        Need a custom plan?
                    </h3>
                    <p className="text-muted-foreground max-w-lg">
                        We offer tailor-made tiers for extremely large organizations or unique business requirements.
                        Get in touch with our Superadmin for enterprise-grade solutions.
                    </p>
                </div>
                <Button variant="outline" className="gap-2 border-primary/20 text-primary hover:bg-primary/5 min-w-[180px]">
                    <Mail className="h-4 w-4" />
                    Talk to Support
                </Button>
            </div>
        </main>
    );
}
