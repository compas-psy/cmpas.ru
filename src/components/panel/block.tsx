import type { ReactNode } from 'react';
import type { PanelBlock } from '@/lib/panel/types';
import { timeOf } from '@/lib/panel/format';

/**
 * Подпись под блоком: `источник: q_mrr_monthly · 08:40`.
 * Это не украшение, а способ проверить число (ТЗ §4, правило 3).
 */
export function SourceLine({ source, generatedAt, extra }: { source: string; generatedAt: string | null; extra?: string }) {
    return (
        <div className="p-mono" style={{ width: '100%', fontSize: 11, color: 'var(--p-sub)' }}>
            источник: {source}
            {extra ? ` · ${extra}` : ''} · {timeOf(generatedAt)}
        </div>
    );
}

/** Каркас карточки панели. */
export function Card({
    children,
    tone = 'plain',
    radius = 20,
    padding = 20,
    shadow = true,
}: {
    children: ReactNode;
    tone?: 'plain' | 'ok' | 'warning' | 'serious' | 'broken' | 'unverified';
    radius?: number;
    padding?: number;
    shadow?: boolean;
}) {
    const border =
        tone === 'plain' ? 'var(--p-border)'
        : tone === 'ok' ? 'var(--ok-br)'
        : tone === 'warning' ? 'var(--wa-br)'
        : tone === 'serious' ? 'var(--se-br)'
        : tone === 'broken' ? 'var(--br-br)'
        : 'var(--un-br)';

    return (
        <section
            style={{
                background: 'var(--p-card)',
                border: `1px solid ${border}`,
                borderRadius: radius,
                padding,
                boxShadow: shadow ? 'var(--p-shadow)' : undefined,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                minWidth: 0,
            }}
        >
            {children}
        </section>
    );
}

export function CapsLabel({ children, color = 'var(--p-sub)' }: { children: ReactNode; color?: string }) {
    return (
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color }}>
            {children}
        </div>
    );
}

/**
 * Обёртка блока: разводит пять состояний контракта.
 *
 * `no_data` рисуется пунктирной рамкой и причиной — НИКОГДА нулём.
 * Измеренный ноль проходит по ветке `ok` и выглядит как обычное число:
 * именно эту разницу проверяет тест `states.test.tsx`.
 */
export function BlockFrame<T>({
    block,
    label,
    children,
    sourceExtra,
    minHeight = 96,
}: {
    block: PanelBlock<T>;
    label: string;
    children: (data: T) => ReactNode;
    sourceExtra?: string;
    minHeight?: number;
}) {
    if (block.state === 'ok' || block.state === 'stale') {
        const isStale = block.state === 'stale';
        return (
            <div data-block-state={block.state} style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: isStale ? 0.72 : 1, minWidth: 0 }}>
                <CapsLabel>{label}</CapsLabel>
                {children(block.data as T)}
                {isStale ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--p-muted)' }}>
                        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--wa-fg)' }} />
                        <span>данные устарели: {block.reason}</span>
                    </div>
                ) : null}
                <SourceLine source={block.source} generatedAt={block.generatedAt} extra={sourceExtra} />
            </div>
        );
    }

    if (block.state === 'loading') {
        return (
            <div data-block-state="loading" aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight }}>
                <CapsLabel>{label}</CapsLabel>
                {/* Скелетоны формы конечного контента, без мерцания. */}
                <div style={{ height: 28, borderRadius: 8, background: 'var(--p-inset)' }} />
                <div style={{ height: 12, width: '60%', borderRadius: 6, background: 'var(--p-inset)' }} />
                <div style={{ height: 12, width: '40%', borderRadius: 6, background: 'var(--p-inset)' }} />
            </div>
        );
    }

    if (block.state === 'broken') {
        return (
            <div
                data-block-state="broken"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    minHeight,
                    padding: 14,
                    borderRadius: 16,
                    border: '1px solid var(--se-br)',
                    background: 'var(--se-bg)',
                }}
            >
                <CapsLabel color="var(--se-fg)">{label}</CapsLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14.5, fontWeight: 600, color: 'var(--se-fg)' }}>
                    <StateGlyph state="serious" />
                    <span>Запрос падает</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--p-muted)' }}>{block.reason}</div>
                <div className="p-mono" style={{ fontSize: 11, color: 'var(--p-sub)' }}>
                    источник: {block.source}
                </div>
            </div>
        );
    }

    // no_data — пунктир, слова «данных нет» и причина. Ни одного нуля.
    return (
        <div
            data-block-state="no_data"
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                minHeight,
                padding: 14,
                borderRadius: 16,
                border: '1px dashed var(--un-br)',
                background: 'var(--un-bg)',
            }}
        >
            <CapsLabel color="var(--un-fg)">{label}</CapsLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14.5, fontWeight: 600, color: 'var(--un-fg)' }}>
                <StateGlyph state="unverified" />
                <span>Данных нет</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--p-muted)' }}>{block.reason}</div>
            <SourceLine source={block.source} generatedAt={block.generatedAt} extra={sourceExtra} />
        </div>
    );
}

/**
 * Глиф состояния. Цвет никогда не работает в одиночку: рядом всегда значок
 * и подпись, чтобы панель читали дальтоник и чёрно-белая печать (ТЗ §3.1 п.6).
 */
export function StateGlyph({ state, size = 15 }: { state: 'ok' | 'warning' | 'serious' | 'broken' | 'unverified' | 'loading'; size?: number }) {
    const common = { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true as const };
    const stroke = 'currentColor';

    if (state === 'ok') {
        return (
            <svg {...common}>
                <path d="M3 8.5l3.2 3.2L13 5" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }
    if (state === 'warning') {
        return (
            <svg {...common}>
                <circle cx="8" cy="8" r="6.4" stroke={stroke} strokeWidth="1.6" />
                <path d="M8 4.6v4.2M8 11.2v.6" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
        );
    }
    if (state === 'serious') {
        return (
            <svg {...common}>
                <path d="M8 2.2l6.2 11H1.8L8 2.2z" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M8 6.4v3M8 11.4v.6" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
        );
    }
    if (state === 'broken') {
        return (
            <svg {...common}>
                <path d="M4 4l8 8M12 4l-8 8" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
            </svg>
        );
    }
    if (state === 'unverified') {
        return (
            <svg {...common}>
                <circle cx="8" cy="8" r="6.4" stroke={stroke} strokeWidth="1.6" strokeDasharray="2.4 2.2" />
                <path d="M6.2 6.2a1.9 1.9 0 113 1.6c-.7.5-1.2.8-1.2 1.6M8 11.6v.5" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
            </svg>
        );
    }
    return (
        <svg {...common}>
            <circle cx="8" cy="8" r="6.4" stroke={stroke} strokeWidth="1.6" strokeDasharray="4 3" opacity="0.6" />
        </svg>
    );
}
