
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
import { Button, Input, Label, UISelect, Textarea } from '@/components/ui';
import { Clock, DollarSign, Layers, Repeat, Zap } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useAuthStore } from '@/lib/zustand/user/user';
import { useProjectStore } from '@/lib/zustand/projects/createproject';
import { useClientStore } from '@/lib/zustand/clients/client';
import { useStatsStore } from '@/lib/zustand/stats/dashboard-stats';

interface AddProjectModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    companyId?: string;
    onSuccess?: () => void;
}

export function AddProjectModal({ open, onOpenChange, companyId, onSuccess }: AddProjectModalProps) {
    const { addToast } = useToast();
    const { user } = useAuthStore();
    const { addProject, projectsloading, projectserror } = useProjectStore();
    const [formData, setFormData] = useState({
        // client_id: '',
        name: '',
        description: '',
        company_id: companyId || user?.company_id || '',
        start_date: new Date(),
        template_type: '',
        category: '',

    });
    const { clients, fetchClients, clientsCount, clientsloading, clientserror } = useClientStore();
    const { fetchStats } = useStatsStore();


    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Basic validation
        if (!formData.name) {
            addToast({
                title: 'Error',
                description: 'Please fill in all required fields.',
                variant: 'destructive',
            });
            return;
        }
        try {
            const success = await addProject(
                formData.name,
                // formData.client_id,
                formData.category,
                formData.description,
                companyId || formData.company_id || user?.company_id || '',
                formData.start_date,
                formData.template_type,
            );

            if (success) {
                addToast({
                    title: 'Success',
                    description: 'Template added successfully.',
                    variant: 'success',
                });
                onOpenChange(false);
                fetchStats();
                if (onSuccess) onSuccess();
                setFormData({
                    name: '',
                    description: '',
                    company_id: companyId || '',
                    template_type: '',
                    category: '',
                    start_date: new Date(),
                });
            }
        }
        catch (error: any) {
            addToast({
                title: 'Error',
                description: projectserror || 'Failed to add user. Please try again.',
                variant: 'destructive',
            });
        }
        finally {
            setFormData({
                // client_id: '',
                name: '',
                description: '',
                company_id: companyId || '',
                template_type: '',
                category: '',
                start_date: new Date(),
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle>Add New Template</DialogTitle>
                    <DialogDescription>
                        Create a new template. Click save when you're done.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Template Name
                        </Label>
                        <Input
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="col-span-3"
                            required
                        />
                    </div>
                    {/* <div className="grid grid-cols-4 items-center gap-4 w-full">
                        <Label htmlFor="client_id" className="text-right">Client Name</Label>
                        <Select
                            id="client_id"
                            value={formData.client_id}
                            onChange={(e) =>
                                setFormData({ ...formData, client_id: e.target.value })
                            }
                            className="w-full"
                        >
                            <option value="" disabled>
                                Select a client…
                            </option>
                            {clients.map((client) => (
                                <option key={client.id} value={client.id}>
                                    {client.name}
                                </option>
                            ))}
                        </Select>
                    </div> */}

                    {/* not doen in backend yet */}
                    <div className="grid grid-cols-4 items-center gap-4 w-full">
                        <Label htmlFor="template_type" className="text-right">Template Type</Label>
                        <UISelect
                            id="template_type"
                            value={formData.template_type}
                            onValueChange={(val) =>
                                setFormData({ ...formData, template_type: val })
                            }
                            className="col-span-3"
                            placeholder="Select a type.."
                            options={[
                                { value: 'one-time', label: 'One Time', icon: Layers },
                                { value: 'recurring', label: 'Recurring', icon: Clock },
                                { value: 'micro', label: 'Micro Template', icon: Zap },
                                { value: 'billing', label: 'Billing', icon: DollarSign }
                            ]}
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category" className="text-right">
                            Category
                        </Label>
                        <Input
                            id="category"
                            name="category"
                            placeholder='e.g. Client Management, Campaign Execution'
                            value={formData.category}
                            onChange={handleChange}
                            className="col-span-3"
                        // required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="description" className="text-right">
                            Description
                        </Label>
                        <Textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            className="col-span-3"
                            required
                        />
                    </div>
                    {/* <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="starting_date" className="text-right">
                            Starting Date
                        </Label>
                        <Input
                            id="start_date"
                            name="start_date"
                            type="date"
                            onChange={handleChange}
                            className="col-span-3"
                            required
                        />
                    </div> */}

                    {/* 
                        Ideally, Platform Role would be a Select component. 
                        For now using a simple input or we could add a Select if we had the options.
                        Let's assume simple input for the ID fields for MVP as requested.
                     */}


                </form>
                <DialogFooter>
                    <Button type="submit" onClick={handleSubmit} loading={projectsloading}>
                        Save changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
