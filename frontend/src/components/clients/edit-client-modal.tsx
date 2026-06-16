'use client';

import React, { useEffect, useState } from 'react';
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button, Input, Label, Textarea } from '@/components/ui';
import { useClientStore } from '@/lib/zustand/clients/client';
import { useToast } from '@/components/ui/toast';
import { Client } from '@/lib/types/auth';
import { User, Mail, Phone, MapPin, Globe, Briefcase, X, Save, AlertTriangle, Trash2 } from 'lucide-react';

interface EditClientModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    client: Client | null;
}

type FormFields = Pick<Client, 'name' | 'email' | 'phone' | 'address' | 'website' | 'company_name' | 'location'>;

const emptyForm = (): FormFields => ({
    name: '', email: '', phone: '', address: '', website: '', company_name: '', location: '',
});

export function EditClientModal({ open, onOpenChange, client }: EditClientModalProps) {
    const { updateClient, clientsloading } = useClientStore();
    const { addToast } = useToast();

    const [formData, setFormData] = useState<FormFields>(emptyForm());

    // Sync form whenever the selected client changes
    useEffect(() => {
        if (client) {
            setFormData({
                name: client.name ?? '',
                email: client.email ?? '',
                phone: client.phone ?? '',
                address: client.address ?? '',
                website: client.website ?? '',
                company_name: client.company_name ?? '',
                location: client.location ?? '',
            });
        } else {
            setFormData(emptyForm());
        }
    }, [client]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const hasDiff = () =>
        !client ||
        formData.name !== (client.name ?? '') ||
        formData.email !== (client.email ?? '') ||
        formData.phone !== (client.phone ?? '') ||
        formData.address !== (client.address ?? '') ||
        formData.website !== (client.website ?? '') ||
        formData.company_name !== (client.company_name ?? '') ||
        formData.location !== (client.location ?? '');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name?.trim() || !formData.email?.trim()) {
            addToast({ title: 'Required Fields', description: 'Name and Email are necessary to update a client.', variant: 'warning' });
            return;
        }
        if (!hasDiff()) {
            addToast({ title: 'No changes', description: 'Nothing was changed to update.', variant: 'destructive' });
            return;
        }

        const ok = await updateClient(client!.id, formData);
        if (ok) {
            addToast({ title: 'Client Updated ✅', description: `${formData.name}'s profile has been updated.`, variant: 'success' });
            onOpenChange(false);
        } else {
            addToast({ title: 'Error', description: 'Failed to update client. Please try again.', variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[650px] max-h-[80vh] overflow-auto rounded-[2.5rem] border-none shadow-2xl p-0 custom-scrollbar bg-white/95 backdrop-blur-xl">
                <DialogHeader className="p-8 pb-4 bg-linear-to-b from-primary/5 to-transparent relative">
                    <DialogTitle className="text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        Edit Client Details
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground font-medium">
                        Modify the client's information below and save the changes.
                    </DialogDescription>

                </DialogHeader>

                <form onSubmit={handleSubmit} className="px-8 py-4 space-y-8 max-h-[70vh] overflow-y-auto scrollbar-hide">
                    {/* Primary Information */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-6 w-1 bg-primary rounded-full" />
                            <h4 className="text-xs font-bold uppercase tracking-widest text-primary/70">Main Contact</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="ec-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Client Name *</Label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                    <Input
                                        id="ec-name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="Acme Corp"
                                        className="pl-11 h-12 rounded-2xl bg-muted/30 border-border/40 focus:bg-white focus:ring-primary/5 transition-all"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ec-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Email Address *</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                    <Input
                                        id="ec-email"
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="contact@acme.com"
                                        className="pl-11 h-12 rounded-2xl bg-muted/30 border-border/40 focus:bg-white focus:ring-primary/5 transition-all"
                                        required
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
                                <Label htmlFor="ec-company" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Company Entity</Label>
                                <div className="relative">
                                    <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                    <Input
                                        id="ec-company"
                                        name="company_name"
                                        value={formData.company_name}
                                        onChange={handleChange}
                                        placeholder="Acme Corporation"
                                        className="pl-11 h-12 rounded-2xl bg-muted/30 border-border/40 focus:bg-white focus:ring-primary/5 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ec-website" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Corporate Website</Label>
                                <div className="relative">
                                    <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                    <Input
                                        id="ec-website"
                                        name="website"
                                        value={formData.website}
                                        onChange={handleChange}
                                        placeholder="https://acme.com"
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
                                <Label htmlFor="ec-phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Phone Number</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                    <Input
                                        id="ec-phone"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="+91 98765 43210"
                                        className="pl-11 h-12 rounded-2xl bg-muted/30 border-border/40 focus:bg-white focus:ring-primary/5 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ec-location" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Business Region</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                    <Input
                                        id="ec-location"
                                        name="location"
                                        value={formData.location}
                                        onChange={handleChange}
                                        placeholder="Mumbai, India"
                                        className="pl-11 h-12 rounded-2xl bg-muted/30 border-border/40 focus:bg-white focus:ring-primary/5 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ec-address" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Headquarters Address</Label>
                            <Input
                                id="ec-address"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                placeholder="123 Business Park, Suite 4"
                                className="h-12 rounded-2xl bg-muted/30 border-border/40 focus:bg-white focus:ring-primary/5 transition-all"
                            />
                        </div>
                    </div>
                </form>

                <DialogFooter className="p-8 pt-4 bg-muted/20 gap-3">
                    <Button
                        variant="ghost"
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="rounded-2xl h-12 font-bold px-6 border-transparent hover:bg-white transition-all"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        onClick={handleSubmit}
                        loading={clientsloading}
                        disabled={!hasDiff()}
                        className="rounded-2xl h-12 px-8 font-bold shadow-lg shadow-primary/20 transition-all"
                    >
                        <Save className="h-4 w-4 mr-2" /> Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// DELETE CLIENT MODAL MODERNIZED
export function DeleteClientModal({ open, onOpenChange, client }: { open: boolean; onOpenChange: (open: boolean) => void; client: Client | null }) {
    const { deleteClient, clientsloading } = useClientStore();
    const { addToast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!client) return;
        const ok = await deleteClient(client.id);
        if (ok) {
            addToast({ title: 'Client Removed ✅', description: `${client.name} has been deleted.`, variant: 'success' });
            onOpenChange(false);
        } else {
            addToast({ title: 'Error', description: 'Failed to delete client. Please try again.', variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white/95 backdrop-blur-xl">
                <div className="p-10 flex flex-col items-center text-center space-y-6">
                    <div className="h-20 w-20 rounded-3xl bg-destructive/10 flex items-center justify-center text-destructive animate-pulse">
                        <AlertTriangle className="h-10 w-10" />
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>Delete Client?</h3>
                        <p className="text-muted-foreground font-medium leading-relaxed">
                            Are you sure you want to delete <span className="text-foreground font-bold">{client?.name}</span>? This action is permanent and cannot be undone.
                        </p>
                    </div>

                    <div className="flex w-full gap-3 mt-4">
                        <Button
                            variant="ghost"
                            className="flex-1 rounded-2xl h-12 font-bold px-6 border border-border/40 hover:bg-muted transition-all"
                            onClick={() => onOpenChange(false)}
                        >
                            No, Keep It
                        </Button>
                        <Button
                            variant="destructive"
                            className="flex-1 rounded-2xl h-12 px-8 font-bold shadow-lg shadow-destructive/20 transition-all flex items-center justify-center gap-2"
                            onClick={handleSubmit}
                            loading={clientsloading}
                        >
                            <Trash2 className="h-4 w-4" /> Yes, Delete
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default DeleteClientModal;
