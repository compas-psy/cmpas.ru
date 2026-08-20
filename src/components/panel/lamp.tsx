import Link from 'next/link';
import type { LampState } from '@/lib/panel/types';
import { StateGlyph } from './block';

/**
 * Лампа состояния — шесть значений.
 *
 * `unverified` НИКОГДА не зелёная: серый фон, пунктирная рамка и подпись,
 * объясняющая, что это не «хорошо» (ТЗ §4, §11). Цвет всегда сопровождается
 * глифом и словом — панель обязана читаться в чёрно-белой печати.
 */

const TONE: Record<LampState, { bg: string; fg: string; br: string; dashed: boolean; word: string; note: string | null }> = {
    ok: { bg: 'var(--ok-bg)', fg: 'var(--ok-fg)', br: 'var(--ok-br)', dashed: false, word: 'в порядке', note: null },
    warning: { bg: 'var(--wa-bg)', fg: 'var(--wa-fg)', br: 'var(--wa-br)', dashed: false, word: 'внимание', note: null },
    serious: { bg: 'var(--se-bg)', fg: 'var(--se-fg)', br: 'var(--se-br)', dashed: false, word: 'серьёзно', note: null },
    broken: { bg: 'var(--br-bg)', fg: 'var(--br-fg)', br: 'var(--br-br)', dashed: false, word: 'сломано', note: null },
    unverified: {
        bg: 'var(--un-bg)',
        fg: 'var(--un-fg)',
        br: 'var(--un-br)',
        dashed: true,
        word: 'не проверено',
        note: 'это не «хорошо»',
    },
    loading: { bg: 'var(--p-inset)', fg: 'var(--p-sub)', br: 'var(--p-border)', dashed: true, word: 'считаем', note: null },
};

export function Lamp({
    title,
    state,
    detail,
    href,
}: {
    title: string;
    state: LampState;
    detail: string;
    href?: string;
}) {
    const tone = TONE[state];
    const inner = (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: tone.fg }}>
                <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: 'currentColor', flex: 'none' }} />
                <StateGlyph state={state} />
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: state === 'broken' ? 'var(--br-fg)' : 'var(--p-ink)' }}>{title}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: tone.fg }}>{tone.word}</div>
            <div style={{ fontSize: 11, color: state === 'broken' ? 'var(--br-fg)' : 'var(--p-muted)', opacity: state === 'broken' ? 0.85 : 1 }}>
                {detail}
            </div>
            {tone.note ? <div style={{ fontSize: 10.5, fontStyle: 'italic', color: tone.fg }}>{tone.note}</div> : null}
        </>
    );

    const style: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: 14,
        borderRadius: 16,
        background: tone.bg,
        border: `1px ${tone.dashed ? 'dashed' : 'solid'} ${tone.br}`,
        minWidth: 0,
    };

    if (!href) {
        return (
            <div data-lamp data-lamp-state={state} style={style}>
                {inner}
            </div>
        );
    }

    return (
        <Link
            href={href}
            data-lamp
            data-lamp-state={state}
            aria-label={`${title}: ${tone.word}. ${detail}`}
            style={style}
        >
            {inner}
        </Link>
    );
}
