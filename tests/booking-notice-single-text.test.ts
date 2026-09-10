// Об одном событии — один текст, а не два.
//
// До 10.09.2026 о записи существовало два разных письма. Путь самозаписи
// отправлял своё, сочинённое на месте:
//
//     «Вы записаны — Специалист / Дата / Время / Формат»
//
// а путь специалиста — общий текст сборщика: «Подтверждаю запись на
// консультацию…», с документами и со ссылкой на управление встречей. Какой из
// двух получит человек, зависело от того, кто нажал кнопку.
//
// Проверка читает исходник: у сборщика сообщения нет второго вызывающего, а
// путь самозаписи зовёт общую отправку.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SELF_BOOKING = 'src/app/bot/actions.ts';

function code(path: string): string {
    return readFileSync(path, 'utf8')
        .split('\n')
        .filter(line => {
            const trimmed = line.trimStart();
            return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
        })
        .join('\n');
}

describe('текст о записи один на все пути', () => {
    it('самозапись зовёт общий сборщик, а не пишет своё письмо', () => {
        expect(code(SELF_BOOKING)).toContain('notifyClientAboutSession');
    });

    it('второго текста «Вы записаны» больше нет', () => {
        expect(code(SELF_BOOKING)).not.toContain('Вы записаны');
    });

    it('первая встреча остаётся первой встречей — документы уходят с ней', () => {
        // Признак «первая» передаётся сборщику: именно по нему уходят договор
        // и согласие. Раньше самозапись их не отправляла вовсе.
        expect(code(SELF_BOOKING)).toMatch(/notifyClientAboutSession\([^)]*sessionsCount === 1\)/);
    });
});
