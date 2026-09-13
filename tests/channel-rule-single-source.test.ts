// ОДИН ВОПРОС — ОДИН ОТВЕТ.
//
// 13.09.2026: у клиентки подключены и MAX, и Telegram. Приложение предлагало
// отправку только в Telegram, веб в том же случае советовал MAX, а последним
// человек приходил через MAX. Три ответа на один вопрос.
//
// Причина — не в логике выбора, а в том, что её переписали руками в пяти
// местах, и в трёх из них по-разному:
//
//     client.telegramChatId ? 'telegram' : client.maxChatId ? 'max' : null
//     client.maxChatId ? 'max' : client.telegramChatId ? 'telegram' : 'max'
//
// Настоящее правило живёт в pickChannel и учитывает preferredChannel — канал,
// через который человек пришёл последним. Этот тест не даёт завести шестую
// копию.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sourceFiles(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === '.next') continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) sourceFiles(full, acc);
        else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) acc.push(full);
    }
    return acc;
}

/** Единственное место, где правилу и положено быть. */
const HOME = join('src', 'lib', 'messaging', 'channel-rule.ts');

describe('выбор мессенджера написан один раз', () => {
    it('никто не выводит канал из наличия chatId сам', () => {
        const offenders: string[] = [];
        for (const file of sourceFiles('src')) {
            if (file.endsWith(HOME)) continue;
            const text = readFileSync(file, 'utf8');
            // Обе формы, которые встречались живьём: telegram-first и max-first.
            if (/telegramChatId\s*\?\s*'telegram'/.test(text) || /maxChatId\s*\?\s*'max'\s*:\s*\w+\.telegramChatId\s*\?\s*'telegram'/.test(text)) {
                offenders.push(file);
            }
        }
        expect(offenders, `правило выбора канала скопировано вручную — зовите pickChannel из ${HOME}`).toEqual([]);
    });
});
