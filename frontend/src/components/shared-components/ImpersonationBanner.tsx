'use client';

import { useAuthStore } from '@/lib/zustand/user/user';
import { Button } from '@/components/ui';
import { LogOut, UserCog } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function ImpersonationBanner() {
    const { user, impersonatingFrom, stopImpersonating } = useAuthStore();
    const router = useRouter();

    if (!impersonatingFrom || !user) return null;

    const handleExit = () => {
        stopImpersonating();
        router.push('/dashboard/admin'); // Go back to superadmin area
    };

    return (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between sticky top-0 z-[10000] shadow-md animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white/20 rounded-lg">
                    <UserCog className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-sm font-medium">
                        Viewing as <span className="font-bold underline">{user.name}</span> ({user.platform_role})
                    </p>
                    <p className="text-[10px] opacity-90 leading-tight">
                        You are in impersonation mode. All actions performed will act as this user.
                    </p>
                </div>
            </div>
            
            <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExit}
                className="bg-white/10 hover:bg-white/20 border-white/30 text-white gap-2 transition-all hover:scale-105 active:scale-95"
            >
                <LogOut className="h-4 w-4" />
                Exit Impersonation
            </Button>
        </div>
    );
}
