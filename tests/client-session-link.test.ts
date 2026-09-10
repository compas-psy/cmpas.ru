// Ссылка о встрече ведёт на встречу, а не на подбор нового времени.
//
// Живой случай 10.09.2026. Сообщение обещало: «Подтвердить, перенести или
// отменить встречу можно здесь». По ссылке открывалась страница «Когда вам
// удобнее?» — подбор НОВОГО времени, где нет ни одного из трёх обещанных
// действий. Учредитель: «переходя по которой вижу страницу, где нет нихрена
// никаких подтверждений, а просто страница записи».

import { describe, it, expect } from 'vitest';
import { buildSessionClientMessage, clientBookingLink, clientSessionLink, resolveSignedPersonalClientToken } from '@/lib/client-workflow';

describe('адрес встречи для клиента', () => {
    it('ведёт в «Мои встречи» и называет саму встречу', () => {
        const link = clientSessionLink('psy-1', 'client-1', 'session-A');

        expect(link).toContain('/bot/client');
        expect(link).toContain('s=session-A');
        expect(link).not.toContain('/bot/book/');
    });

    it('личность подписана, а не передана номером', () => {
        // Номер встречи сам по себе ничего не открывает: список приходит под
        // проверенной личностью, и чужая встреча в нём не окажется.
        const link = clientSessionLink('psy-1', 'client-1', 'session-A');
        const token = new URL(link).searchParams.get('c') || '';

        expect(resolveSignedPersonalClientToken(token)?.clientId).toBe('client-1');
        expect(resolveSignedPersonalClientToken('client-1')).toBeNull();
    });
});

describe('строка в сообщении', () => {
    const base = {
        clientName: 'Мария Соколова',
        psychologistName: 'Анна Волкова',
        date: new Date('2026-09-15T00:00:00Z'),
        time: '19:00',
        format: 'online',
        bookingLink: clientBookingLink('psy-1', 'client-1'),
    };

    it('обещает то, что человек найдёт по ссылке', () => {
        const text = buildSessionClientMessage({
            ...base,
            manageLink: clientSessionLink('psy-1', 'client-1', 'session-A'),
        });

        expect(text).toContain('Посмотреть встречу, подтвердить, перенести или отменить');
        expect(text).toContain('/bot/client');
        expect(text).not.toContain('/bot/book/');
    });

    it('без встречи остаётся страница записи — там и обещать нечего', () => {
        // Так уходят сообщения, собранные до появления встречи (онбординг).
        const text = buildSessionClientMessage(base);
        expect(text).toContain('/bot/book/');
    });
});
