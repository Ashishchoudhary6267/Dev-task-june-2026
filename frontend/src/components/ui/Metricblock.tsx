import React from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from './tooltip';
import { Info } from 'lucide-react';

function ProgressBar({ value, max = 100, colorClass }: { value: number; max?: number; colorClass: string }) {
    const pct = Math.min(Math.abs(value) / max * 100, 100);
    return (
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
        </div>
    );
}

export default function MetricBlock({ label, value, target, barValue, barMax = 100, barColor, note, noteColor, tooltip }: {
    label: string; value: string; target: string;
    barValue: number; barMax?: number; barColor: string;
    note?: string; noteColor?: string; tooltip?: string;
}) {
    return (
        <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-1 min-w-0">
                    <span className="text-xs font-medium text-foreground truncate">{label}</span>
                    {tooltip && (
                        <Tooltip delay={200}>
                            <TooltipTrigger asChild>
                                <button className="focus:outline-none shrink-0">
                                    <Info className="h-3 w-3 text-muted-foreground hover:text-primary transition-colors cursor-help" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px] px-2 py-1">
                                {tooltip}
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
                <span className="text-xs font-bold text-foreground shrink-0">{value}</span>
            </div>
            <ProgressBar value={barValue} max={barMax} colorClass={barColor} />
            <p className="text-[10px] text-muted-foreground mt-1">{target}</p>
            {note && <p className={`text-[10px] font-medium mt-0.5 ${noteColor}`}>{note}</p>}
        </div>
    );
}