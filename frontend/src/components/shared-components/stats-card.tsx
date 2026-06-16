import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp } from 'lucide-react';

interface StatsCardProps {
    icon: React.ReactNode;
    /** Tailwind gradient classes e.g. "from-blue-500 to-cyan-400" */
    gradient: string;
    /** Hex or Tailwind shadow color e.g. "shadow-blue-500/30" */
    shadowColor?: string;
    title: string;
    value: string;
    sub?: string;
    trend?: string;
}

export function StatsCard({ icon, gradient, shadowColor = 'shadow-primary/20', title, value, sub, trend }: StatsCardProps) {
    return (
        <div
            className={cn(
                'group relative overflow-hidden rounded-2xl p-5 text-white transition-all duration-300 hover:-translate-y-1.5',
                'bg-linear-to-br',
                gradient,
                'shadow-lg',
                shadowColor
            )}
        >
            {/* Decorative background circles */}
            <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 transition-transform duration-500 group-hover:scale-125" />
            <div className="pointer-events-none absolute -bottom-8 -left-4 h-20 w-20 rounded-full bg-white/5" />

            {/* Icon */}
            <div className="relative z-10 mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-inner">
                <div className="text-white [&_svg]:h-5 [&_svg]:w-5">{icon}</div>
            </div>

            {/* Value */}
            <div className="relative z-10 mb-1 text-3xl font-extrabold tracking-tight drop-shadow-sm">
                {value}
            </div>

            {/* Title */}
            <p className="relative z-10 text-[11px] font-bold uppercase tracking-widest text-white/70">
                {title}
            </p>

            {/* Sub / Trend */}
            {(sub || trend) && (
                <div className="relative z-10 mt-3 flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 w-fit">
                    {trend && <TrendingUp className="h-3 w-3 text-white/90" />}
                    <span className="text-[10px] font-semibold text-white/90">{sub || trend}</span>
                </div>
            )}
        </div>
    );
}
