// Три действия по встрече ведут туда, где они действительно есть.
//
// Строка «Подтвердить, перенести или отменить встречу можно здесь» обещала
// человеку три действия, а ссылка вела на страницу НОВОЙ записи, где не было
// ни одного. Кнопка «Перенести» в напоминании вела туда же — хотя страница
// переноса конкретной встречи существует, умеет ровно это и проверяет токен
// именно на перенос.
//
// Учредитель 10.09.2026: «кнопки Подтверждаю, Перенести, Отменить» — ровно
// три, столько же, сколько обещает строка над ними.

import { describe, it, expect } from 'vitest';
import { sessionActionButtons, sessionActionLinks } from '@/lib/practice/session-action-links';
import { verifySessionActionToken } from '@/lib/client-workflow';

const INPUT = {
    psychologistId: 'psy-1',
    clientId: 'client-1',
    sessionId: 'session-A',
    date: new Date('2026-09-15T00:00:00Z'),
};

function tokenOf(url: string): string {
    return new URL(url).searchParams.get('t') || '';
}

describe('адреса трёх действий', () => {
    it('перенос ведёт на страницу переноса ЭТОЙ встречи, а не на новую запись', () => {
        const links = sessionActionLinks(INPUT);
        expect(links.reschedule).toContain('/client/reschedule/session-A');
        expect(links.reschedule).not.toContain('/bot/book/');
    });

    it('подтверждение и отмена — обработчик действия, каждый со своим адресом', () => {
        const links = sessionActionLinks(INPUT);
        expect(links.confirm).toContain('a=confirm');
        expect(links.cancel).toContain('a=cancel');
    });

    it('токен подтверждения не работает как токен отмены', () => {
        // Задача 3, пункт D: раньше один статический токен на клиента годился
        // и для отмены чужой встречи.
        const links = sessionActionLinks(INPUT);
        const confirmToken = tokenOf(links.confirm);

        expect(verifySessionActionToken('psy-1', 'client-1', 'session-A', 'confirm', confirmToken)).toBe(true);
        expect(verifySessionActionToken('psy-1', 'client-1', 'session-A', 'cancel', confirmToken)).toBe(false);
    });

    it('токен не работает на другой встрече и у другого клиента', () => {
        const token = tokenOf(sessionActionLinks(INPUT).confirm);

        expect(verifySessionActionToken('psy-1', 'client-1', 'session-B', 'confirm', token)).toBe(false);
        expect(verifySessionActionToken('psy-1', 'client-2', 'session-A', 'confirm', token)).toBe(false);
    });

    it('токен переноса проверяется именно как перенос', () => {
        const links = sessionActionLinks(INPUT);
        const token = tokenOf(links.reschedule);

        expect(verifySessionActionToken('psy-1', 'client-1', 'session-A', 'reschedule', token)).toBe(true);
        expect(verifySessionActionToken('psy-1', 'client-1', 'session-A', 'cancel', token)).toBe(false);
    });
});

describe('кнопки под сообщением', () => {
    it('три действия — три кнопки', () => {
        const rows = sessionActionButtons(INPUT, { includeConfirm: true });
        const labels = rows.flat().map(b => b.text);

        expect(labels).toEqual(['Подтверждаю', 'Перенести', 'Отменить']);
    });

    it('отмена не стоит бок о бок с подтверждением', () => {
        // Промах пальцем здесь стоит встречи.
        const rows = sessionActionButtons(INPUT, { includeConfirm: true });

        expect(rows[0].map(b => b.text)).toEqual(['Подтверждаю']);
        expect(rows[1].map(b => b.text)).toEqual(['Перенести', 'Отменить']);
    });

    it('уже подтверждённой встрече не предлагают подтвердить ещё раз', () => {
        const labels = sessionActionButtons(INPUT, { includeConfirm: false }).flat().map(b => b.text);

        expect(labels).toEqual(['Перенести', 'Отменить']);
    });
});
