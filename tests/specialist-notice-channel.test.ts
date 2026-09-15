import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildClientActionText } from '@/lib/messaging/specialist-notice';

/**
 * КУДА ПИСАТЬ СПЕЦИАЛИСТУ, РЕШАЕТ СПЕЦИАЛИСТ.
 *
 * Дефект П3 книги 3. Клиент нажимал «Отменить» в Telegram — специалисту
 * писали в Telegram; нажимал в MAX — в MAX; отменял по ссылке — снова в
 * Telegram. Канал брался из того, ОТКУДА пришло действие клиента, а не из
 * того, каким мессенджером пользуется сам специалист. Человек с одним MAX
 * не узнавал об отмене, сделанной в Telegram.
 *
 * Проверяется правило, а не экран: текст — вызовом, единственность канала —
 * по исходникам трёх мест. Воспроизводить диалог с двумя мессенджерами
 * дороже, а сторожить надо именно то, что однажды разошлось.
 */

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf-8');

/** Три места, где клиент действует, а узнать должен специалист. */
const SITES = [
    'src/lib/telegram-bot.ts',
    'src/lib/max-bot.ts',
    'src/app/api/user/diary/bot/client/cancel/route.ts',
];

/** Комментарии убираются: объяснение дефекта рядом с кодом не должно его же и подтверждать. */
const code = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('сообщение о действии клиента уходит в канал специалиста', () => {
    it.each(SITES)('%s зовёт общий модуль, а не шлёт сам', (file) => {
        expect(code(read(file))).toContain('specialist-notice');
    });

    it('ни одно из трёх мест больше не пишет специалисту напрямую', () => {
        for (const file of SITES) {
            const source = code(read(file));
            // Прямая отправка специалисту узнаётся по его каналам рядом с отправкой.
            expect(source, `${file}: остался прямой Telegram специалисту`)
                .not.toMatch(/sendMessage\([^)]*psychologist[^)]*telegramChatId/);
            expect(source, `${file}: остался прямой MAX специалисту`)
                .not.toMatch(/sendMaxMessage\(\s*psyMaxId/);
        }
    });

    it('текст один на все три пути, а не три редакции', () => {
        const cancelled = buildClientActionText({
            clientName: 'Ирина',
            date: new Date('2026-09-17T00:00:00Z'),
            time: '13:00',
            action: 'cancelled',
        });
        expect(cancelled).toContain('Ирина');
        expect(cancelled).toContain('17.09.2026');
        expect(cancelled).toContain('13:00');
        // Отмена говорит и о следствии: час освободился, его можно занять.
        expect(cancelled).toMatch(/свободен/i);
    });

    it('подтверждение не кричит заголовком — оно только снимает вопрос', () => {
        const confirmed = buildClientActionText({
            clientName: 'Ирина',
            date: new Date('2026-09-17T00:00:00Z'),
            time: '13:00',
            action: 'confirmed',
        });
        expect(confirmed).not.toContain('<b>');
        expect(confirmed).toContain('подтвердил');
    });

    it('имя клиента экранируется — иначе амперсанд отменит сообщение целиком', () => {
        const text = buildClientActionText({
            clientName: 'Иванов & партнёры',
            date: new Date('2026-09-17T00:00:00Z'),
            time: '13:00',
            action: 'cancelled',
        });
        expect(text).toContain('Иванов &amp; партнёры');
        // Голого амперсанда в тексте не осталось.
        expect(text.replace(/&amp;/g, '')).not.toContain('&');
    });

    it('колокольчик в кабинете остаётся: он не зависит от мессенджера', () => {
        // Смягчение, ради которого дефект не был полной тишиной. Убрать его
        // заодно с правкой канала — значит поменять одну дыру на другую.
        for (const file of SITES) {
            expect(read(file), `${file} перестал писать в кабинет`).toContain('createNotification');
        }
    });
});
