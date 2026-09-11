// Причина неявки: поле есть, и оно принадлежит своему специалисту.
//
// Дефект, из которого вырос этот файл: кнопка «Причина» на карточке
// открывала общую форму записи, где причину ввести было НЕГДЕ — поля не
// существовало ни на экране, ни в базе. Кнопка обещала действие, которого
// продукт не умел, и молчала об этом.
//
// Проверяется то, что в такой правке ломается тише всего: чужая сессия,
// стирание уже написанного и попадание текста причины в аналитику.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: (...args: unknown[]) => auth(...args) }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const requireOwnedSession = vi.fn();
vi.mock('@/lib/practice/ownership', () => ({
    requireOwnedSession: (...args: unknown[]) => requireOwnedSession(...args),
    requireOwnedClient: vi.fn(),
}));

const diarySessionUpdate = vi.fn();
vi.mock('@/lib/db', () => ({
    db: {
        diarySession: {
            findUnique: vi.fn(),
            update: (...args: unknown[]) => diarySessionUpdate(...args),
        },
    },
}));

const track = vi.fn();
vi.mock('@/lib/analytics/track', () => ({ track: (...args: unknown[]) => track(...args) }));

// Зависимости самого модуля sessions.ts — причине не нужны, но импортируются
// на верхнем уровне.
vi.mock('@/lib/calendar/auto-sync', () => ({
    autoSyncSessionToCalendars: vi.fn(),
    autoDeleteSessionFromCalendars: vi.fn(),
}));
vi.mock('@/lib/telegram', () => ({ sendTelegramMessage: vi.fn() }));
vi.mock('@/lib/max-bot', () => ({ sendMaxMessage: vi.fn() }));
vi.mock('@/lib/client-workflow', () => ({
    buildSessionClientMessage: vi.fn(),
    clientBookingLink: vi.fn(),
    createAutoDocumentDeliveries: vi.fn(),
    getPaymentInstruction: vi.fn(),
}));
vi.mock('@/lib/waitlist-notify', () => ({ notifyWaitlistOnFreedSlot: vi.fn() }));
vi.mock('@/lib/practice/booking/booking', () => ({
    createManualPracticeSession: vi.fn(),
    reschedulePracticeBooking: vi.fn(),
    BookingConflictError: class BookingConflictError extends Error {},
}));
vi.mock('@/lib/practice/booking/repeat-slot', () => ({
    repeatClientSlot: vi.fn(),
    NoReferenceSessionError: class NoReferenceSessionError extends Error {},
    MAX_REPEAT_WEEKS: 12,
}));
vi.mock('@/lib/practice/session-notice', () => ({ notifyClientAboutSession: vi.fn() }));

async function load() {
    return import('../src/app/diary/actions/sessions');
}

describe('setNoShowReason', () => {
    beforeEach(() => {
        vi.resetModules();
        auth.mockReset();
        revalidatePath.mockReset();
        requireOwnedSession.mockReset();
        diarySessionUpdate.mockReset();
        track.mockReset();
        auth.mockResolvedValue({ user: { id: 'psy_1' } });
        requireOwnedSession.mockResolvedValue(undefined);
        diarySessionUpdate.mockImplementation(({ data }: any) => ({ id: 'session_1', ...data }));
    });

    it('сохраняет причину, обрезав лишние пробелы', async () => {
        const { setNoShowReason } = await load();
        await setNoShowReason('session_1', '  Заболел, предупредил утром  ');

        expect(diarySessionUpdate).toHaveBeenCalledWith({
            where: { id: 'session_1' },
            data: { noShowReason: 'Заболел, предупредил утром' },
        });
        expect(revalidatePath).toHaveBeenCalledWith('/diary');
    });

    // Пустая строка — это осознанное «убрать написанное», а не потеря
    // данных: в поле ложится NULL, а не пустая строка, иначе «причины нет»
    // и «причина — пустота» стали бы двумя разными состояниями.
    it('пустая строка стирает причину в NULL', async () => {
        const { setNoShowReason } = await load();
        await setNoShowReason('session_1', '   ');

        expect(diarySessionUpdate).toHaveBeenCalledWith({
            where: { id: 'session_1' },
            data: { noShowReason: null },
        });
    });

    it('чужую сессию не трогает — владение проверяется до записи', async () => {
        requireOwnedSession.mockRejectedValue(new Error('Сессия не найдена'));
        const { setNoShowReason } = await load();

        await expect(setNoShowReason('session_чужая', 'что угодно')).rejects.toThrow('Сессия не найдена');
        expect(diarySessionUpdate).not.toHaveBeenCalled();
    });

    it('слишком длинную причину отклоняет, а не пишет обрезанной', async () => {
        const { setNoShowReason } = await load();
        await expect(setNoShowReason('session_1', 'а'.repeat(501))).rejects.toThrow(/длиннее/);
        expect(diarySessionUpdate).not.toHaveBeenCalled();
    });

    // САМОЕ ВАЖНОЕ ЗДЕСЬ.
    //
    // Причина неявки — сведения о конкретном человеке. В событие уходит
    // только факт «заполнено/пусто»; текста там быть не может ни в каком виде.
    it('в аналитику уходит факт, но не текст причины', async () => {
        const { setNoShowReason } = await load();
        await setNoShowReason('session_1', 'Лежит в больнице');

        expect(track).toHaveBeenCalledTimes(1);
        const payload = JSON.stringify(track.mock.calls[0][1]);
        expect(payload).not.toContain('больнице');
        expect(track.mock.calls[0][1]).toMatchObject({
            event: 'session_no_show_reason_saved',
            props: { filled: true },
        });
    });
});

describe('кнопка «Причина» ведёт в свой диалог, а не в общую форму записи', () => {
    // Сторож против возврата ровно того дефекта, с которого всё началось:
    // openSession открывает «Редактировать запись» — оплата и заметки,
    // причины там нет и не будет.
    it('в ветке no_show нет openSession', async () => {
        const { readFileSync } = await import('fs');
        const page = readFileSync('src/app/diary/page.tsx', 'utf8');

        const start = page.indexOf("{s.status === 'no_show' && (");
        expect(start).toBeGreaterThan(-1);
        const branch = page.slice(start, page.indexOf(')}', page.indexOf('Перенести', start)));

        expect(branch).not.toContain('openSession');
        expect(branch).toContain('setNoShowTarget');
        expect(branch).toContain('setRescheduleTarget');
    });
});
