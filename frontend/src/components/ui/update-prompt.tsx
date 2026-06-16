import React, { useEffect, useRef } from 'react';
import { useUpdateStore } from '@/lib/zustand/updates/updates';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface UpdatePromptProps {
    onRefresh: () => void;
}

export function UpdatePrompt({ onRefresh }: UpdatePromptProps) {
    const { hasUpdates, setHasUpdates } = useUpdateStore();

    // Keep onRefresh in a ref so the timeout always calls the latest version
    // without it being a dep that resets the timer.
    const onRefreshRef = useRef(onRefresh);
    onRefreshRef.current = onRefresh;

    useEffect(() => {
        if (!hasUpdates) return;

        // Auto-refresh after 3 seconds so the controller/reviewer never has to
        // manually click the banner — they just see updated data automatically.
        const autoRefreshId = setTimeout(() => {
            onRefreshRef.current();
            setHasUpdates(false);
        }, 3000);

        // Also auto-dismiss the banner after 10 s even if somehow not refreshed
        const dismissId = setTimeout(() => {
            setHasUpdates(false);
        }, 10000);

        return () => {
            clearTimeout(autoRefreshId);
            clearTimeout(dismissId);
        };
    }, [hasUpdates, setHasUpdates]);

    if (!hasUpdates) return null;

    const handleRefresh = () => {
        onRefreshRef.current();
        setHasUpdates(false);
    };

    return (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-150 animate-in slide-in-from-top-12 fade-in duration-500">
            <button
                onClick={handleRefresh}
                className={cn(
                    "flex items-center gap-2.5 px-5 py-2.5 rounded-full",
                    "bg-white/80 backdrop-blur-md border border-blue-200/50",
                    "shadow-[0_8px_30px_rgb(0,0,0,0.12)] shadow-blue-500/10",
                    "hover:shadow-[0_8px_30px_rgb(0,0,0,0.16)] hover:shadow-blue-500/20",
                    "hover:scale-[1.02] active:scale-[0.98] transition-all duration-300",
                    "text-blue-600 font-bold text-xs uppercase tracking-wider cursor-pointer group"
                )}
            >
                <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </div>

                <span className="flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 group-hover:rotate-180 transition-transform duration-500" />
                    Updates Available
                </span>

                <div className="h-4 w-px bg-blue-200/50 mx-0.5" />

                <span className="text-[10px] text-blue-400 group-hover:text-blue-500 transition-colors">
                    Auto-syncing…
                </span>
            </button>
        </div>
    );
}
