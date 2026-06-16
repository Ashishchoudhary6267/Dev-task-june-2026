import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuthStore } from '@/lib/zustand/user/user';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { subscribeToPushNotifications, unsubscribeFromPushNotifications } from '@/lib/push-notifications';
import api from '@/lib/api';
import { useToast } from '../ui';
import { Loader2, Bell, BellOff, User } from 'lucide-react';


export default function ProfileModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const { user } = useAuthStore();
    const [pushEnabled, setPushEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        // Check current subscription state from the service worker
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.ready.then(reg => {
                reg.pushManager.getSubscription().then(sub => {
                    setPushEnabled(!!sub);
                });
            });
        }
    }, [open]);

    const handleTogglePush = async (enabled: boolean) => {
        if (isLoading) return; // Prevent double-click
        setIsLoading(true);
        try {
            if (enabled) {
                const sub = await subscribeToPushNotifications();
                if (sub) {
                    await api.post('/push/subscribe', { subscription: sub });
                    addToast({
                        title: "Notifications Enabled! 🔔",
                        description: "You'll now receive push notifications.",
                        variant: "success",
                    });
                    setPushEnabled(true);
                } else {
                    addToast({
                        title: "Permission Denied",
                        description: "Please allow notifications in your browser settings.",
                        variant: "destructive",
                    });
                    setPushEnabled(false);
                }
            } else {
                const endpoint = await unsubscribeFromPushNotifications();
                if (endpoint) {
                    await api.post('/push/unsubscribe', { endpoint });
                }
                await api.post('/push/toggle', { enabled: false });
                addToast({
                    title: "Notifications Disabled",
                    description: "You will no longer receive push notifications.",
                    variant: "success",
                });
                setPushEnabled(false);
            }
        } catch (error) {
            console.error('Push toggle error:', error);
            addToast({
                title: "Error",
                description: "An error occurred while updating push settings.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto rounded-2xl">
                <DialogHeader>
                    <DialogTitle>Profile</DialogTitle>
                    <DialogDescription>
                        View your profile information and manage settings.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* User info */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="space-y-0.5 min-w-0">
                            <p className="font-semibold truncate">{user?.name}</p>
                            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                        </div>
                    </div>

                    {/* Push Notifications Toggle */}
                    <div className="flex items-center justify-between border-t pt-4">
                        <div className="space-y-0.5 flex-1 mr-4">
                            <div className="flex items-center gap-2">
                                {pushEnabled
                                    ? <Bell className="h-4 w-4 text-primary" />
                                    : <BellOff className="h-4 w-4 text-muted-foreground" />
                                }
                                <Label htmlFor="push-notifs" className="text-sm font-semibold cursor-pointer">
                                    Push Notifications
                                </Label>
                            </div>
                            <p className="text-xs text-muted-foreground pl-6">
                                Receive alerts even when the app is closed.
                            </p>
                        </div>

                        {/* Loading spinner replaces switch during API call */}
                        {isLoading ? (
                            <div className="h-6 w-11 flex items-center justify-center">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                        ) : (
                            <Switch
                                id="push-notifs"
                                checked={pushEnabled}
                                disabled={isLoading}
                                onCheckedChange={handleTogglePush}
                            />
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}