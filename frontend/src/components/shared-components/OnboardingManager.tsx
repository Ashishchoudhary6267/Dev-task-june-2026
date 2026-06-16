'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/zustand/user/user';
import { HowToModal } from '@/components/how-to/how-to-modal';
import { MemberHowToModal } from '@/components/how-to/memberHowTo';
import { AdminHowToModal } from '@/components/how-to/AdminHowToModal';

export function OnboardingManager() {
    const { user } = useAuthStore();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const hasTriggered = useRef(false);

    useEffect(() => {
        // Only check on dashboard routes and when user is loaded
        if (!user || hasTriggered.current) return;
        if (!pathname.startsWith('/dashboard')) return;

        const timer = setTimeout(() => {
            const seenKey = `fms-onboarding-seen-${user.id}`;
            const hasSeen = localStorage.getItem(seenKey);
            
            // If they've already seen it, don't show again
            if (hasSeen === 'true') {
                sessionStorage.removeItem('fms-show-onboarding');
                return;
            }

            // Check if the flag was set in sessionStorage (set during login for first-time users)
            const shouldShow = sessionStorage.getItem('fms-show-onboarding');
            if (shouldShow === 'true') {
                // Remove immediately to prevent double-triggers
                sessionStorage.removeItem('fms-show-onboarding');
                
                // Mark as seen permanently for this user ID
                localStorage.setItem(seenKey, 'true');
                
                hasTriggered.current = true;
                setOpen(true);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [pathname, user]);

    if (!user || !open) return null;

    if (user.platform_role === 'member') {
        return <MemberHowToModal userName={user.name} open={open} onOpenChange={setOpen} />;
    }

    if (user.platform_role === 'admin') {
        return <AdminHowToModal userName={user.name} open={open} onOpenChange={setOpen} />;
    }

    // Controller, Superadmin see the workflow-focused tutorial
    return <HowToModal userName={user.name} open={open} onOpenChange={setOpen} />;
}
