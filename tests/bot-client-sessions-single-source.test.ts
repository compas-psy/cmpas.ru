// «МОИ СЕССИИ» В БОТЕ ГОВОРИЛИ ЧЕЛОВЕКУ НЕПРАВДУ.
//
// Оба бота отбирали клиенту только подтверждённые встречи. Человек
// записывался, через минуту спрашивал бота про свои записи — и слышал «у вас
// нет предстоящих записей», хотя сообщение об этой самой записи прислал ему
// тот же бот минутой раньше: только что созданная встреча ждёт подтверждения.
//
// Вторым дефектом кнопка «Перенести» в этом списке вела на страницу НОВОЙ
// записи — подбор времени с нуля, при том что собственная встреча человека
// оставалась на месте. Этот дефект был найден и закрыт в напоминаниях и в
// сообщении о записи (session-action-links.ts — один источник трёх адресов),
// но в командах бота адрес собирался по месту и остался старым.
//
// Тест смотрит на исходный текст: воспроизводить диалог с двумя разными
// мессенджерами дороже, чем стеречь само правило.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
/**
 * Только код, без комментариев: объяснение дефекта в комментарии обязано
 * называть его своими словами, иначе оно ничего не объясняет. Проверяем то,
 * что уходит человеку, а не то, что написано рядом для нас.
 */
function code(path: string): string {
    return readFileSync(join(root, path), 'utf8')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
        .join('\n');
}

const telegram = code('src/lib/telegram-bot.ts');
const max = code('src/lib/max-bot.ts');

/** Отбор встреч КЛИЕНТА — по clientId. Отбор встреч специалиста тут ни при чём. */
function clientSessionQueries(source: string): string[] {
    return source
        .split('\n')
        .filter((line) => line.includes('clientId: client.id') || line.includes('clientId: client.id,'));
}

describe('список записей клиента в боте', () => {
    it('Telegram показывает и ожидающие подтверждения встречи', () => {
        const lines = clientSessionQueries(telegram);
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) expect(line).not.toContain("status: 'confirmed'");
    });

    it('MAX показывает и ожидающие подтверждения встречи', () => {
        const lines = clientSessionQueries(max);
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) expect(line).not.toContain("status: 'confirmed'");
    });

    it('оба бота берут три действия из общего источника, а не собирают адрес по месту', () => {
        expect(telegram).toContain("from '@/lib/practice/session-action-links'");
        expect(max).toContain("from '@/lib/practice/session-action-links'");
        expect(telegram).toContain('sessionActionButtons(');
        expect(max).toContain('sessionActionButtons(');
    });

    it('«Перенести» больше не открывает подбор времени с нуля', () => {
        expect(telegram).not.toContain("text: 'Перенести', web_app");
    });

    it('бот здоровается от имени ПРАКТИКИ, а не продукта, которого нет', () => {
        expect(telegram).not.toContain('Compas.ru');
    });

    it('клиенту не предлагают открыть кабинет специалиста', () => {
        // В ветках для клиента (справка и заглушка MAX) не должно быть кнопки
        // в /diary: войти туда клиенту нечем.
        expect(max).not.toContain("'Доступные команды:\\n\\n/sessions — ваши ближайшие записи\\n/help — эта справка\\n/connect");
        expect(max.match(/Открыть ПРАКТИКУ/g) ?? []).toHaveLength(0);
    });
});
