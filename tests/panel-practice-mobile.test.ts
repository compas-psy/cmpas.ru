// Блок «С телефона» (решение учредителя 7).
//
// Главное, что здесь проверяется, — не арифметика, а честность: пока событий
// из приложения не приходило, блок обязан быть в no_data с настоящей причиной,
// а не показывать ноль. Измеренный ноль и отсутствие измерения выглядят
// одинаково только в плохой панели, и различить их постфактум нельзя.
//
// Второе: доля мобильных считается по разным источникам — числитель по
// событиям (шлют только согласившиеся), знаменатель по бизнес-таблице (все).
// Значит это оценка снизу, и доля согласий обязана ехать в том же блоке, иначе
// по цифре нельзя принимать решение.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
    events: [] as any[],
    sessionCount: 0,
    consented: 0,
    sessionRows: [] as any[],
};

vi.mock('@/lib/db', () => ({
    db: {
        analyticsEvent: { findMany: async () => state.events },
        diarySession: {
            count: async () => state.sessionCount,
            findMany: async () => state.sessionRows,
        },
        user: { count: async () => state.consented },
    },
}));

beforeEach(() => {
    state.events = [];
    state.sessionCount = 0;
    state.consented = 0;
    state.sessionRows = [];
});

describe('q_practice_mobile', () => {
    it('без событий — честная дыра, а не ноль', async () => {
        const { qPracticeMobile } = await import('@/lib/panel/queries/products');
        state.sessionCount = 40;
        state.sessionRows = [{ psychologistId: 'p1' }];

        const block = await qPracticeMobile();

        expect(block.state).toBe('no_data');
        expect(block.data).toBeNull();
        expect(block.reason).toBeTruthy();
        expect(block.reason).toContain('согласие');
    });

    it('доля согласий едет вместе с числами, а не отдельно', async () => {
        const { qPracticeMobile } = await import('@/lib/panel/queries/products');
        state.events = [
            { event: 'session_created', props: { surface: 'android', delivered: true } },
            { event: 'session_created', props: { surface: 'android', delivered: false } },
        ];
        state.sessionCount = 10;
        state.consented = 3;
        state.sessionRows = [{ psychologistId: 'p1' }, { psychologistId: 'p2' }, { psychologistId: 'p3' }, { psychologistId: 'p1' }];

        const block = await qPracticeMobile();

        expect(block.state).toBe('ok');
        expect(block.data!.consentShare).toBe(100); // 3 согласившихся из 3 активных
        expect(block.data!.mobileSessions).toBe(2);
        expect(block.data!.totalSessions).toBe(10);
        expect(block.data!.mobileShare).toBe(20);
    });

    it('доля недоставленного считается только по событиям, где delivered вообще есть', async () => {
        const { qPracticeMobile } = await import('@/lib/panel/queries/products');
        state.events = [
            { event: 'session_created', props: { delivered: false } },
            { event: 'session_created', props: { delivered: true } },
            { event: 'session_created', props: { delivered: true } },
            { event: 'session_created', props: { delivered: true } },
            // без delivered — не участвует ни в числителе, ни в знаменателе
            { event: 'client_invite_created', props: { channel: 'telegram' } },
        ];
        state.sessionCount = 4;
        state.consented = 1;
        state.sessionRows = [{ psychologistId: 'p1' }];

        const block = await qPracticeMobile();

        expect(block.data!.undeliveredShare).toBe(25); // 1 из 4, а не 1 из 5
    });

    it('нет активных специалистов — доля согласий null, а не сто процентов от нуля', async () => {
        const { qPracticeMobile } = await import('@/lib/panel/queries/products');
        state.events = [{ event: 'session_created', props: { delivered: true } }];
        state.sessionCount = 0;
        state.consented = 0;
        state.sessionRows = [];

        const block = await qPracticeMobile();

        expect(block.data!.consentShare).toBeNull();
        expect(block.data!.mobileShare).toBeNull();
    });
});
