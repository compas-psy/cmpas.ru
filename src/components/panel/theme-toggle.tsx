'use client';

import { useEffect, useState } from 'react';

/**
 * Тема панели: `localStorage` поверх `prefers-color-scheme` (handoff,
 * Interactions). Пишет `data-theme` на корневой `[data-panel]`, откуда его
 * читает весь токен-слой.
 */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
    const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

    useEffect(() => {
        const stored = window.localStorage.getItem('panel-theme');
        const initial =
            stored === 'light' || stored === 'dark'
                ? stored
                : window.matchMedia('(prefers-color-scheme: dark)').matches
                  ? 'dark'
                  : 'light';
        setTheme(initial);
    }, []);

    useEffect(() => {
        if (!theme) return;
        document.querySelectorAll('[data-panel]').forEach((el) => {
            (el as HTMLElement).dataset.theme = theme;
        });
        window.localStorage.setItem('panel-theme', theme);
    }, [theme]);

    const next = theme === 'dark' ? 'light' : 'dark';

    return (
        <button
            type="button"
            onClick={() => setTheme(next)}
            aria-label={`Переключить на ${next === 'dark' ? 'тёмную' : 'светлую'} тему`}
            style={{
                padding: compact ? '6px 10px' : '7px 8px',
                borderRadius: compact ? 999 : 10,
                background: 'rgba(255,255,255,.06)',
                border: '1px solid rgba(255,255,255,.16)',
                color: 'inherit',
                font: 'inherit',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
            }}
        >
            {theme === 'dark' ? 'Тёмная' : 'Светлая'}
        </button>
    );
}

/**
 * Раскрашивает панель до гидрации, чтобы тёмная тема не мигала белым.
 * Читает то же хранилище, что и переключатель выше.
 */
export function ThemeScript() {
    const code = `(function(){try{var s=localStorage.getItem('panel-theme');var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.querySelectorAll('[data-panel]').forEach(function(e){e.dataset.theme=t});}catch(e){}})();`;
    return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
