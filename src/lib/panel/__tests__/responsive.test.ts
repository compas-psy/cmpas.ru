/**
 * Мобильный вид (ТЗ §2, приёмка §9).
 *
 * Отдельный тест появился после настоящей ошибки: рельса задавала
 * `display: flex` инлайном, инлайн перебивал медиазапрос, и на телефоне
 * боковое меню оставалось поверх контента. Здесь закреплено, что раскладка
 * управляется токенами, а не инлайн-стилями.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const CSS = readFileSync(path.resolve(__dirname, '../../../app/admin/panel/panel.css'), 'utf8');
const RAIL = readFileSync(path.resolve(__dirname, '../../../components/panel/rail.tsx'), 'utf8');

describe('мобильный вид', () => {
    it('рельса и мобильный бар переключаются токенами, а не инлайн-стилем', () => {
        expect(CSS).toContain('--rail-display');
        expect(CSS).toContain('--mobilebar-display');
        expect(CSS).toContain('display: var(--rail-display)');
        expect(CSS).toContain('display: var(--mobilebar-display)');

        // Инлайновый display на самой рельсе перебил бы медиазапрос.
        // Проверяем только открывающий тег <nav>, не его содержимое:
        // у вложенных пунктов свой display, и он к делу не относится.
        const openTagStart = RAIL.indexOf('data-rail');
        const openTagEnd = RAIL.indexOf('>', RAIL.indexOf('height: \'100vh\''));
        const navOpenTag = RAIL.slice(openTagStart, openTagEnd);
        expect(
            /display:\s*'/.test(navOpenTag),
            'рельса задаёт display инлайном — медиазапрос его не перебьёт',
        ).toBe(false);
    });

    it('медиазапрос схлопывает все сетки и убирает рельсу', () => {
        const mobile = CSS.slice(CSS.indexOf('@media (max-width: 720px)'));
        const block = mobile.slice(0, mobile.indexOf('\n}\n'));

        for (const token of ['--cols6', '--cols4', '--cols3', '--cols2', '--hero', '--pad', '--railw']) {
            expect(block, `${token} не переопределён на мобильном`).toContain(token);
        }
        expect(block).toContain('--rail-display: none');
        expect(block).toContain('--mobilebar-display: flex');
    });

    it('широкие блоки скроллятся сами, а не тянут страницу', () => {
        expect(CSS).toContain('[data-panel] [data-scroll-x] { overflow-x: auto; }');
    });

    it('движение уважает prefers-reduced-motion', () => {
        expect(CSS).toContain('@media (prefers-reduced-motion: reduce)');
    });
});
