'use client';

import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

/**
 * Графики панели.
 *
 * Правила, за которыми следит приёмка (ТЗ §3.1):
 *  · ни одной второй оси Y — на графике ровно один `<YAxis>`;
 *  · цвет закреплён за сущностью и приходит слотом (`var(--c1)`…), а не
 *    индексом ряда, поэтому фильтр не перекрашивает выживших;
 *  · `null` — это разрыв линии, а не ноль: провал в ноль читался бы как
 *    «было ноль», а у нас «не измеряли»;
 *  · наведение обязательно: перекрестье с подсказкой;
 *  · текст носит текстовые токены, а не цвет ряда.
 */

const AXIS = { fontSize: 11, fill: 'var(--p-sub)', fontFamily: 'var(--p-mono)' };

function TooltipBox({
    active,
    payload,
    label,
    unit,
    format,
}: {
    active?: boolean;
    payload?: { value: number | null; name?: string; dataKey?: string | number; color?: string }[];
    label?: string | number;
    unit?: string;
    format?: (v: number) => string;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: 'var(--p-card)',
                border: '1px solid var(--p-border)',
                borderRadius: 12,
                boxShadow: 'var(--p-shadow)',
                padding: '8px 11px',
                fontSize: 12,
                color: 'var(--p-ink)',
                minWidth: 92,
            }}
        >
            <div style={{ color: 'var(--p-sub)', fontSize: 11, marginBottom: 4 }}>{label}</div>
            {payload.map((p) => (
                <div key={String(p.dataKey ?? p.name)} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flex: 'none' }} />
                    {payload.length > 1 ? <span style={{ color: 'var(--p-muted)' }}>{p.name}</span> : null}
                    <span className="p-mono" style={{ marginLeft: 'auto', fontWeight: 600 }}>
                        {p.value === null || p.value === undefined
                            ? 'данных нет'
                            : `${format ? format(p.value) : p.value}${unit ? ` ${unit}` : ''}`}
                    </span>
                </div>
            ))}
        </div>
    );
}

export interface SeriesPoint {
    label: string;
    /** null — разрыв линии: не измеряли. Ноль сюда попадает только как измеренный ноль. */
    value: number | null;
}

/**
 * Спарклайн главной метрики. Одна серия — легенда не нужна, её называет
 * заголовок. Числа не подписываются на каждой точке: только последняя.
 */
export function Sparkline({
    data,
    slot = 'c1',
    height = 56,
    title,
}: {
    data: SeriesPoint[];
    slot?: string;
    height?: number;
    title: string;
}) {
    return (
        <div style={{ width: '100%', height }} role="img" aria-label={title}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 6, right: 6, bottom: 2, left: 6 }} title={title}>
                    <Tooltip content={<TooltipBox />} cursor={{ stroke: 'var(--p-border)', strokeWidth: 1 }} />
                    <Line
                        type="monotone"
                        dataKey="value"
                        name={title}
                        stroke={`var(--${slot})`}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--p-card)' }}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

/**
 * Линейный график на одной оси. Второй оси Y здесь нет и быть не может:
 * две величины разного масштаба — это два графика, а не один с двумя осями.
 */
export function SingleAxisLine({
    data,
    slot = 'c1',
    height = 200,
    title,
    unit,
    format,
}: {
    data: SeriesPoint[];
    slot?: string;
    height?: number;
    title: string;
    unit?: string;
    format?: (v: number) => string;
}) {
    return (
        <div style={{ width: '100%', height }} role="img" aria-label={title}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 4 }} title={title}>
                    <CartesianGrid stroke="var(--p-border)" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--p-border)' }} minTickGap={24} />
                    <YAxis
                        tick={AXIS}
                        tickLine={false}
                        axisLine={false}
                        width={54}
                        tickFormatter={(v: number) => (format ? format(v) : String(v))}
                    />
                    <Tooltip content={<TooltipBox unit={unit} format={format} />} cursor={{ stroke: 'var(--p-sub)', strokeDasharray: '3 3' }} />
                    <Line
                        type="monotone"
                        dataKey="value"
                        name={title}
                        stroke={`var(--${slot})`}
                        strokeWidth={2.4}
                        dot={false}
                        activeDot={{ r: 4.5, strokeWidth: 2, stroke: 'var(--p-card)' }}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export interface CohortSeries {
    key: string;
    label: string;
    /** Штрих — второй канал различения помимо цвета (обязателен при одном тоне). */
    dash?: string;
    points: SeriesPoint[];
}

/**
 * Несколько когорт одним тоном. Серии различаются подписью и штрихом, а не
 * только цветом — так их читает и дальтоник, и чёрно-белая печать.
 * Одна ось Y на всех.
 */
export function CohortLines({
    series,
    slot = 'c3',
    height = 190,
    title,
    unit = '%',
}: {
    series: CohortSeries[];
    slot?: string;
    height?: number;
    title: string;
    unit?: string;
}) {
    const merged = (series[0]?.points ?? []).map((p, i) => {
        const row: Record<string, string | number | null> = { label: p.label };
        series.forEach((s) => {
            row[s.key] = s.points[i]?.value ?? null;
        });
        return row;
    });

    return (
        <div style={{ width: '100%', height }} role="img" aria-label={title}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={merged} margin={{ top: 10, right: 64, bottom: 4, left: 4 }} title={title}>
                    <CartesianGrid stroke="var(--p-border)" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--p-border)' }} />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} />
                    <Tooltip content={<TooltipBox unit={unit} />} cursor={{ stroke: 'var(--p-sub)', strokeDasharray: '3 3' }} />
                    {series.map((s) => (
                        <Line
                            key={s.key}
                            type="monotone"
                            dataKey={s.key}
                            name={s.label}
                            stroke={`var(--${slot})`}
                            strokeWidth={2}
                            strokeDasharray={s.dash}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--p-card)' }}
                            connectNulls={false}
                            isAnimationActive={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

/**
 * Прямые подписи серий — при четырёх и менее рядах они идут вместе с
 * легендой, чтобы идентичность не держалась на одном цвете.
 */
export function SeriesLegend({ series, slot = 'c3' }: { series: { label: string; dash?: string }[]; slot?: string }) {
    return (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--p-muted)' }}>
            {series.map((s) => (
                <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="18" height="8" aria-hidden>
                        <line x1="0" y1="4" x2="18" y2="4" stroke={`var(--${slot})`} strokeWidth="2" strokeDasharray={s.dash} />
                    </svg>
                    {s.label}
                </span>
            ))}
        </div>
    );
}
