'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/zustand/user/user';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CompanyInfo } from '@/lib/types/auth';
import { Label } from '@/components/ui';
import { useCompanyStore } from '@/lib/zustand/copmpany/company';
import { useToast } from '@/components/ui/toast';
import {
    Building2, Mail, Phone, Globe, MapPin,
    Info, Users, Briefcase, Target,
    ShieldCheck, Save, RotateCcw, Building,
    CheckCircle2, AlertCircle, Calendar, Zap,
    Rocket
} from 'lucide-react';
import { UISelect } from '@/components/ui';
import {
    InputGroup, InputGroupAddon, InputGroupInput, InputGroupTextarea
} from '@/components/ui/input-group';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
// import { usePermissionStore } from '@/lib/zustand/permissions/permissions';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useRouter } from 'next/navigation';
const CompanyPage = ({ companyId: propCompanyId }: { companyId?: string }) => {
    const { fetchCompany, updateCompany, company, companyloading, companyerror } = useCompanyStore();
    const { user } = useAuthStore();
    const { addToast } = useToast();
    const { hasAccess } = usePermissions();
    const router = useRouter();


    const isAdmin = user?.platform_role === 'admin';
    const superAdmin = user?.platform_role === 'superadmin';
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
        id: "",
        name: "",
        email: "",
        phone: "",
        address: "",
        website: "",
        description: "",
        team_size: "",
        industry: "",
        purpose: "",
        tier: "starter",
        subscription_start_date: "",
        subscription_end_date: "",
    });
    useEffect(() => {
        fetchCompany(propCompanyId);
    }, [propCompanyId]);


    useEffect(() => {
        if (company) {
            setCompanyInfo({
                id: company?.id || "",
                name: company?.name || "",
                email: company?.email || "",
                phone: company?.phone || "",
                address: company?.address || "",
                website: company?.website || "",
                description: company?.description || "",
                team_size: company?.team_size || "",
                industry: company?.industry || "",
                purpose: company?.purpose || "",
                tier: company?.tier || "starter",
                subscription_start_date: company?.subscription_start_date ? new Date(company.subscription_start_date).toISOString().split('T')[0] : "",
                subscription_end_date: company?.subscription_end_date ? new Date(company.subscription_end_date).toISOString().split('T')[0] : "",
            });
        }
    }, [company]);


    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        setCompanyInfo({
            ...companyInfo,
            [e.target.name]: e.target.value,
        });
    };

    const handlePlanChange = (
        e: React.ChangeEvent<HTMLSelectElement>
    ) => {
        setCompanyInfo({
            ...companyInfo,
            [e.target.name]: e.target.value,
        });
    };

    const hasChanges = () => {
        if (!company) return false;

        return (
            companyInfo.name !== (company.name || "") ||
            companyInfo.email !== (company.email || "") ||
            companyInfo.phone !== (company.phone || "") ||
            companyInfo.address !== (company.address || "") ||
            companyInfo.website !== (company.website || "") ||
            companyInfo.description !== (company.description || "") ||
            companyInfo.team_size !== (company.team_size || "") ||
            companyInfo.industry !== (company.industry || "") ||
            companyInfo.purpose !== (company.purpose || "") ||
            companyInfo.tier !== (company.tier || "starter") ||
            companyInfo.subscription_start_date !== (company.subscription_start_date ? new Date(company.subscription_start_date).toISOString().split('T')[0] : "") ||
            companyInfo.subscription_end_date !== (company.subscription_end_date ? new Date(company.subscription_end_date).toISOString().split('T')[0] : "")
        );
    };

    const handleReset = () => {
        if (company) {
            setCompanyInfo({
                id: company?.id || "",
                name: company?.name || "",
                email: company?.email || "",
                phone: company?.phone || "",
                address: company?.address || "",
                website: company?.website || "",
                description: company?.description || "",
                team_size: company?.team_size || "",
                industry: company?.industry || "",
                purpose: company?.purpose || "",
                tier: company?.tier || "starter",
                subscription_start_date: company?.subscription_start_date ? new Date(company.subscription_start_date).toISOString().split('T')[0] : "",
                subscription_end_date: company?.subscription_end_date ? new Date(company.subscription_end_date).toISOString().split('T')[0] : "",
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hasChanges()) {
            addToast({
                title: "No Changes",
                description: "No changes were made to company information.",
                variant: "destructive"
            });
            return;
        }

        try {
            const success = await updateCompany(companyInfo);

            if (success) {
                addToast({
                    title: "Success",
                    description: "Company information updated successfully.",
                });
            } else {
                addToast({
                    title: "Error",
                    description: "Failed to update company information.",
                    variant: "destructive"
                });
            }
        } catch (error) {
            addToast({
                title: "Error",
                description: "Something went wrong.",
                variant: "destructive"
            });
        }
    };

    return (
        <div className=" mx-auto py-8 px-6 space-y-10 animate-in fade-in duration-500">

            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-8">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Building className="h-4 w-4 text-primary" />
                        </div>
                        {isAdmin || superAdmin || user?.platform_role === 'controller' ? (
                            <h1 className="text-xl font-semibold tracking-tight text-foreground">Company Settings</h1>
                        ) : (
                            <h1 className="text-xl font-semibold tracking-tight text-foreground">My Company Settings</h1>
                        )}
                    </div>
                    <p className="text-muted-foreground">
                        Configure your organization's identity and operational details.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {isAdmin || superAdmin || hasAccess('settings', 'write') ? (
                        <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20 px-3 py-1 text-xs gap-1.5 ring-0">
                            <ShieldCheck className="h-3 w-3" /> Edit Access
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-muted-foreground px-3 py-1 text-xs gap-1.5">
                            <AlertCircle className="h-3 w-3" /> View Only Access
                        </Badge>
                    )}
                </div>
            </div>

            {/* ── Expiration Alert ── */}
            {companyInfo.subscription_end_date && (
                (() => {
                    const expiryDate = new Date(companyInfo.subscription_end_date);
                    const today = new Date();
                    const diffTime = expiryDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays <= 0) {
                        return (
                            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3 text-destructive animate-in slide-in-from-top duration-300">
                                <AlertCircle className="h-5 w-5" />
                                <div className="text-sm">
                                    <span className="font-bold">Subscription Expired:</span> Your company's subscription has expired. Resource creation is now restricted. Please contact our support team or an administrator to renew.
                                </div>
                            </div>
                        );
                    } else if (diffDays <= 7) {
                        return (
                            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-3 text-orange-600 animate-in slide-in-from-top duration-300">
                                <AlertCircle className="h-5 w-5" />
                                <div className="text-sm">
                                    <span className="font-bold">Subscription Expiring Soon:</span> Your subscription will expire in <span className="font-bold underline">{diffDays} days</span> ({new Date(companyInfo.subscription_end_date).toLocaleDateString()}). Please renew soon to avoid service interruption.
                                </div>
                            </div>
                        );
                    }
                    return null;
                })()
            )}

            <form onSubmit={handleSubmit} className="space-y-8">

                {/* ── Section 1: Core Profile ── */}
                <Card className="border-border/50 shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/30 pb-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                            <CardTitle className="text-base">Core Profile</CardTitle>
                        </div>
                        <CardDescription>Basic identification for your company.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company Name</Label>
                            <InputGroup>
                                <InputGroupAddon><Building2 className="h-4 w-4" /></InputGroupAddon>
                                <InputGroupInput
                                    name="name"
                                    placeholder="Enter company name"
                                    value={companyInfo.name}
                                    onChange={handleChange}
                                    disabled={!isAdmin && !superAdmin && !hasAccess('settings', 'write')}
                                />
                            </InputGroup>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Official Email</Label>
                            <InputGroup>
                                <InputGroupAddon><Mail className="h-4 w-4" /></InputGroupAddon>
                                <InputGroupInput
                                    name="email"
                                    type="email"
                                    placeholder="contact@company.com"
                                    value={companyInfo.email}
                                    onChange={handleChange}
                                    disabled={!isAdmin && !superAdmin && !hasAccess('settings', 'write')}
                                />
                            </InputGroup>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone Number</Label>
                            <InputGroup>
                                <InputGroupAddon><Phone className="h-4 w-4" /></InputGroupAddon>
                                <InputGroupInput
                                    name="phone"
                                    placeholder="+1 (555) 000-0000"
                                    value={companyInfo.phone}
                                    onChange={handleChange}
                                    disabled={!isAdmin && !hasAccess('settings', 'write') && !superAdmin}
                                />
                            </InputGroup>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Website URL</Label>
                            <InputGroup>
                                <InputGroupAddon><Globe className="h-4 w-4" /></InputGroupAddon>
                                <InputGroupInput
                                    name="website"
                                    placeholder="https://company.com"
                                    value={companyInfo.website}
                                    onChange={handleChange}
                                    disabled={!isAdmin && !hasAccess('settings', 'write') && !superAdmin}
                                />
                            </InputGroup>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Section 2: Business details ── */}
                <Card className="border-border/50 shadow-sm overflow-hidden p-2">
                    <CardHeader className="bg-muted/30 pb-4">
                        <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-primary" />
                            <CardTitle className="text-base">Business Context</CardTitle>
                        </div>
                        <CardDescription>Tell us more about your organization's scale and focus.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team Size</Label>
                            <InputGroup>
                                <InputGroupAddon><Users className="h-4 w-4" /></InputGroupAddon>
                                <InputGroupInput
                                    name="team_size"
                                    placeholder="e.g. 10-50"
                                    value={companyInfo.team_size}
                                    onChange={handleChange}
                                    disabled={!isAdmin && !hasAccess('settings', 'write') && !superAdmin}
                                />
                            </InputGroup>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Industry</Label>
                            <InputGroup>
                                <InputGroupAddon><Briefcase className="h-4 w-4" /></InputGroupAddon>
                                <InputGroupInput
                                    name="industry"
                                    placeholder="e.g. Technology"
                                    value={companyInfo.industry || ""}
                                    onChange={handleChange}
                                    disabled={!isAdmin && !hasAccess('settings', 'write') && !superAdmin}
                                />
                            </InputGroup>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Purpose</Label>
                            <InputGroup>
                                <InputGroupAddon><Target className="h-4 w-4" /></InputGroupAddon>
                                <InputGroupInput
                                    name="purpose"
                                    placeholder="e.g. Asset Management"
                                    value={companyInfo.purpose || ""}
                                    onChange={handleChange}
                                    disabled={!isAdmin && !hasAccess('settings', 'write') && !superAdmin}
                                />
                            </InputGroup>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Section 3: Subscription & Limits (Superadmin only for editing) ── */}
                <Card className="border-border/50 shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/30 pb-4">
                        <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            <CardTitle className="text-base">Subscription & Limits</CardTitle>
                        </div>
                        <div className="flex flex-col">
                            <CardDescription>Manage company plan, resource limits and validity.</CardDescription>
                            <Button
                                variant="link"
                                className="px-0 h-auto text-xs text-primary w-fit mt-1"
                                onClick={() => router.push('/dashboard/plans')}
                            >
                                <Info className="h-3 w-3 mr-1" /> View Plan Details & Limits
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Plan</Label>
                            <InputGroup>
                                {/* <InputGroupAddon><Zap className="h-4 w-4" /></InputGroupAddon> */}
                                <UISelect
                                    value={companyInfo.tier}
                                    onValueChange={(val) => setCompanyInfo(f => ({ ...f, tier: val }))}
                                    disabled={!superAdmin}
                                    className="w-full"
                                    options={[
                                        { value: 'starter', label: 'Starter Plan', icon: Building },
                                        { value: 'pro', label: 'Pro Plan', icon: Zap },
                                        { value: 'enterprise', label: 'Enterprise Plan', icon: Rocket },
                                    ]}
                                />
                            </InputGroup>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subscription Start</Label>
                            <InputGroup>
                                <InputGroupAddon><Calendar className="h-4 w-4" /></InputGroupAddon>
                                <InputGroupInput
                                    name="subscription_start_date"
                                    type="date"
                                    value={companyInfo.subscription_start_date}
                                    onChange={handleChange}
                                    disabled={!superAdmin}
                                />
                            </InputGroup>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subscription Expiry</Label>
                            <InputGroup>
                                <InputGroupAddon><Calendar className="h-4 w-4" /></InputGroupAddon>
                                <InputGroupInput
                                    name="subscription_end_date"
                                    type="date"
                                    value={companyInfo.subscription_end_date}
                                    onChange={handleChange}
                                    disabled={!superAdmin}
                                />
                            </InputGroup>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Section 4: About & Location ── */}
                <Card className="border-border/50 shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/30 pb-4">
                        <div className="flex items-center gap-2">
                            <Info className="h-4 w-4 text-primary" />
                            <CardTitle className="text-base">Description & Location</CardTitle>
                        </div>
                        <CardDescription>Detailed information about your company's mission and physical presence.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Physical Address</Label>
                            <InputGroup className="items-start">
                                <InputGroupAddon className="pt-3 group-has-[textarea]/input-group:pt-3"><MapPin className="h-4 w-4 mt-0.5" /></InputGroupAddon>
                                <InputGroupTextarea
                                    name="address"
                                    placeholder="Enter full address"
                                    className="min-h-[80px]"
                                    value={companyInfo.address}
                                    onChange={handleChange}
                                    disabled={!isAdmin && !hasAccess('settings', 'write') && !superAdmin}
                                />
                            </InputGroup>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company Description</Label>
                            <InputGroup className="items-start">
                                <InputGroupAddon className="pt-3 group-has-[textarea]/input-group:pt-3"><Info className="h-4 w-4 mt-0.5" /></InputGroupAddon>
                                <InputGroupTextarea
                                    name="description"
                                    placeholder="A brief overview of your company's mission..."
                                    className="min-h-[120px]"
                                    value={companyInfo.description}
                                    onChange={handleChange}
                                    disabled={!isAdmin && !hasAccess('settings', 'write') && !superAdmin}
                                />
                            </InputGroup>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Form Actions ── */}
                {isAdmin || hasAccess('settings', 'write') || superAdmin ? (
                    <div className="flex items-center justify-end pt-6 border-t border-border">
                        {/* <p className="text-sm text-muted-foreground italic flex items-center gap-2">
                            <Info className="h-3.5 w-3.5" />
                            Use the save button to persist your changes.
                        </p> */}
                        <div className="flex items-center gap-3">
                            {hasChanges() && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleReset}
                                    disabled={companyloading}
                                    className="gap-2"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                                </Button>
                            )}
                            <Button
                                type="submit"
                                disabled={companyloading || !hasChanges()}
                                className="gap-2 min-w-[140px] shadow-md transition-all active:scale-[0.98]"
                            >
                                {companyloading ? (
                                    <Spinner size="sm" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                {companyloading ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 rounded-lg bg-muted/50 border border-dashed border-border flex items-center gap-3 text-muted-foreground">
                        <ShieldCheck className="h-5 w-5 text-muted-foreground/50" />
                        <span className="text-sm italic">You are viewing company settings in read-only mode. Contact an administrator to make changes.</span>
                    </div>
                )}
            </form>
        </div>
    );
};

export default CompanyPage;
