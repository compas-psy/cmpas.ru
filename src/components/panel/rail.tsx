'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PANEL_SCREENS } from '@/lib/panel/screens';
import { ThemeToggle } from './theme-toggle';

/** Точка у пункта меню — агрегированное худшее состояние экрана. */
export type RailSeverity = 'warning' | 'serious' | null;

const DOT_COLOR: Record<'warning' | 'serious', string> = {
    warning: 'var(--wa-fg)',
    serious: 'var(--br-bg)',
};

/**
 * Боковое меню панели. На мобильном полностью удаляется из потока
 * (`[data-panel] > nav[data-rail] { display: none }` в panel.css) —
 * его заменяет верхний бар с пилюлями.
 */
export function Rail({ severity }: { severity?: Partial<Record<string, RailSeverity>> }) {
    const pathname = usePathname();

    return (
        <nav
            data-rail
            aria-label="Экраны панели"
            style={{
                width: 'var(--railw)',
                flex: 'none',
                background: 'var(--p-rail)',
                color: 'var(--p-rail-ink)',
                padding: '22px 12px',
                // display НЕ задаётся здесь: inline-стиль перебил бы медиазапрос,
                // и на телефоне рельса осталась бы поверх контента.
                // Им управляет `--rail-display` в panel.css.
                flexDirection: 'column',
                gap: 2,
                overflow: 'hidden',
                position: 'sticky',
                top: 0,
                height: '100vh',
            }}
        >
            <div style={{ padding: '0 10px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.12em', color: 'rgba(255,255,255,.55)' }}>
                    СИМПАС
                </div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Управленческая панель</div>
            </div>

            {PANEL_SCREENS.map((screen) => {
                const active = pathname.startsWith(screen.href);
                const dot = severity?.[screen.key] ?? null;
                return (
                    <Link
                        key={screen.key}
                        href={screen.href}
                        data-nav
                        data-active={active}
                        aria-current={active ? 'page' : undefined}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '9px 12px',
                            borderRadius: 12,
                            color: active ? 'var(--p-rail-ink)' : 'rgba(255,255,255,.78)',
                            fontSize: 13.5,
                            fontWeight: 500,
                        }}
                    >
                        <span className="p-mono" style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)' }}>
                            {screen.no}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>{screen.title}</span>
                        <span
                            aria-hidden
                            style={{
                                width: 7,
                                height: 7,
                                borderRadius: 999,
                                background: dot ? DOT_COLOR[dot] : 'transparent',
                                flex: 'none',
                            }}
                        />
                        {dot ? <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{dot === 'serious' ? 'сломано' : 'внимание'}</span> : null}
                    </Link>
                );
            })}

            <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.1)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', padding: '0 10px' }}>
                    Вид
                </div>
                <div style={{ padding: '0 6px' }}>
                    <ThemeToggle />
                </div>
                <Link href="/admin" style={{ padding: '8px 10px', fontSize: 12.5, color: 'rgba(255,255,255,.6)' }}>
                    ← В админку
                </Link>
            </div>
        </nav>
    );
}

/** Мобильный бар: тот же список экранов горизонтальными пилюлями. */
export function MobileBar() {
    const pathname = usePathname();

    return (
        <div
            data-mobilebar
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 6,
                flexDirection: 'column',
                gap: 8,
                padding: '12px var(--pad) 10px',
                background: 'var(--p-rail)',
                color: 'var(--p-rail-ink)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', flex: 1 }}>СИМПАС · Панель</div>
                <ThemeToggle compact />
            </div>
            <div data-scroll-x style={{ display: 'flex', gap: 6, paddingBottom: 2 }}>
                {PANEL_SCREENS.map((screen) => {
                    const active = pathname.startsWith(screen.href);
                    return (
                        <Link
                            key={screen.key}
                            href={screen.href}
                            data-mbtn
                            data-active={active}
                            aria-current={active ? 'page' : undefined}
                            style={{
                                padding: '7px 13px',
                                borderRadius: 999,
                                border: '1px solid rgba(255,255,255,.22)',
                                color: 'inherit',
                                fontSize: 12.5,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                flex: 'none',
                            }}
                        >
                            {screen.title}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
