
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
import { Button, Input, Label, Select, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useAuthStore } from '@/lib/zustand/user/user';
import { useHolidayStore } from '@/lib/zustand/holidays/holiday';

interface AddHolidayModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddHolidayModal({ open, onOpenChange }: AddHolidayModalProps) {
    const { addToast } = useToast();
    const { addHoliday, loading } = useHolidayStore();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        type: 'One-time',
    });

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

        if (!formData.name || !formData.date) {
            addToast({
                title: 'Error',
                description: 'Please fill in Title and Date.',
                variant: 'destructive',
            });
            return;
        }
        try {
            const success = await addHoliday(
                new Date(formData.date),
                formData.name,
                formData.description,
                formData.type
            );

            if (success) {
                addToast({
                    title: 'Success',
                    description: 'Holiday added successfully.',
                    variant: 'success',
                });
                onOpenChange(false);
                setFormData({
                    name: '',
                    description: '',
                    date: new Date().toISOString().split('T')[0],
                    type: 'One-time',
                });
            }
        }
        catch (error) {
            addToast({
                title: 'Error',
                description: 'Failed to add holiday. Please try again.',
                variant: 'destructive',
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle>Add New Holiday</DialogTitle>
                    <DialogDescription>
                        Define a new company holiday to be excluded from working days.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="date" className="text-right">
                            Date
                        </Label>
                        <Input
                            id="date"
                            name="date"
                            type="date"
                            value={formData.date}
                            onChange={handleChange}
                            className="col-span-3"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Holiday Title
                        </Label>
                        <Input
                            id="name"
                            name="name"
                            placeholder="e.g. Christmas Day"
                            value={formData.name}
                            onChange={handleChange}
                            className="col-span-3"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4 w-full">
                        <Label htmlFor="type" className="text-right">Holiday Type</Label>
                        <Select
                            id="type"
                            value={formData.type}
                            onChange={(e) =>
                                setFormData({ ...formData, type: e.target.value })
                            }
                            className="w-full col-span-3"
                        >
                            <option value="One-time">One-time</option>
                            <option value="Recurring">Recurring</option>
                        </Select>
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
                </form>
                <DialogFooter>
                    <Button type="submit" onClick={handleSubmit} loading={loading}>
                        Save Holiday
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
