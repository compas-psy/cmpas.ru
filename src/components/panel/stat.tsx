import type { ReactNode } from 'react';
import type { Delta } from '@/lib/panel/format';
import { StateGlyph } from './block';

/**
 * Пилюля тренда. Направление подписано СЛОВОМ, а не только стрелкой и
 * цветом — иначе читается только зрячим на цвет (handoff, экран «Утро»).
 */
export function TrendPill({ delta }: { delta: Delta }) {
    const tone =
        delta.good === null ? { bg: 'var(--p-inset)', fg: 'var(--p-muted)' }
        : delta.good ? { bg: 'var(--ok-bg)', fg: 'var(--ok-fg)' }
        : { bg: 'var(--se-bg)', fg: 'var(--se-fg)' };

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 9px',
                borderRadius: 999,
                background: tone.bg,
                color: tone.fg,
                fontSize: 11.5,
                fontWeight: 600,
                whiteSpace: 'nowrap',
            }}
        >
            <Arrow direction={delta.direction} />
            <span className="p-mono">{delta.label}</span>
            <span>{delta.word}</span>
        </span>
    );
}

function Arrow({ direction }: { direction: Delta['direction'] }) {
    if (direction === 'flat') {
        return (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
        );
    }
    const up = direction === 'up';
    return (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
                d={up ? 'M6 10V2M2.6 5.4L6 2l3.4 3.4' : 'M6 2v8M2.6 6.6L6 10l3.4-3.4'}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

/** Плитка показателя — одно число. График из одного столбика здесь не нужен. */
export function StatTile({
    label,
    value,
    unit,
    delta,
    note,
    tone = 'plain',
    labelColor,
}: {
    label: string;
    value: ReactNode;
    unit?: string;
    delta?: Delta;
    note?: string;
    tone?: 'plain' | 'warning' | 'serious';
    labelColor?: string;
}) {
    const border = tone === 'warning' ? 'var(--wa-br)' : tone === 'serious' ? 'var(--se-br)' : 'var(--p-border)';
    return (
        <div
            style={{
                background: 'var(--p-card)',
                border: `1px solid ${border}`,
                borderRadius: 18,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                minWidth: 0,
            }}
        >
            <div
                style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '.09em',
                    textTransform: 'uppercase',
                    color: labelColor ?? (tone === 'warning' ? 'var(--wa-fg)' : tone === 'serious' ? 'var(--se-fg)' : 'var(--p-sub)'),
                }}
            >
                {label}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
                <span className="p-mono" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em' }}>
                    {value}
                </span>
                {unit ? <span style={{ fontSize: 13, color: 'var(--p-muted)' }}>{unit}</span> : null}
            </div>
            {delta ? <TrendPill delta={delta} /> : null}
            {note ? <div style={{ fontSize: 11.5, color: 'var(--p-muted)' }}>{note}</div> : null}
        </div>
    );
}

/** Строка «требует вас»: последствие слева, оценка времени и действие справа. */
export function AttentionRow({
    title,
    consequence,
    minutes,
    lamp,
    action,
    primary = false,
}: {
    title: string;
    consequence: string;
    minutes: number;
    lamp: 'ok' | 'warning' | 'serious' | 'broken' | 'unverified';
    action: { label: string; href: string } | null;
    primary?: boolean;
}) {
    const fg =
        lamp === 'broken' ? 'var(--br-bg)'
        : lamp === 'serious' ? 'var(--se-fg)'
        : lamp === 'warning' ? 'var(--wa-fg)'
        : lamp === 'unverified' ? 'var(--un-fg)'
        : 'var(--ok-fg)';

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'var(--cols2)',
                gap: '6px 18px',
                padding: '14px 0',
                borderTop: '1px solid var(--p-border)',
                alignItems: 'center',
            }}
        >
            <div style={{ display: 'flex', gap: 9, minWidth: 0 }}>
                <span style={{ color: fg, display: 'flex', alignItems: 'center', gap: 6, flex: 'none', paddingTop: 2 }}>
                    <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: 'currentColor' }} />
                    <StateGlyph state={lamp} size={13} />
                </span>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--p-muted)' }}>{consequence}</div>
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <span className="p-mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--p-muted)', whiteSpace: 'nowrap' }}>
                    ~{minutes} мин
                </span>
                {action ? (
                    <a
                        href={action.href}
                        style={{
                            padding: '8px 14px',
                            borderRadius: 14,
                            border: primary ? '1px solid var(--p-primary)' : '1px solid var(--p-border)',
                            background: primary ? 'var(--p-primary)' : 'var(--p-card)',
                            color: primary ? 'var(--p-primary-ink)' : 'var(--p-ink)',
                            fontSize: 12.5,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {action.label}
                    </a>
                ) : null}
            </div>
        </div>
    );
}
