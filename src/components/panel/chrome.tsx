import type { ReactNode } from 'react';
import { RefreshButton } from './refresh-button';
import { timeOf } from '@/lib/panel/format';

/** Шапка экрана: номер, заголовок, чипы фильтров, время расчёта, «Обновить». */
export function ScreenHeader({
    screenNo,
    title,
    screenKey,
    filters = [],
    generatedAt,
}: {
    screenNo: number;
    title: string;
    screenKey: string;
    filters?: { label: string; value: string }[];
    generatedAt: string | null;
}) {
    return (
        <header
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 5,
                backdropFilter: 'blur(18px)',
                background: 'color-mix(in srgb, var(--p-bg) 82%, transparent)',
                borderBottom: '1px solid var(--p-border)',
                padding: '14px var(--pad)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
            }}
        >
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--p-sub)' }}>
                    Экран {screenNo}
                </div>
                <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0, lineHeight: '24px' }}>{title}</h1>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {filters.map((f) => (
                    <span
                        key={f.label}
                        data-chip
                        title="Фильтры пока витрина: закрытый словарь значений появится вместе с запросами под них"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '7px 11px',
                            border: '1px solid var(--p-border)',
                            borderRadius: 999,
                            background: 'var(--p-card)',
                            fontSize: 12.5,
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <span style={{ color: 'var(--p-sub)' }}>{f.label}</span>
                        <span>{f.value}</span>
                    </span>
                ))}
                <span
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '7px 11px',
                        borderRadius: 999,
                        background: 'var(--p-inset)',
                        fontSize: 12,
                        color: 'var(--p-muted)',
                        whiteSpace: 'nowrap',
                    }}
                >
                    <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--ok-fg)' }} />
                    <span className="p-mono">обновлено {timeOf(generatedAt)}</span>
                </span>
                <RefreshButton screen={screenKey} />
            </div>
        </header>
    );
}

/** Вертикальный ритм экрана: колонка с шагом 12–14px, максимум 1240px. */
export function ScreenBody({ children }: { children: ReactNode }) {
    return (
        <div
            data-enter
            style={{
                padding: 'var(--pad)',
                maxWidth: 'var(--content-max)',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
            }}
        >
            {children}
        </div>
    );
}

/** Сетка на N колонок из токенов раскладки — на мобильном схлопывается сама. */
export function Grid({ cols, gap = 10, children }: { cols: 2 | 3 | 4 | 6; gap?: number; children: ReactNode }) {
    return <div style={{ display: 'grid', gridTemplateColumns: `var(--cols${cols})`, gap }}>{children}</div>;
}
