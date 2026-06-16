'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Button,
    Input,
    Label,
    UISelect,
    Textarea,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
    DialogContent,
    Dialog,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import {
    Building2,
    User,
    Users,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    Send,
    Mail,
    Phone,
    Globe,
    MapPin,
    Briefcase,
    Target,
    FileText,
    Sparkles,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { LoginForm } from './LoginForm';
import { useAuthStore } from '@/lib/zustand/user/user';
import { useEffect } from 'react';

const STEPS = [
    { id: 1, title: 'Contact Person', icon: User, description: 'Who will be the admin?' },
    { id: 2, title: 'Company Info', icon: Building2, description: 'Tell us about your company' },
    { id: 3, title: 'Team & Purpose', icon: Users, description: 'Your goals with FMS' },
    { id: 4, title: 'Review & Submit', icon: CheckCircle2, description: 'Confirm your details' },
];

const TEAM_SIZES = ['1-10', '11-20', '21-50', '51-100', '100+'];
const INDUSTRIES = [
    'Information Technology',
    'Finance & Banking',
    'Healthcare',
    'Education',
    'Manufacturing',
    'Retail & E-Commerce',
    'Real Estate',
    'Consulting',
    'Marketing & Advertising',
    'Other',
];

interface FormData {
    company_name: string;
    company_email: string;
    company_phone: string;
    company_website: string;
    company_address: string;
    contact_name: string;
    contact_designation: string;
    contact_email: string;
    contact_phone: string;
    purpose: string;
    team_size: string;
    industry: string;
    description: string;
}

const initialFormData: FormData = {
    company_name: '',
    company_email: '',
    company_phone: '',
    company_website: '',
    company_address: '',
    contact_name: '',
    contact_designation: '',
    contact_email: '',
    contact_phone: '',
    purpose: '',
    team_size: '',
    industry: '',
    description: '',
};

export interface RegisterFormProps {
    isModal?: boolean;
    onClose?: () => void;
    openLogin?: () => void;
}

export function RegisterForm({ isModal = false, onClose, openLogin }: RegisterFormProps) {
    const router = useRouter();
    const { addToast } = useToast();
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const { signInWithGoogle } = useAuthStore();

    // Handle Google User Pre-fill
    useEffect(() => {
        const googleUserStr = sessionStorage.getItem('fms-google-user');
        if (googleUserStr) {
            try {
                const googleUser = JSON.parse(googleUserStr);
                setFormData(prev => ({
                    ...prev,
                    contact_name: googleUser.name || prev.contact_name,
                    contact_email: googleUser.email || prev.contact_email,
                }));
                // Clear it so it don't keep nagging or overiding manual changes after initial Load
                sessionStorage.removeItem('fms-google-user');
                addToast({
                    title: 'Profile Pre-filled',
                    description: 'We have pre-filled your contact details from your Google account.',
                    variant: 'success'
                });
            } catch (error) {
                console.error('Error parsing google user data:', error);
            }
        }
    }, [addToast]);

    const openRegister = () => {
        setShowLogin(false);
        setShowRegister(true);
    };
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validateStep = (step: number): boolean => {
        switch (step) {
            case 1:
                if (!formData.contact_name || !formData.contact_designation || !formData.contact_email || !formData.contact_phone) {
                    addToast({ title: 'Missing fields', description: 'Please fill all required fields.', variant: 'destructive' });
                    return false;
                }
                return true;
            case 2:
                if (!formData.company_name || !formData.company_email || !formData.company_phone) {
                    addToast({ title: 'Missing fields', description: 'Please fill all required fields.', variant: 'destructive' });
                    return false;
                }
                return true;
            case 3:
                if (!formData.purpose || !formData.team_size) {
                    addToast({ title: 'Missing fields', description: 'Please fill Purpose and Team Size.', variant: 'destructive' });
                    return false;
                }
                return true;
            default:
                return true;
        }
    };

    const nextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep((prev) => Math.min(prev + 1, 4));
        }
    };

    const prevStep = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const res = await api.post(`/onboarding/register`, formData);
            setSubmitted(true);
            addToast({ title: 'Success!', description: res.data.message, variant: 'success' });
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Something went wrong. Please try again.';
            addToast({ title: 'Error', description: msg, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleBackToLogin = () => {
        if (isModal && openLogin) {
            openLogin();
        } else {
            router.push('/login');
        }
    };

    const handleHomeRedirect = () => {
        if (isModal && onClose) {
            onClose();
        } else {
            router.push('/');
        }
    };

    // Success screen after submission
    if (submitted) {
        return (
            <div className={cn("flex items-center justify-center bg-background px-4", !isModal && "min-h-screen")}>
                {!isModal && (
                    <div className="pointer-events-none fixed inset-0 overflow-hidden">
                        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
                        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
                    </div>
                )}

                <Card className={cn("relative w-full max-w-lg border-border/60 shadow-xl shadow-black/5 text-center", isModal && "border-none shadow-none bg-transparent")}>
                    <CardContent className="pt-10 pb-8 px-8">
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-3">
                            Request Submitted Successfully!
                        </h2>
                        <p className="text-muted-foreground mb-2">
                            Thank you for registering <strong className="text-foreground">{formData.company_name}</strong>.
                        </p>
                        <p className="text-muted-foreground mb-8">
                            Our team will review your request and contact you shortly at{' '}
                            <strong className="text-foreground">{formData.contact_email}</strong>.
                        </p>
                        <Button onClick={handleBackToLogin} className="w-full">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className={cn(
            "flex overflow-hidden selection:bg-primary/20 transition-all duration-300",
            !isModal ? "min-h-screen flex-col lg:flex-row bg-background" : "flex-col max-h-[85vh] bg-transparent"
        )}>
            {/* Decorative Premium Background - Spans whole screen (Only if not modal) */}
            {!isModal && (
                <div className="pointer-events-none fixed inset-0 overflow-hidden bg-background">
                    <div className="absolute -top-1/4 -right-1/4 h-[800px] w-[800px] rounded-full bg-primary/10 blur-[120px] animate-pulse" />
                    <div className="absolute -bottom-1/4 -left-1/4 h-[800px] w-[800px] rounded-full bg-secondary/10 blur-[120px] animate-pulse " style={{ animationDelay: '2s' }} />
                    <div className="absolute top-1/4 left-1/3 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[100px]" />
                </div>
            )}

            {/* ── Left Sidebar: Vertical Stepper (Desktop Only, and only if not modal) ── */}
            {!isModal && (
                <div className="hidden lg:flex lg:w-[360px] shrink-0 border-r border-border/40 bg-card/10 backdrop-blur-3xl p-10 flex-col z-20 relative">
                    <div
                        className="flex items-center gap-3 mb-16 cursor-pointer group"
                        onClick={handleHomeRedirect}
                    >
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
                            <Sparkles className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xl font-bold tracking-tighter leading-none">FMS</span>
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Enterprise Hub</span>
                        </div>
                    </div>

                    <div className="space-y-10 flex-1 ml-1">
                        {STEPS.map((step) => {
                            const isCompleted = step.id < currentStep;
                            const isActive = step.id === currentStep;
                            const Icon = step.icon;
                            return (
                                <div key={step.id} className="flex items-start gap-5 group">
                                    <div className="relative flex flex-col items-center">
                                        <div className={cn(
                                            "z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-300",
                                            isCompleted ? "bg-primary border-primary text-primary-foreground" : isActive ? "border-primary bg-background shadow-lg shadow-primary/20 scale-110" : "border-muted bg-background text-muted-foreground"
                                        )}>
                                            {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                                        </div>
                                        {step.id !== STEPS.length && (
                                            <div className={cn("absolute top-9 w-0.5 h-14 z-0 transition-colors duration-500", isCompleted ? "bg-primary/40" : "bg-muted/30")} />
                                        )}
                                    </div>
                                    <div className="flex-1 pt-0.5 ml-1">
                                        <h3 className={cn("text-sm font-bold tracking-tight transition-colors", isActive ? "text-foreground" : isCompleted ? "text-foreground/80" : "text-muted-foreground")}>
                                            {step.title}
                                        </h3>
                                        <p className={cn("text-[11px] mt-1 leading-relaxed transition-colors max-w-[200px]", isActive ? "text-primary/70" : "text-muted-foreground/60")}>
                                            {step.description}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Main Form Area ── */}
            <div className={cn(
                "flex-1 flex flex-col relative z-10 overflow-y-auto custom-scrollbar",
                isModal && "p-0"
            )}>
                {/* Mobile Stepper (Hidden on Desktop natively, or shown in Modal for all sizes) */}
                <div className={cn("p-6 bg-card/20 backdrop-blur-md border-b border-border/40", !isModal && "lg:hidden")}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">Step {currentStep} of {STEPS.length}</span>
                        <span className="text-[11px] text-muted-foreground">{STEPS[currentStep - 1].title}</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-500 rounded-full"
                            style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
                        />
                    </div>
                </div>

                <div className={cn("flex-1 flex flex-col items-center py-6 px-6 lg:px-20 lg:py-10", isModal && "px-2 py-4")}>
                    {/* Header */}
                    {!isModal && (
                        <div className="mb-10 text-center lg:text-left lg:w-full lg:max-w-2xl animate-in fade-in slide-in-from-bottom duration-1000">
                            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:mb-2">
                                Register Your <span className="text-gradient">Organisation</span>
                            </h1>
                            <p className="mt-2 text-sm text-muted-foreground max-w-sm lg:max-w-none">
                                Enter your details to initiate the company onboarding workflow.
                            </p>
                        </div>
                    )}

                    {/* Registration Card */}
                    <div className={cn("w-full max-w-2xl animate-in fade-in zoom-in-95 duration-1000", isModal && "max-w-full")}>
                        <Card className={cn(
                            "glassmorphism border-border/40 shadow-2xl shadow-black/10",
                            isModal && "border-none shadow-none bg-transparent"
                        )}>
                            <CardHeader className="pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                                        {React.createElement(STEPS[currentStep - 1].icon, { className: 'h-5 w-5' })}
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl">
                                            {STEPS[currentStep - 1].title}
                                        </CardTitle>
                                        <CardDescription className="text-sm">
                                            {STEPS[currentStep - 1].description}
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-6 pt-2">
                                {/* Step 1: Person Information */}
                                {currentStep === 1 && (
                                    <div className="space-y-4">
                                        <div className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-3 text-[13px] text-muted-foreground flex items-center gap-3">
                                            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold">!</div>
                                            <p>This user will be assigned as the <strong className="text-foreground">Primary Administrator</strong>.</p>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div className="space-y-2">
                                                <Label htmlFor="contact_name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Name *</Label>
                                                <div className="relative">
                                                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                    <Input id="contact_name" name="contact_name" value={formData.contact_name} onChange={handleChange} placeholder="John Doe" className="pl-10 h-11" required />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="contact_designation" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Designation *</Label>
                                                <div className="relative">
                                                    <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                    <Input id="contact_designation" name="contact_designation" value={formData.contact_designation} onChange={handleChange} placeholder="CEO, Manager, etc." className="pl-10 h-11" required />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div className="space-y-2">
                                                <Label htmlFor="contact_email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address *</Label>
                                                <div className="relative">
                                                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                    <Input id="contact_email" name="contact_email" type="email" value={formData.contact_email} onChange={handleChange} placeholder="john@company.com" className="pl-10 h-11" required />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="contact_phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone Number *</Label>
                                                <div className="relative">
                                                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                    <Input id="contact_phone" name="contact_phone" type='number' value={formData.contact_phone} onChange={handleChange} placeholder="+91 98765 43210" className="pl-10 h-11" required />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="relative py-4">
                                            <div className="absolute inset-0 flex items-center">
                                                <span className="w-full border-t border-border" />
                                            </div>
                                            <div className="relative flex justify-center text-xs uppercase">
                                                <span className="bg-card px-2 text-muted-foreground">Or register faster with</span>
                                            </div>
                                        </div>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={async () => {
                                                setGoogleLoading(true);
                                                try {
                                                    await signInWithGoogle();
                                                } catch (err) {
                                                    setGoogleLoading(false);
                                                }
                                            }}
                                            loading={googleLoading}
                                            className="w-full h-11 flex items-center justify-center gap-3 rounded-xl border-border/60 hover:bg-muted/50 transition-all font-medium"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 shrink-0">
                                                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.659 32.657 29.21 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                                                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                                                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.193l-6.19-5.238C29.165 35.091 26.715 36 24 36c-5.19 0-9.63-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                                                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.064 3.104-3.338 5.615-6.084 7.091l.003-.002 6.19 5.238C33.971 42.091 44 36 44 24c0-1.341-.138-2.65-.389-3.917z" />
                                            </svg>
                                            Continue with Google
                                        </Button>
                                    </div>
                                )}

                                {/* Step 2: Company Details */}
                                {currentStep === 2 && (
                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <Label htmlFor="company_name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company Name *</Label>
                                            <div className="relative">
                                                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                <Input id="company_name" name="company_name" value={formData.company_name} onChange={handleChange} placeholder="Global Innovations Inc." className="pl-10 h-11" required />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div className="space-y-2">
                                                <Label htmlFor="company_email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company Email *</Label>
                                                <div className="relative">
                                                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                    <Input id="company_email" name="company_email" type="email" value={formData.company_email} onChange={handleChange} placeholder="contact@company.com" className="pl-10 h-11" required />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="company_phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company Phone *</Label>
                                                <div className="relative">
                                                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                    <Input id="company_phone" name="company_phone" type='number' value={formData.company_phone} onChange={handleChange} placeholder="022-2345678" className="pl-10 h-11" required />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div className="space-y-2">
                                                <Label htmlFor="company_website" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Website</Label>
                                                <div className="relative">
                                                    <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                    <Input id="company_website" name="company_website" value={formData.company_website} onChange={handleChange} placeholder="https://company.com" className="pl-10 h-11" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="company_address" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</Label>
                                                <div className="relative">
                                                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                    <Input id="company_address" name="company_address" value={formData.company_address} onChange={handleChange} placeholder="Business Park, Tower 5" className="pl-10 h-11" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step 3: Team & Industry */}
                                {currentStep === 3 && (
                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <Label htmlFor="purpose" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platform Usage Purpose *</Label>
                                            <div className="relative">
                                                <Target className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Textarea id="purpose" name="purpose" value={formData.purpose} onChange={handleChange} placeholder="E.g. Automate financial workflows, Manage team tasks..." className="pl-10 min-h-[100px] resize-none pt-3" required />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div className="space-y-2">
                                                <UISelect
                                                    id="team_size"
                                                    value={formData.team_size}
                                                    onValueChange={(val) => setFormData(prev => ({ ...prev, team_size: val }))}
                                                    className="w-full h-11"
                                                    placeholder="Select range"
                                                    options={TEAM_SIZES?.map((size) => ({
                                                        value: size,
                                                        label: `${size} members`,
                                                        icon: Users
                                                    }))}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <UISelect
                                                    id="industry"
                                                    value={formData.industry}
                                                    onValueChange={(val) => setFormData(prev => ({ ...prev, industry: val }))}
                                                    className="w-full h-11"
                                                    placeholder="Select industry"
                                                    options={INDUSTRIES.map((ind) => ({
                                                        value: ind,
                                                        label: ind,
                                                        icon: Globe
                                                    }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Additional Notes</Label>
                                            <div className="relative">
                                                <FileText className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Textarea id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Anything else you'd like to share?" className="pl-10 min-h-[80px] resize-none pt-3" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step 4: Final Review */}
                                {currentStep === 4 && (
                                    <div className="space-y-4">
                                        <div className="rounded-2xl border border-border/40 bg-muted/20 p-5 space-y-5 animate-in fade-in duration-500">
                                            {/* Section 1 */}
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1">
                                                    <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Company</h3>
                                                    <p className="font-bold text-foreground text-lg leading-tight">{formData.company_name}</p>
                                                    <p className="text-xs text-muted-foreground font-medium">{formData.industry} • {formData.team_size} Team</p>
                                                </div>
                                                <Button size="sm" variant="ghost" onClick={() => setCurrentStep(2)} className="h-8 px-3 text-[11px] font-bold uppercase tracking-tighter hover:bg-primary/10 hover:text-primary">Edit</Button>
                                            </div>
                                            {/* Section 2 */}
                                            <div className="flex items-start justify-between border-t border-border/40 pt-4">
                                                <div className="space-y-1">
                                                    <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Admin</h3>
                                                    <p className="font-bold text-foreground">{formData.contact_name}</p>
                                                    <p className="text-xs text-muted-foreground font-medium">{formData.contact_email}</p>
                                                </div>
                                                <Button size="sm" variant="ghost" onClick={() => setCurrentStep(1)} className="h-8 px-3 text-[11px] font-bold uppercase tracking-tighter hover:bg-primary/10 hover:text-primary">Edit</Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>

                            <CardFooter className="flex justify-between gap-4 pt-6 border-t border-border/30">
                                {currentStep > 1 ? (
                                    <Button variant="outline" onClick={prevStep} className="h-11 px-8 rounded-xl font-bold transition-all hover:bg-muted/50 border-border/40">
                                        <ArrowLeft className="h-4 w-4 mr-2" />
                                        Back
                                    </Button>
                                ) : (
                                    <Button variant="ghost" onClick={() => {
                                        setMobileMenuOpen(false);
                                        setShowLogin(true);
                                    }} className="h-11 px-6 text-muted-foreground font-bold hover:bg-transparent hover:text-foreground">
                                        <ArrowLeft className="h-4 w-4 mr-2" />
                                        Login
                                    </Button>
                                )}

                                {currentStep < 4 ? (
                                    <Button onClick={nextStep} className="h-11 px-10 rounded-xl font-bold shadow-xl shadow-primary/20 bg-primary hover:scale-[1.02] transition-transform">
                                        Next
                                        <ArrowRight className="h-4 w-4 ml-2" />
                                    </Button>
                                ) : (
                                    <Button onClick={handleSubmit} loading={loading} className="h-11 px-10 rounded-xl font-bold shadow-xl shadow-primary/25 bg-primary hover:scale-[1.02] transition-transform min-w-[160px]">
                                        {loading ? 'Submitting...' : (
                                            <>
                                                <Send className="h-4 w-4 mr-2" />
                                                Submit Request
                                            </>
                                        )}
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    </div>

                    {!isModal && (
                        <div className="mt-12 text-center text-[11px] text-muted-foreground/60 w-full max-w-2xl">
                            Business Registration Assistance: <span className="text-primary font-bold hover:underline cursor-pointer">contact@fms-global.com</span>
                        </div>
                    )}
                </div>
            </div>
            {/* Login Modal */}
            <Dialog open={showLogin} onOpenChange={setShowLogin}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar p-4">
                    <LoginForm
                        isModal={true}
                        setShowLogin={setShowLogin}
                        onclose={() => setShowLogin(false)}
                        openRegister={openRegister}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
