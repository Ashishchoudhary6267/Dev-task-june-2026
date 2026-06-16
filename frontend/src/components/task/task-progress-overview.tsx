import React from 'react';
import { useTaskStore } from '@/lib/zustand/tasks/tasks';

interface TaskProgressOverviewProps {
    onTabSelect?: (tab: 'all' | 'workerTasks' | 'approvalTasks' | 'pendingApprovalTasks' | 'upcomingTasks' | 'completedTasks' | 'reviewedTasks' | 'upcomingReviews') => void;
}

export function TaskProgressOverview({ onTabSelect }: TaskProgressOverviewProps) {
    const { myTasksCounts } = useTaskStore();
    const completed = myTasksCounts.completedTasks || 0;
    const inProgress = myTasksCounts.workerTasks || 0;
    const upcoming = myTasksCounts.upcomingTasks || 0;
    const pendingApproval = myTasksCounts.approvalTasks || 0; // Awaiting sign-off (you are approver)
    const underReview = myTasksCounts.pendingApprovalTasks || 0; // Submitted by you
    const overdue = myTasksCounts.overdue || 0;

    const total = completed + inProgress + upcoming + pendingApproval + underReview;

    const getPct = (val: number) => total === 0 ? 0 : (val / total) * 100;

    return (
        <div className="space-y-4 mb-6">
            {/* Top Progress Bar Container */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">Task progress overview</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            All {total} tasks across active workflows • <span className="font-medium text-foreground">{total > 0 ? Math.round(getPct(completed)) : 0}% completed</span>
                        </p>
                        {overdue > 0 && (
                            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold animate-pulse border border-red-500/20 shadow-sm">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                                {overdue} OVERDUE {overdue === 1 ? 'TASK' : 'TASKS'}
                            </div>
                        )}
                    </div>
                    <div className="text-3xl font-medium text-foreground">
                        {total}
                    </div>
                </div>

                {/* Segmented Progress Bar */}
                <div className="flex h-3.5 w-full overflow-hidden gap-1 mb-6">
                    {completed > 0 && <div style={{ width: `${getPct(completed)}%` }} className={`bg-[#376e37] transition-all duration-500 rounded-l-full hover:${myTasksCounts.completedTasks > 0 ? 'cursor-pointer' : 'cursor-not-allowed'}`} />}
                    {inProgress > 0 && <div style={{ width: `${getPct(inProgress)}%` }} className="bg-[#3e85ef] transition-all duration-500" />}
                    {pendingApproval > 0 && <div style={{ width: `${getPct(pendingApproval)}%` }} className="bg-[#de4d7c] transition-all duration-500" />}
                    {underReview > 0 && <div style={{ width: `${getPct(underReview)}%` }} className="bg-[#908e82] transition-all duration-500" />}
                    {upcoming > 0 && <div style={{ width: `${getPct(upcoming)}%` }} className="bg-[#f29f33] transition-all duration-500 rounded-r-full" />}
                    {overdue > 0 && <div style={{ width: `${getPct(overdue)}%` }} className="bg-red-500 transition-all duration-500 rounded-r-full" />}
                    {/* Fallback empty bar if no tasks */}
                    {total === 0 && <div className="w-full bg-muted rounded-full" />}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground mb-1">
                    <LegendItem color="#376e37" label="Completed" count={completed} />
                    <LegendItem color="#3e85ef" label="In progress" count={inProgress} />
                    <LegendItem color="#de4d7c" label="Pending approval" count={pendingApproval} />
                    <LegendItem color="#908e82" label="Under review" count={underReview} />
                    <LegendItem color="#f29f33" label="Upcoming" count={upcoming} />
                    {overdue > 0 && <LegendItem color="#ef4444" label="Overdue" count={overdue} />}
                </div>
            </div>

            {/* Metric Cards Row */}
            {/* <div className="flex flex-wrap gap-4">
                <MetricCard
                    title="Completed"
                    value={completed}
                    subtitle={`${total > 0 ? Math.round(getPct(completed)) : 0}% of total`}
                    colorClass="text-[#71a53b]"
                    borderColor="#71a53b"
                    onClick={() => onTabSelect?.('completedTasks')}
                />
                <MetricCard
                    title="Overdue"
                    value={overdue}
                    subtitle="Requires urgent attention"
                    colorClass="text-red-500 text-bold"
                    borderColor="#ef4444"
                    onClick={() => onTabSelect?.('workerTasks')}
                />
                <MetricCard
                    title="In progress"
                    value={inProgress}
                    subtitle="Active tasks"
                    colorClass="text-[#3e85ef]"
                    borderColor="#3e85ef"
                    onClick={() => onTabSelect?.('workerTasks')}
                />
                <MetricCard
                    title="Pending approval"
                    value={pendingApproval}
                    subtitle="Awaiting sign-off"
                    colorClass="text-[#de4d7c]"
                    borderColor="#de4d7c"
                    onClick={() => onTabSelect?.('approvalTasks')}
                />
            </div> */}
        </div>
    );
}

function LegendItem({ color, label, count }: { color: string, label: string, count: number }) {
    return (
        <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></div>
            <span className="text-muted-foreground">{label}</span>
            <span className="font-bold ml-0.5">{count}</span>
        </div>
    );
}

function MetricCard({
    title, value, subtitle, colorClass, borderColor, onClick
}: {
    title: string, value: number, subtitle: string, colorClass: string, borderColor: string, onClick?: () => void
}) {
    return (
        <div
            onClick={onClick}
            className="flex-1 min-w-[180px] bg-card rounded-xl border border-border p-5 shadow-sm cursor-pointer hover:shadow-md hover:bg-muted/10 transition-all border-t-[3px]"
            style={{ borderTopColor: borderColor }}
        >
            <h3 className="text-sm font-medium text-foreground mb-4">{title}</h3>
            <div className={`text-4xl tracking-tight mb-2 ${colorClass}`}>{value}</div>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
    );
}
