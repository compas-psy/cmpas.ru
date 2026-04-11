'use client';

import {
    AreaChart,
    Area,
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    type TooltipProps,
} from 'recharts';

/**
 * Yandex.Metrica-style palette — cool indigo/violet primary + accent hues.
 * Matches the admin panel's #0f1729 / indigo-500 theme.
 */
export const CHART_COLORS = {
    primary: '#6366f1', // indigo-500
    primarySoft: '#a5b4fc', // indigo-300
    secondary: '#0ea5e9', // sky-500
    success: '#10b981', // emerald-500
    warning: '#f59e0b', // amber-500
    danger: '#ef4444', // red-500
    purple: '#a855f7', // purple-500
    pink: '#ec4899', // pink-500
    teal: '#14b8a6', // teal-500
    slate: '#94a3b8', // slate-400
} as const;

export const DONUT_PALETTE = [
    CHART_COLORS.primary,
    CHART_COLORS.secondary,
    CHART_COLORS.success,
    CHART_COLORS.warning,
    CHART_COLORS.purple,
    CHART_COLORS.pink,
    CHART_COLORS.teal,
    CHART_COLORS.slate,
];

// ---------------------------------------------------------------------------
// Tooltip — shared style
// ---------------------------------------------------------------------------

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
    if (!active || !payload || payload.length === 0) return null;
    return (
        <div className="bg-[#0f1729] text-white text-xs rounded-lg px-3 py-2 shadow-lg border border-white/10">
            {label && <div className="font-semibold mb-1">{label}</div>}
            {payload.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: entry.color }}
                    />
                    <span className="text-white/70">{entry.name}:</span>
                    <span className="font-semibold">{entry.value?.toLocaleString('ru-RU')}</span>
                </div>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Line/Area chart for visits over time
// ---------------------------------------------------------------------------

export type TimeSeriesPoint = {
    label: string;
    visits: number;
    visitors: number;
    prevVisits?: number;
};

export function VisitsAreaChart({
    data,
    height = 280,
    showComparison = false,
}: {
    data: TimeSeriesPoint[];
    height?: number;
    showComparison?: boolean;
}) {
    if (data.length === 0) {
        return (
            <div style={{ height }} className="flex items-center justify-center text-sm text-[#94a3b8]">
                Нет данных за выбранный период
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="gradVisits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradVisitors" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.secondary} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={CHART_COLORS.secondary} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                    dataKey="label"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={20}
                />
                <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
                <Area
                    type="monotone"
                    dataKey="visits"
                    name="Визиты"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    fill="url(#gradVisits)"
                />
                <Area
                    type="monotone"
                    dataKey="visitors"
                    name="Посетители"
                    stroke={CHART_COLORS.secondary}
                    strokeWidth={2}
                    fill="url(#gradVisitors)"
                />
                {showComparison && (
                    <Line
                        type="monotone"
                        dataKey="prevVisits"
                        name="Предыдущий период"
                        stroke={CHART_COLORS.slate}
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                    />
                )}
            </AreaChart>
        </ResponsiveContainer>
    );
}

// ---------------------------------------------------------------------------
// Mini area (for dashboard KPI card chart)
// ---------------------------------------------------------------------------

export function MiniAreaChart({
    data,
    color = CHART_COLORS.primary,
    height = 200,
}: {
    data: { label: string; value: number }[];
    color?: string;
    height?: number;
}) {
    if (data.length === 0 || data.every(d => d.value === 0)) {
        return (
            <div style={{ height }} className="flex items-center justify-center text-sm text-[#94a3b8]">
                Нет данных
            </div>
        );
    }

    const gradientId = `mini-grad-${color.replace('#', '')}`;

    return (
        <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                    dataKey="label"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                />
                <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                    allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0' }} />
                <Area
                    type="monotone"
                    dataKey="value"
                    name="Визиты"
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

// ---------------------------------------------------------------------------
// Donut chart (devices / browsers / OS)
// ---------------------------------------------------------------------------

export type DonutItem = { name: string; value: number; color?: string };

export function DonutChart({
    data,
    height = 220,
    centerLabel,
    centerValue,
}: {
    data: DonutItem[];
    height?: number;
    centerLabel?: string;
    centerValue?: string | number;
}) {
    if (data.length === 0 || data.every(d => d.value === 0)) {
        return (
            <div style={{ height }} className="flex items-center justify-center text-sm text-[#94a3b8]">
                Нет данных
            </div>
        );
    }

    return (
        <div className="relative" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="62%"
                        outerRadius="88%"
                        paddingAngle={2}
                        strokeWidth={0}
                    >
                        {data.map((entry, i) => (
                            <Cell
                                key={i}
                                fill={entry.color || DONUT_PALETTE[i % DONUT_PALETTE.length]}
                            />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                </PieChart>
            </ResponsiveContainer>
            {(centerLabel || centerValue !== undefined) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    {centerValue !== undefined && (
                        <div className="text-2xl font-bold text-[#0f1729]">{centerValue}</div>
                    )}
                    {centerLabel && (
                        <div className="text-[10px] uppercase tracking-wider text-[#94a3b8] font-medium">
                            {centerLabel}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Horizontal bar chart (geography, sources)
// ---------------------------------------------------------------------------

export function HorizontalBarChart({
    data,
    color = CHART_COLORS.primary,
    height = 260,
}: {
    data: { name: string; value: number }[];
    color?: string;
    height?: number;
}) {
    if (data.length === 0) {
        return (
            <div style={{ height }} className="flex items-center justify-center text-sm text-[#94a3b8]">
                Нет данных
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 8, bottom: 0 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                    type="number"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                />
                <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" name="Визиты" fill={color} radius={[0, 6, 6, 0]} maxBarSize={18} />
            </BarChart>
        </ResponsiveContainer>
    );
}

// ---------------------------------------------------------------------------
// Hour-of-day bar chart (traffic pattern)
// ---------------------------------------------------------------------------

export function HourlyBarChart({
    data,
    height = 180,
}: {
    data: { hour: string; value: number }[];
    height?: number;
}) {
    if (data.length === 0) {
        return (
            <div style={{ height }} className="flex items-center justify-center text-sm text-[#94a3b8]">
                Нет данных
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                    dataKey="hour"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    interval={2}
                />
                <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" name="Визиты" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
        </ResponsiveContainer>
    );
}

// ---------------------------------------------------------------------------
// Legend list (for donut charts)
// ---------------------------------------------------------------------------

export function LegendList({
    data,
    total,
}: {
    data: DonutItem[];
    total?: number;
}) {
    const computedTotal = total ?? data.reduce((s, d) => s + d.value, 0);
    return (
        <ul className="space-y-2.5 text-xs">
            {data.map((item, i) => {
                const pct = computedTotal > 0 ? Math.round((item.value / computedTotal) * 100) : 0;
                return (
                    <li key={i} className="flex items-center gap-3">
                        <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ background: item.color || DONUT_PALETTE[i % DONUT_PALETTE.length] }}
                        />
                        <span className="flex-1 truncate text-[#334155] font-medium">{item.name}</span>
                        <span className="text-[#0f1729] font-semibold">{item.value.toLocaleString('ru-RU')}</span>
                        <span className="text-[#94a3b8] w-8 text-right">{pct}%</span>
                    </li>
                );
            })}
        </ul>
    );
}

// Re-export Legend for advanced cases
export { Legend };
