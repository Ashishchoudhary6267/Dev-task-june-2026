import { MemberPerformanceSummary } from "@/lib/types/auth";
import MetricBlock from "../ui/Metricblock";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, Cell
} from 'recharts';

export default function TeamOverview({ members }: { members: MemberPerformanceSummary[] }) {
    const totalCompleted = members.reduce((s, m) => s + m.completed, 0);
    const totalInProgress = members.reduce((s, m) => s + m.inProgress, 0);
    const totalPending = members.reduce((s, m) => s + m.pending, 0);
    const totalOverdue = members.reduce((s, m) => s + m.overdue, 0);
    const count = members.length || 1;
    const avgOnTime = Math.round(members.reduce((s, m) => s + m.onTimeDelivery, 0) / count);
    const avgEfficiency = Math.round(members.reduce((s, m) => s + m.taskEfficiency, 0) / count);
    const membersWithQuality = members.filter((m) => m.qualityScore !== null && m.qualityScore !== undefined);
    const avgQuality = membersWithQuality.length > 0
        ? Math.round(membersWithQuality.reduce((s, m) => s + (m.qualityScore as number), 0) / membersWithQuality.length)
        : null;
    const topPerformers = [...members].sort((a, b) => b.onTimeDelivery - a.onTimeDelivery).slice(0, 5);

    function qualityBarColor(score: number) {
        if (score >= 80) return 'bg-green-500';
        if (score >= 60) return 'bg-blue-500';
        if (score >= 40) return 'bg-amber-500';
        return 'bg-red-500';
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Completed Tasks', val: totalCompleted, sub: 'Total completed by team', cls: 'text-green-600' },
                    { label: 'In Progress', val: totalInProgress, sub: 'Currently being worked on', cls: 'text-blue-600' },
                    { label: 'Pending', val: totalPending, sub: 'Not yet started', cls: 'text-foreground' },
                    { label: 'Overdue', val: totalOverdue, sub: 'Requires attention', cls: 'text-red-600' },
                ].map(card => (
                    <div key={card.label} className="rounded-xl border border-border bg-card p-5">
                        <p className="text-sm font-medium text-foreground mb-1">{card.label}</p>
                        <p className={`text-3xl font-bold ${card.cls}`}>{card.val}</p>
                        <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                    </div>
                ))}
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-base font-semibold text-foreground mb-0.5">Team Averages</h3>
                <p className="text-xs text-muted-foreground mb-4">
                    Average performance metrics across <span className="text-primary">all</span> team members
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
                    <MetricBlock
                        label="On-Time Delivery"
                        value={`${avgOnTime}%`}
                        target=""
                        barValue={avgOnTime}
                        barColor="bg-foreground"
                        tooltip="Average percentage of tasks completed before deadline."
                    />
                    <MetricBlock
                        label="Task Efficiency"
                        value={`${avgEfficiency > 0 ? '+' : ''}${avgEfficiency}%`}
                        target=""
                        barValue={Math.abs(avgEfficiency)}
                        barColor={avgEfficiency >= 0 ? 'bg-green-500' : 'bg-foreground'}
                        tooltip="Average SLA health across all team members."
                    />
                    <MetricBlock
                        label="Quality Score"
                        value={avgQuality !== null ? `${avgQuality}/100` : 'N/A'}
                        target=""
                        barValue={avgQuality ?? 0}
                        barColor={avgQuality !== null ? qualityBarColor(avgQuality) : 'bg-muted'}
                        tooltip="Average rework-based quality rating."
                    />
                </div>
            </div>

            {/* Performance Distribution Chart */}
            <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-base font-semibold text-foreground mb-0.5">Performance Distribution</h3>
                        <p className="text-xs text-muted-foreground">Comparative ranking of team members by key metrics (Top-5)</p>
                    </div>
                </div>

                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={[...members]
                                .sort((a, b) => b.onTimeDelivery - a.onTimeDelivery)
                                .slice(0, 5)
                                .map(m => ({
                                    name: m.name,
                                    onTime: m.onTimeDelivery,
                                    quality: m.qualityScore ?? 0,
                                    efficiency: m.taskEfficiency,
                                    completed: m.completed,
                                    hasQuality: m.qualityScore !== null
                                }))}
                            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                            barGap={8}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fill: '#64748B' }}
                                interval={0}
                                angle={-15}
                                textAnchor="end"
                                height={60}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fill: '#64748B' }}
                                domain={[0, 100]}
                                tickFormatter={(v) => `${v}%`}
                            />
                            <Tooltip
                                cursor={{ fill: '#F8FAFC' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-white border border-border shadow-xl rounded-lg p-3 min-w-[200px] z-50">
                                                <p className="font-bold text-sm text-foreground mb-2">{data.name}</p>
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-muted-foreground">On-Time Delivery</span>
                                                        <span className="font-bold text-blue-600">{data.onTime}%</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-muted-foreground">Quality Score</span>
                                                        <span className="font-bold text-amber-600">{data.hasQuality ? `${data.quality}/100` : 'N/A'}</span>
                                                    </div>
                                                    <div className="pt-1.5 border-t border-slate-100 flex justify-between items-center text-[10px]">
                                                        <span className="text-muted-foreground italic">Efficiency: {data.efficiency}%</span>
                                                        <span className="text-muted-foreground italic">{data.completed} tasks</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Legend
                                verticalAlign="top"
                                align="right"
                                iconType="circle"
                                wrapperStyle={{ paddingBottom: '20px', fontSize: '11px', fontWeight: 600 }}
                            />
                            <Bar
                                dataKey="onTime"
                                name="On-Time %"
                                fill="#2563EB"
                                radius={[4, 4, 0, 0]}
                                barSize={24}
                            />
                            <Bar
                                dataKey="quality"
                                name="Quality Score"
                                fill="#F59E0B"
                                radius={[4, 4, 0, 0]}
                                barSize={24}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-base font-semibold text-foreground mb-0.5">Top Performers</h3>
                <p className="text-xs text-muted-foreground mb-4">
                    Team members with highest <span className="text-primary">on-time delivery</span>
                </p>
                <div className="space-y-3">
                    {topPerformers.map((m, i) => (
                        <div key={m.id} className="flex items-center gap-4">
                            <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">{i + 1}</span>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">{m.name}</p>
                                <p className="text-xs text-muted-foreground">{m.completed} completed • {m.onTimeDelivery}% on-time</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <span className={`text-xs font-semibold px-2 py-1 rounded-md ${m.taskEfficiency >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {m.taskEfficiency > 0 ? '+' : ''}{m.taskEfficiency}% eff.
                                </span>
                                {/* <span className={`text-xs font-semibold px-2 py-1 rounded-md ${m.qualityScore === null ? 'bg-muted text-muted-foreground' : m.qualityScore >= 75 ? 'bg-blue-100 text-blue-700' : m.qualityScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                    {m.qualityScore !== null && m.qualityScore !== undefined ? `Q: ${m.qualityScore}` : 'Q: N/A'}
                                </span> */}
                            </div>
                        </div>
                    ))}
                    {topPerformers.length === 0 && (
                        <p className="text-sm text-muted-foreground">No data available for this period.</p>
                    )}
                </div>
            </div>
        </div>
    );
}