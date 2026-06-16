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
import { Button, Input, Label, Textarea } from '@/components/ui';
import { useClientStore } from '@/lib/zustand/clients/client';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { Client } from '@/lib/types/auth';
import { useAuthStore } from '@/lib/zustand/user/user';
import { useStatsStore } from '@/lib/zustand/stats/dashboard-stats';
import { User, Mail, Phone, MapPin, Globe, Briefcase, Plus, X } from 'lucide-react';

interface AddClientModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddClientModal({ open, onOpenChange }: AddClientModalProps) {
    const { createClient, clientsloading } = useClientStore();
    const { addToast } = useToast();
    const { user } = useAuthStore();
    const [formData, setFormData] = useState<Partial<Client>>({
        company_id: user?.company_id,
        name: '',
        email: '',
        phone: '',
        address: '',
        website: '',
        company_name: '',
        location: '',
        type: 'CLIENT',
    });
    const { fetchStats } = useStatsStore();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // If it's a service, we only really need the name.
        const isClient = formData.type === 'CLIENT';
        if (!formData.name || (isClient && !formData.email)) {
            addToast({
                title: 'Required Fields',
                description: isClient ? 'Name and Email are necessary to register a client.' : 'Service name is required.',
                variant: 'warning',
            });
            return;
        }

        // For services without email, we can provide a dummy or empty one if the DB requires it
        const finalData = { ...formData };
        if (!isClient && !finalData.email) {
            finalData.email = `${formData.name.replace(/\s+/g, '').toLowerCase()}@service.internal`;
        }

        try {
            const success = await createClient(finalData as Client);

            if (success) {
                addToast({
                    title: formData.type === 'CLIENT' ? 'Client Added' : 'Service Added',
                    description: `${formData.name} has been successfully registered.`,
                    variant: 'success',
                });
                fetchStats();
                handleClose();
            }
        } catch (error) {
            addToast({
                title: 'Error',
                description: 'Failed to add client. Please try again.',
                variant: 'destructive',
            });
        }
    };

    const handleClose = () => {
        onOpenChange(false);
        setFormData({
            company_id: user?.company_id,
            name: '',
            email: '',
            phone: '',
            address: '',
            website: '',
            company_name: '',
            location: '',
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[650px] max-h-[80vh] overflow-auto rounded-[2.5rem] border-none shadow-2xl p-0 custom-scrollbar bg-white/95 backdrop-blur-xl">
                <DialogHeader className="p-8 pb-4 bg-linear-to-b from-primary/5 to-transparent relative">
                    <DialogTitle className="text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        Add New Client
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground font-medium">
                        Fill in the details below to register a new client in your workspace.
                    </DialogDescription>

                </DialogHeader>

                <form onSubmit={handleSubmit} className="px-8 py-4 space-y-8">
                    {/* Entry Type Selection */}
                    {/* <div className="flex p-1 bg-muted/30 rounded-2xl w-full max-w-sm mx-auto">
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, type: 'CLIENT' }))}
                            className={cn(
                                "flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-300",
                                formData.type === 'CLIENT' ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:bg-white/50"
                            )}
                        >
                            CLIENT
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, type: 'SERVICE' }))}
                            className={cn(
                                "flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-300",
                                formData.type === 'SERVICE' ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:bg-white/50"
                            )}
                        >
                            SERVICE
                        </button>
                    </div> */}

                    {/* Primary Information */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-6 w-1 bg-primary rounded-full" />
                            <h4 className="text-xs font-bold uppercase tracking-widest text-primary/70">
                                {formData.type === 'CLIENT' ? 'Main Contact' : 'Service Identity'}
                            </h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                                    {formData.type === 'CLIENT' ? 'Client Name *' : 'Service Name *'}
                                </Label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                    <Input
                                        id="name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder={formData.type === 'CLIENT' ? 'Acme Corp' : 'e.g. Building Rent'}
                                        className="pl-11 h-12 rounded-2xl bg-muted/30 border-border/40 focus:bg-white focus:ring-primary/5 transition-all"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                                    Email Address {formData.type === 'CLIENT' ? '*' : '(Optional)'}
                                </Label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="contact@acme.com"
                                        className="pl-11 h-12 rounded-2xl bg-muted/30 border-border/40 focus:bg-white focus:ring-primary/5 transition-all"
                                        required={formData.type === 'CLIENT'}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Secondary Information */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-6 w-1 bg-primary rounded-full opacity-40" />
                            <h4 className="text-xs font-bold uppercase tracking-widest text-primary/70">Company Details</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="company_name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Company Entity</Label>
                                <div className="relative">
                                    <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                    <Input
                                        id="company_name"
                                        name="company_name"
                                        value={formData.company_name}
                                        onChange={handleChange}
                                        placeholder="Acme International"
                                        className="pl-11 h-12 rounded-2xl bg-muted/30 border-border/40 focus:bg-white focus:ring-primary/5 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="website" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Corporate Website</Label>
                                <div className="relative">
                                    <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                    <Input
                                        id="website"
                                        name="website"
                                        value={formData.website}
                                        onChange={handleChange}
                                        placeholder="acme.com"
                                        className="pl-11 h-12 rounded-2xl bg-muted/30 border-border/40 focus:bg-white focus:ring-primary/5 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Logistics */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-6 w-1 bg-primary rounded-full opacity-20" />
                            <h4 className="text-xs font-bold uppercase tracking-widest text-primary/70">Location & Outreach</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Phone Number</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                    <Input
                                        id="phone"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="+1 (555) 000-0000"
                                        className="pl-11 h-12 rounded-2xl bg-muted/30 border-border/40 focus:bg-white focus:ring-primary/5 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="location" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Business Region</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                    <Input
                                        id="location"
                                        name="location"
                                        value={formData.location}
                                        onChange={handleChange}
                                        placeholder="New York, USA"
                                        className="pl-11 h-12 rounded-2xl bg-muted/30 border-border/40 focus:bg-white focus:ring-primary/5 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Headquarters Address</Label>
                            <Input
                                id="address"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                placeholder="123 Business Boulevard, Suite 500"
                                className="h-12 rounded-2xl bg-muted/30 border-border/40 focus:bg-white focus:ring-primary/5 transition-all"
                            />
                        </div>
                    </div>
                </form>

                <DialogFooter className="p-8 pt-4 bg-muted/20 gap-3">
                    <Button
                        variant="ghost"
                        onClick={handleClose}
                        className="rounded-2xl h-12 font-bold px-6 border-transparent hover:bg-white transition-all"
                    >
                        Discard
                    </Button>
                    <Button
                        type="submit"
                        onClick={handleSubmit}
                        loading={clientsloading}
                    >
                        Create Profile
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
