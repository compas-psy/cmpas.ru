// Прошедшей встрече не предлагают подключиться, перенести и отменить.
//
// Живой случай 10.09.2026: учредитель отметил встречу как состоявшуюся и
// увидел под ней ровно эти три кнопки. Причина была в том, что панель не
// смотрела ни на статус, ни на дату — в ней не было ни одного условия.
//
// Слова учредителя задают правило целиком: «Если сессия закончилась, то зачем
// подключаться? Я уже отметил, что сессия Была — ЕСЛИ НЕ БЫЛА, ТО ДРУГОЕ
// ДЕЛО». То есть дверь закрывает не время, а названный исход.

import { describe, it, expect } from 'vitest';
import {
    isSessionDayOver,
    isSessionSettled,
    paymentActionLabel,
    sessionActions,
} from '@/lib/practice/session-actions';

/** Сейчас — 10 сентября 2026, 15:00. */
const NOW = new Date(2026, 8, 10, 15, 0, 0);
const TODAY = new Date(Date.UTC(2026, 8, 10));
const YESTERDAY = new Date(Date.UTC(2026, 8, 9));
const TOMORROW = new Date(Date.UTC(2026, 8, 11));

describe('исход назван человеком, а не выведен из статуса', () => {
    it('completed без отметки времени — это догадка сервера, а не слово специалиста', () => {
        // settlePastSessionsForPsychologist ставит completed через 15 минут
        // после конца встречи. Считать это ответом специалиста нельзя.
        expect(isSessionSettled('completed', null)).toBe(false);
    });

    it('completed с отметкой времени — слово специалиста', () => {
        expect(isSessionSettled('completed', new Date())).toBe(true);
    });

    it('no_show сервер не ставит никогда — это всегда сказанное слово', () => {
        expect(isSessionSettled('no_show', null)).toBe(true);
    });

    it('отменённая — вопрос закрыт', () => {
        expect(isSessionSettled('cancelled', null)).toBe(true);
    });
});

describe('сутки встречи', () => {
    it('вчерашняя — день закрыт', () => {
        expect(isSessionDayOver(YESTERDAY, NOW)).toBe(true);
    });

    it('сегодняшняя — ещё нет, даже если час прошёл', () => {
        // Люди опаздывают: встреча в 13:00 вполне может начаться в 13:20.
        expect(isSessionDayOver(TODAY, NOW)).toBe(false);
    });
});

describe('набор действий', () => {
    const upcoming = { status: 'confirmed', outcomeRecordedAt: null, date: TOMORROW, format: 'online' };

    it('предстоящей встрече — весь набор, подключение первым', () => {
        const actions = sessionActions(upcoming, NOW);
        expect(actions[0]).toBe('connect');
        expect(actions).toContain('reschedule');
        expect(actions).toContain('cancel');
    });

    it('очной встрече подключаться некуда', () => {
        expect(sessionActions({ ...upcoming, format: 'offline' }, NOW)).not.toContain('connect');
    });

    it('ОТМЕЧЕННОЙ встрече не предлагают ни подключиться, ни перенести, ни отменить', () => {
        // Ровно то, что увидел учредитель.
        const marked = { status: 'completed', outcomeRecordedAt: new Date(), date: TODAY, format: 'online' };
        const actions = sessionActions(marked, NOW);

        expect(actions).not.toContain('connect');
        expect(actions).not.toContain('reschedule');
        expect(actions).not.toContain('cancel');
        expect(actions[0]).toBe('rebook');
    });

    it('сегодняшняя, но ЕЩЁ НЕ отмеченная — весь набор остаётся', () => {
        // «Если не была, то другое дело»: час прошёл, но ответа не было, и
        // отнимать у специалиста подключение и перенос не за что.
        const today = { status: 'completed', outcomeRecordedAt: null, date: TODAY, format: 'online' };
        const actions = sessionActions(today, NOW);

        expect(actions).toContain('connect');
        expect(actions).toContain('reschedule');
        expect(actions).toContain('cancel');
    });

    it('вчерашняя без отметки — подключаться уже не к чему', () => {
        const old = { status: 'completed', outcomeRecordedAt: null, date: YESTERDAY, format: 'online' };
        expect(sessionActions(old, NOW)).not.toContain('connect');
    });

    it('отменённой встречи больше нет: ни переноса, ни оплаты', () => {
        const cancelled = { status: 'cancelled', outcomeRecordedAt: null, date: TOMORROW, format: 'online' };
        const actions = sessionActions(cancelled, NOW);

        expect(actions).toEqual(['rebook', 'message']);
    });
});

describe('кнопка оплаты называет действие, пока оно возможно', () => {
    it('не отмечена — «Отметить оплату» и нажимается', () => {
        expect(paymentActionLabel('unpaid')).toEqual({ label: 'Отметить оплату', enabled: true });
    });

    it('отмечена — «Оплачено» и не нажимается', () => {
        // Кнопка предлагала отметить то, что уже отмечено.
        expect(paymentActionLabel('paid')).toEqual({ label: 'Оплачено', enabled: false });
    });
});
