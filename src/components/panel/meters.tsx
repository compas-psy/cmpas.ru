import type { ReactNode } from 'react';
import { THRESHOLDS, UNCONFIRMED_THRESHOLDS, severityFor, type ThresholdKey } from '@/lib/panel/thresholds';
import { dec } from '@/lib/panel/format';

/**
 * Счётчик с порогами: пороги видны ВНУТРИ счётчика вертикальными засечками,
 * а не спрятаны в тексте (handoff, продуктовый принцип 7).
 * Значения порогов приходят из `lib/panel/thresholds.ts` — магических чисел
 * в компонентах нет.
 */
export function ThresholdBar({
    thresholdKey,
    value,
    max = 100,
    label,
    valueLabel,
}: {
    thresholdKey: ThresholdKey;
    value: number;
    max?: number;
    label: string;
    valueLabel: string;
}) {
    const t = THRESHOLDS[thresholdKey];
    const severity = severityFor(thresholdKey, value) ?? 'ok';
    const fill = severity === 'serious' ? 'var(--se-fg)' : severity === 'warning' ? 'var(--wa-fg)' : 'var(--ok-fg)';
    const pct = (n: number) => `${Math.max(0, Math.min(100, (n / max) * 100))}%`;
    const unconfirmed = UNCONFIRMED_THRESHOLDS.has(thresholdKey);

    return (
        <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--p-muted)', marginBottom: 7, gap: 8 }}>
                <span>{label}</span>
                <span className="p-mono" style={{ fontWeight: 600, color: 'var(--p-ink)' }}>
                    {valueLabel}
                </span>
            </div>
            <div
                role="meter"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-label={`${label}: ${valueLabel}`}
                style={{ position: 'relative', height: 12, borderRadius: 999, background: 'var(--p-inset)' }}
            >
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct(value), background: fill, borderRadius: 999 }} />
                <Notch at={pct(t.warning)} color="var(--wa-fg)" />
                <Notch at={pct(t.serious)} color="var(--se-fg)" />
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 10.5, color: 'var(--p-sub)', flexWrap: 'wrap' }}>
                <span>
                    {dec(t.serious, 0)} {t.unit} — серьёзно
                </span>
                <span>
                    {dec(t.warning, 0)} {t.unit} — внимание
                </span>
                {unconfirmed ? <span style={{ fontStyle: 'italic' }}>порог не подтверждён владельцем</span> : null}
            </div>
        </div>
    );
}

function Notch({ at, color }: { at: string; color: string }) {
    return <span aria-hidden style={{ position: 'absolute', left: at, top: -5, bottom: -5, width: 2, background: color }} />;
}

/** Плашка на вставном фоне — «Очередь неудач», «Терминалы» и подобные. */
export function InsetTile({ label, children, tone = 'inset' }: { label: string; children: ReactNode; tone?: 'inset' | 'ok' | 'warning' | 'serious' | 'unverified' }) {
    const bg =
        tone === 'ok' ? 'var(--ok-bg)'
        : tone === 'warning' ? 'var(--wa-bg)'
        : tone === 'serious' ? 'var(--se-bg)'
        : tone === 'unverified' ? 'var(--un-bg)'
        : 'var(--p-inset)';
    const fg =
        tone === 'ok' ? 'var(--ok-fg)'
        : tone === 'warning' ? 'var(--wa-fg)'
        : tone === 'serious' ? 'var(--se-fg)'
        : tone === 'unverified' ? 'var(--un-fg)'
        : 'var(--p-sub)';

    return (
        <div
            style={{
                background: bg,
                border: tone === 'unverified' ? '1px dashed var(--un-br)' : undefined,
                borderRadius: 14,
                padding: 13,
                minWidth: 0,
            }}
        >
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: fg, marginBottom: 5 }}>
                {label}
            </div>
            {children}
        </div>
    );
}

/**
 * Полоса воронки: один тон с убывающей непрозрачностью — величина, а не
 * идентичность, поэтому категориальные слоты здесь не нужны.
 */
export function FunnelRow({
    label,
    value,
    ofPrevious,
    width,
    slot,
    opacity,
    highlight,
    highlightLabel,
    height = 36,
}: {
    label: string;
    value: string;
    ofPrevious: string;
    width: number;
    slot: string;
    opacity: number;
    highlight?: boolean;
    highlightLabel?: string;
    height?: number;
}) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'var(--funnel-label) 1fr 64px', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: highlight ? 'var(--se-fg)' : 'var(--p-muted)', fontWeight: highlight ? 600 : 400, minWidth: 0, overflowWrap: 'anywhere' }}>
                {label}
                {highlight && highlightLabel ? (
                    <span
                        style={{
                            marginLeft: 7,
                            padding: '2px 7px',
                            borderRadius: 999,
                            background: 'var(--se-bg)',
                            color: 'var(--se-fg)',
                            fontSize: 10.5,
                            fontWeight: 700,
                            display: 'inline-block',
                        }}
                    >
                        {highlightLabel}
                    </span>
                ) : null}
            </span>
            <div style={{ position: 'relative', height, background: 'var(--p-inset)', borderRadius: 8, overflow: 'hidden' }}>
                <div
                    style={{
                        width: `${Math.max(2, Math.min(100, width))}%`,
                        height: '100%',
                        background: `var(--${slot})`,
                        opacity,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: 10,
                    }}
                />
                <span
                    className="p-mono"
                    style={{ position: 'absolute', left: 10, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600, color: 'var(--p-card)' }}
                >
                    {value}
                </span>
            </div>
            <span className="p-mono" style={{ fontSize: 12.5, color: 'var(--p-muted)', textAlign: 'right' }}>
                {ofPrevious}
            </span>
        </div>
    );
}

/**
 * Карточка «честного нуля»: ноль здесь измерен, но означает
 * «механики не существует» — поэтому пунктир и объяснение, а не зелёный ноль.
 */
export function HonestZero({ title, explanation }: { title: string; explanation: string }) {
    return (
        <div style={{ border: '1px dashed var(--un-br)', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--un-fg)' }}>{title}</div>
            <div className="p-mono" style={{ fontSize: 38, fontWeight: 700, color: 'var(--un-fg)', lineHeight: 1 }}>
                0
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--un-fg)' }}>механики не существует</div>
            <div style={{ fontSize: 12.5, color: 'var(--p-muted)' }}>{explanation}</div>
        </div>
    );
}
