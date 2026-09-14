// Напоминание клиенту: имя, пояс и разметка.
//
// Три дефекта, найденные разбором пути клиента 14.09.2026, жили в одном
// тексте:
//
//   К19 — обращение полным именем из карточки: «Здравствуйте, Мартынова
//         Ирина Петровна!», при том что сообщение о самой записи в том же
//         чате обращается по имени;
//   К20 — имя не экранировалось, а напоминание уходит с разметкой Telegram:
//         амперсанд в имени делает разметку недействительной, Telegram
//         отвечает отказом, и человек не получает напоминание вовсе;
//   К6  — час уходил без часового пояса, хотя поле под него в сборщике есть
//         и заведено ровно под случай «клиент из другого региона пришёл
//         мимо».

import { describe, it, expect } from 'vitest';
import { build24hReminderText } from '../src/lib/cron/reminder-text';

const base = {
    time: '11:00',
    format: 'online',
    onlineLink: 'https://telemost.yandex.ru/j/8123',
    confirmationRequired: true,
};

describe('напоминание за сутки', () => {
    it('здоровается по имени, а не полной записью из карточки', () => {
        const text = build24hReminderText({ ...base, clientName: 'Мартынова Ирина Петровна' });
        expect(text).toContain('Здравствуйте, Ирина!');
        expect(text).not.toContain('Мартынова Ирина Петровна');
    });

    it('экранирует имя: амперсанд не ломает разметку и не отменяет отправку', () => {
        const text = build24hReminderText({ ...base, clientName: 'A&B' });
        // Ни одного голого амперсанда: Telegram разбирает текст как разметку,
        // и любой неэкранированный символ здесь — это отказ отправки целиком.
        expect(text).not.toMatch(/&(?!amp;|lt;|gt;)/);
        expect(text).toContain('&amp;');
    });

    it('называет часовой пояс, когда он известен', () => {
        const text = build24hReminderText({ ...base, clientName: 'Ирина', timezoneLabel: 'Москва (GMT+3)' });
        expect(text).toContain('11:00 (Москва (GMT+3))');
    });

    it('без пояса час остаётся как был — пустая подпись не приклеивается', () => {
        const text = build24hReminderText({ ...base, clientName: 'Ирина', timezoneLabel: '' });
        expect(text).toContain('Завтра в 11:00 у вас встреча');
        expect(text).not.toContain('()');
    });

    it('ссылка на видеовстречу остаётся якорем — в MAX её вынимает в кнопку сама отправка', () => {
        const text = build24hReminderText({ ...base, clientName: 'Ирина' });
        expect(text).toContain('<a href="https://telemost.yandex.ru/j/8123">Яндекс Телемост</a>');
    });
});
