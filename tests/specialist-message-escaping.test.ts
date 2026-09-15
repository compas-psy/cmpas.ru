import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ИМЯ КЛИЕНТА, УХОДЯЩЕЕ СПЕЦИАЛИСТУ, ЭКРАНИРУЕТСЯ.
 *
 * Дефект П5 книги 3 по пути специалиста. Все сообщения в Telegram уходят с
 * `parse_mode: 'HTML'` — это умолчание sendTelegramMessage, а не выбор
 * каждого места. Значит амперсанд в имени («Иванов & партнёры» у
 * клиента-организации) делает разметку недействительной, и Telegram
 * отвечает ОТКАЗОМ: сообщение не приходит вовсе.
 *
 * Не «приходит криво» — не приходит. В утреннем дайджесте это значит, что
 * из-за одного клиента специалист не получает список ВСЕГО дня и не узнаёт,
 * почему список перестал приходить.
 *
 * Правило escapeHtml в продукте есть и применено к сообщениям КЛИЕНТУ —
 * после того, как ровно этот дефект нашли в напоминаниях. К сообщениям
 * специалиста его не применили нигде.
 *
 * Проверка смотрит на исходник: поднимать базу и двух ботов ради четырёх
 * подстановок дороже, чем стеречь само правило там, где оно живёт.
 */

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf-8');

/** Где имя клиента попадает в текст, уходящий СПЕЦИАЛИСТУ с разметкой. */
const SITES: Array<{ file: string; marker: string; what: string }> = [
    {
        file: 'src/lib/cron/digest.ts',
        marker: 'sessions.map(s =>',
        what: 'утренний дайджест — список встреч дня',
    },
    {
        file: 'src/lib/cron/reminders.ts',
        marker: 'сессия с клиентом',
        what: 'напоминание специалисту за сутки',
    },
    {
        file: 'src/lib/cron/scheduled-messages.ts',
        marker: 'Пора отправить сообщение клиенту',
        what: 'напоминание «пора написать клиенту»',
    },
    {
        file: 'src/lib/telegram-bot.ts',
        marker: 'msg += `<b>',
        what: 'список ближайших сессий в боте',
    },
];

describe('имя клиента не ломает сообщение специалисту', () => {
    it.each(SITES)('$what экранирует имя', ({ file, marker }) => {
        const source = read(file);
        const at = source.indexOf(marker);
        expect(at, `строка «${marker}» пропала из ${file}`).toBeGreaterThan(-1);
        // Смотрим только на саму строку с подстановкой, а не на весь файл:
        // иначе тест проходил бы из-за escapeHtml где-то по соседству.
        const line = source.slice(at, source.indexOf('\n', at));
        expect(line, `${file}: имя клиента уходит без экранирования`).toContain('escapeHtml');
    });

    it('во всех четырёх местах правило берётся из общего модуля', () => {
        for (const { file } of SITES) {
            expect(read(file), `${file} завёл своё экранирование`)
                .toMatch(/import \{[^}]*escapeHtml[^}]*\} from '@\/lib\/messaging\/format'/);
        }
    });

    it('sendTelegramMessage и правда шлёт разметкой — иначе эта проверка ни о чём', () => {
        // Если умолчание однажды сменят на простой текст, экранирование
        // станет не защитой, а лишними «&amp;» в глазах у человека.
        expect(read('src/lib/telegram.ts')).toMatch(/parse_mode: 'HTML'/);
    });
});
