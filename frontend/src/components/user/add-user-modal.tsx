'use client';

import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button, Input, Label, UISelect } from '@/components/ui';
import { useUserStore } from '@/lib/zustand/user/addUser';
import { useToast } from '@/components/ui/toast';
import { Eye, EyeOff, Shield, UserCircle, Briefcase, Mail, Key, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/zustand/user/user';
import { usePermissions } from '@/lib/hooks/usePermissions';
import api from '@/lib/api';
import { useStatsStore } from '@/lib/zustand/stats/dashboard-stats';

interface AddUserModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddUserModal({ open, onOpenChange }: AddUserModalProps) {
    const { addUser, loading } = useUserStore();
    const { addToast } = useToast();
    const { user } = useAuthStore();
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        company_id: user?.company_id || '',
        platform_role: '',
        workflow_role: '',
    });
    const { fetchStats } = useStatsStore()


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Basic validation
        if (!formData.email || !formData.password || !formData.name) {
            addToast({
                title: 'Error',
                description: 'Please fill in all required fields.',
                variant: 'destructive',
            });
            return;
        }
        try {
            const success = await addUser(
                formData.email,
                formData.password,
                formData.name,
                formData.company_id || user?.company_id || '', // Fallback or required
                formData.platform_role,
                formData.workflow_role
            );
            console.log("success", success);


            if (success) {
                addToast({
                    title: 'Success',
                    description: 'User added successfully.',
                    variant: 'success',
                });
                onOpenChange(false);
                fetchStats();
                setFormData({
                    email: '',
                    password: '',
                    name: '',
                    company_id: '',
                    platform_role: '',
                    workflow_role: '',
                });
            }
        }
        catch (error: any) {
            console.log(error);
            addToast({
                title: 'Error',
                description: error?.response?.data?.message || 'Failed to add user. Please try again.',
                variant: 'destructive',
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full sm:max-w-[550px] max-h-[80vh] overflow-auto rounded-3xl border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl p-0 outline-none custom-scrollbar">
                <div className="p-6 sm:p-8 space-y-6">
                    <DialogHeader className="space-y-2">

                        <DialogTitle className="text-2xl font-bold tracking-tight text-foreground flex justify-start">Add New User</DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                            Complete the security profile to create a new access account for the system.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-4">
                            {/* Personal Information Group */}
                            <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 space-y-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Identity Profile</p>

                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Full Name</Label>
                                    <div className="relative group">
                                        <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            id="name"
                                            name="name"
                                            placeholder="Enter name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            className="pl-10 h-11 rounded-xl bg-background border-border/60 focus:border-primary/50 focus:ring-primary/10 transition-all"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Email Address</Label>
                                    <div className="relative group">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            id="email"
                                            name="email"
                                            type="email"
                                            placeholder="work.email@company.com"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="pl-10 h-11 rounded-xl bg-background border-border/60 focus:border-primary/50 focus:ring-primary/10 transition-all"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="password" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Secure Password</Label>
                                    <div className="relative group">
                                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            id="password"
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={handleChange}
                                            className="pl-10 pr-10 h-11 rounded-xl bg-background border-border/60 focus:border-primary/50 focus:ring-primary/10 transition-all"
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Access Control Group */}
                            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-primary px-1 flex items-center gap-1.5">
                                    <ShieldCheck className="h-3 w-3" /> Role & Responsibilities
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="platform_role" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Platform Role</Label>
                                        <UISelect
                                            id="platform_role"
                                            value={formData.platform_role}
                                            onValueChange={(val) =>
                                                setFormData({ ...formData, platform_role: val })
                                            }
                                            className="w-full h-11 rounded-xl "
                                            placeholder="Select Role"
                                            options={[
                                                { value: 'controller', label: 'Controller' },
                                                { value: 'member', label: 'Member' },
                                            ]}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="workflow_role" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Workflow Role</Label>
                                        <UISelect
                                            id="workflow_role"
                                            value={formData.workflow_role}
                                            onValueChange={(val) =>
                                                setFormData({ ...formData, workflow_role: val })
                                            }
                                            disabled={formData.platform_role !== "member"}
                                            className="w-full h-11  disabled:opacity-30 transition-opacity"
                                            placeholder="Select Duty"
                                            options={[
                                                { value: 'interim_manager', label: 'Interim Manager' },
                                                { value: 'copywriter', label: 'Copywriter' },
                                                { value: 'designer', label: 'Designer' },
                                                { value: 'reviewer', label: 'Reviewer' },
                                            ]}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex items-center justify-end gap-3 px-1">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                className="rounded-xl h-11 px-6 font-bold text-xs uppercase tracking-widest hover:bg-muted"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                onClick={handleSubmit}
                                loading={loading}
                            // className="rounded-xl h-11 px-8 font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all bg-primary hover:bg-primary/90"
                            >
                                Create User
                            </Button>
                        </div>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}



export function ChangePasswordModalForAdmin({ open, onClose, selectedUser }: any) {
    const [password, setPassword] = useState({
        password: "",
        confirmPassword: ""
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const { addToast } = useToast();
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e?: any) => {
        e?.preventDefault();
        if (!password.password || !password.confirmPassword) {
            addToast({
                title: "Error",
                description: "Please fill all the fields",
                variant: "destructive"
            });
            return;
        }
        if (password.password !== password.confirmPassword) {
            addToast({
                title: "Error",
                description: "Passwords do not match",
                variant: "destructive"
            });
            return;
        }
        setLoading(true);
        try {
            const res = await api.patch('/change-password-by-admin', {
                id: selectedUser.id,
                password: password.password
            })
            if (res.status === 200) {
                addToast({
                    title: 'Success',
                    description: 'Password changed successfully.',
                    variant: 'success',
                });
                onClose(false);
                setPassword({
                    password: "",
                    confirmPassword: ""
                });
            }
        }
        catch (error: any) {
            addToast({
                title: 'Error',
                description: error?.response?.data?.message || 'Failed to change password. Please try again.',
                variant: 'destructive',
            });
        }
        finally {
            setPassword({
                password: "",
                confirmPassword: ""
            });
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[550px] rounded-3xl border-red-200/50 bg-background/95 backdrop-blur-xl shadow-2xl p-0 overflow-hidden outline-none">
                <div className="p-6 sm:p-8 space-y-6">
                    <DialogHeader className="space-y-2">

                        <DialogTitle className="text-2xl font-bold tracking-tight text-red-600">
                            Critical: Change Password
                        </DialogTitle>

                        <DialogDescription className="text-sm text-balance leading-relaxed text-muted-foreground">
                            Updating credentials for <span className="font-bold text-foreground underline underline-offset-4 decoration-red-200 decoration-2">{selectedUser?.name}</span>.
                        </DialogDescription>

                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50/50 border border-red-100 text-[11px] font-bold text-red-600 mt-2 uppercase tracking-tight">
                            <AlertCircle className="h-4 w-4" />
                            Security Warning: This action cannot be revoked.
                        </div>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                        <div className="space-y-4 p-5 rounded-2xl border border-red-100/50 bg-red-50/10">
                            <div className="space-y-2">
                                <Label htmlFor="password_change" className="text-[11px] font-bold uppercase tracking-wider text-red-700 ml-1">New System Password</Label>
                                <div className="relative group">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-300 group-focus-within:text-red-500 transition-colors" />
                                    <Input
                                        id="password_change"
                                        placeholder="••••••••"
                                        type={showPassword ? "text" : "password"}
                                        value={password.password}
                                        onChange={(e) =>
                                            setPassword({ ...password, password: e.target.value })
                                        }
                                        className="pl-10 pr-10 h-11 rounded-xl bg-background border-red-100 focus:border-red-400 focus:ring-red-50 transition-all"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-red-300 hover:text-red-500 p-1 rounded-lg"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-[11px] font-bold uppercase tracking-wider text-red-700 ml-1">Confirm Credentials</Label>
                                <div className="relative group">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-300 group-focus-within:text-red-500 transition-colors" />
                                    <Input
                                        id="confirmPassword"
                                        placeholder="••••••••"
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={password.confirmPassword}
                                        onChange={(e) =>
                                            setPassword({ ...password, confirmPassword: e.target.value })
                                        }
                                        className="pl-10 pr-10 h-11 rounded-xl bg-background border-red-100 focus:border-red-400 focus:ring-red-50 transition-all"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-red-300 hover:text-red-500 p-1 rounded-lg"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex items-center justify-end gap-3 px-1">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => onClose(false)}
                                className="rounded-xl h-11 px-6 font-bold text-xs uppercase tracking-widest hover:bg-muted"
                            >
                                Back
                            </Button>
                            <Button
                                type="submit"
                                onClick={handleSubmit}
                                loading={loading}
                                className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-11 px-8 font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-200 transition-all active:scale-95"
                            >
                                Apply Overwrite
                            </Button>
                        </div>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
