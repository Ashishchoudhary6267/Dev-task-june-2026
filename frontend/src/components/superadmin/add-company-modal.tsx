'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button, Input } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import api from '@/lib/api';

interface AddCompanyModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function AddCompanyModal({ open, onOpenChange, onSuccess }: AddCompanyModalProps) {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        companyName: '',
        companyEmail: '',
        companyPhone: '',
        companyAddress: '',
        companyWebsite: '',
        companyDescription: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await api.post('/superadmin/companies', formData);
            addToast({ title: 'Success', description: 'Company and Admin created successfully', variant: 'success' });
            if (onSuccess) onSuccess();
            onOpenChange(false);
            setFormData({
                companyName: '', companyEmail: '', companyPhone: '', companyAddress: '', companyWebsite: '', companyDescription: '', adminName: '', adminEmail: '', adminPassword: ''
            });
        } catch (error: any) {
            console.error(error);
            addToast({ title: 'Error', description: error.response?.data?.message || 'Failed to create company', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-background">
                <DialogHeader>
                    <DialogTitle>Add New Company</DialogTitle>
                    <DialogDescription>Create a new tenant organization and assign its first Company Admin.</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 mt-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-primary">Company Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Company Name *</label>
                                <Input name="companyName" value={formData.companyName} onChange={handleChange} placeholder="Acme Inc." required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Company Email *</label>
                                <Input name="companyEmail" type="email" value={formData.companyEmail} onChange={handleChange} placeholder="contact@acme.com" required />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Phone</label>
                                <Input name="companyPhone" value={formData.companyPhone} onChange={handleChange} placeholder="+1 234 567 890" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Website</label>
                                <Input name="companyWebsite" value={formData.companyWebsite} onChange={handleChange} placeholder="https://acme.com" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Address</label>
                            <Input name="companyAddress" value={formData.companyAddress} onChange={handleChange} placeholder="123 Business St, City" />
                        </div>
                    </div>

                    <div className="border-t border-border pt-4 space-y-4">
                        <h3 className="text-sm font-semibold text-primary">Initial Company Admin</h3>
                        <p className="text-xs text-muted-foreground mb-4">This user will have full access to manage the newly created company.</p>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Admin Full Name *</label>
                                <Input name="adminName" value={formData.adminName} onChange={handleChange} placeholder="John Doe" required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Admin Login Email *</label>
                                <Input name="adminEmail" type="email" value={formData.adminEmail} onChange={handleChange} placeholder="john@acme.com" required />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Temporary Password *</label>
                            <Input name="adminPassword" type="text" value={formData.adminPassword} onChange={handleChange} placeholder="Min 6 characters" minLength={6} required />
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <DialogClose>
                            <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Company & Admin'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
