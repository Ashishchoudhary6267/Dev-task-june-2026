import { useState, useEffect } from 'react';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Button, Input, Label, UISelect } from '@/components/ui';
import { Copy, Users, FileText, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useInstanceStore } from '@/lib/zustand/instances/instances';
import { useClientStore } from '@/lib/zustand/clients/client';
import { cn } from '@/lib/utils';
import { AddClientModal } from '../clients/add-client-modal';

interface CloneInstanceModalProps {
    instance: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CloneInstanceModal({ instance, open, onOpenChange }: CloneInstanceModalProps) {
    const { addToast } = useToast();
    const { cloneInstance } = useInstanceStore();
    const { clients, fetchClients } = useClientStore();

    const [newName, setNewName] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [targetType, setTargetType] = useState<'CLIENT' | 'SERVICE'>('CLIENT');
    const [isLoading, setIsLoading] = useState(false);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

    useEffect(() => {
        if (instance) {
            setNewName(`Copy of ${instance.name}`);
            setSelectedClientId(instance.client_id || '');
        }
    }, [instance, open]);
    useEffect(() => {
        if (open) fetchClients(undefined, 1, 100);
    }, [open]);

    const handleClone = async () => {
        if (!newName.trim()) {
            addToast({ title: 'Name required', description: 'Please enter a name for the new instance.', variant: 'destructive' });
            return;
        }

        try {
            const success = await cloneInstance(instance.id, newName.trim(), selectedClientId);
            if (success) {
                addToast({ title: 'Instance cloned', description: `Successfully created "${newName}".`, variant: 'default' });
                onOpenChange(false);
            }
        } catch (error: any) {
            console.error(error);
            const errorMessage = error?.response?.data?.message || 'Could not clone instance. Please try again.';
            addToast({ title: 'Cloning failed', description: errorMessage, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-tight">
                        {/* <Copy className="h-5 w-5 text-primary" /> */}
                        Clone Instance
                    </DialogTitle>
                    <DialogDescription className="text-xs font-medium">
                        Create a new instance based on <span className="font-bold text-foreground">"{instance?.name}"</span>.
                        Tasks will be reset to their initial state.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                            <FileText className="h-3 w-3" /> New Instance Name
                        </Label>
                        <Input
                            placeholder="Enter new instance name..."
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="h-11 rounded-xl border-border/60 bg-muted/20 px-4 focus:ring-4 focus:ring-primary/5 transition-all"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between ml-1">
                            <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground flex items-center gap-2">
                                <Users className="h-3 w-3" /> Target Entity
                            </Label>

                            <div className="flex p-0.5 bg-muted/30 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setTargetType('CLIENT')}
                                    className={cn(
                                        "px-2 py-1 rounded-md text-[9px] font-bold transition-all",
                                        targetType === 'CLIENT' ? "bg-white shadow-xs text-primary" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    CLIENT
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTargetType('SERVICE')}
                                    className={cn(
                                        "px-2 py-1 rounded-md text-[9px] font-bold transition-all",
                                        targetType === 'SERVICE' ? "bg-white shadow-xs text-primary" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    SERVICE
                                </button>
                            </div>
                        </div>

                        <div className="relative group">
                            <div className="rounded-xl border border-border/60 bg-muted/20 pr-10">
                                <UISelect
                                    value={selectedClientId}
                                    onValueChange={(val) => setSelectedClientId(val)}
                                    options={[
                                        { value: '', label: targetType === 'CLIENT' ? 'Internal / No Client' : 'Select Service' },
                                        ...((clients || [])
                                            .filter((c: any) => (c.type || 'CLIENT') === targetType)
                                            .map((c: any) => ({
                                                value: c.id,
                                                label: c.name,
                                            })))
                                    ]}
                                    className="w-full"
                                    triggerClassName="h-11 border-none shadow-none focus:ring-0 bg-transparent"
                                />

                                <button
                                    onClick={() => setIsQuickAddOpen(true)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-lg bg-primary text-white flex items-center justify-center shadow-xs hover:bg-primary/90 transition-all"
                                    title={targetType === 'CLIENT' ? "Add Client" : "Add Service"}
                                >
                                    <Plus className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <AddClientModal open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen} />

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                        className="h-10 rounded-xl font-bold flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 rounded-xl font-bold shadow-lg shadow-primary/20 flex-1"
                        onClick={handleClone}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Cloning...' : 'Create Clone'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
