// Задача 25 §5, §6: запись видна счётчиками, а разбор инцидента — логом.
//
// Точка наблюдения одна на все пути записи — обёртка внутри ядра. Считать
// попытки в веб-действии, в мобильном роуте и в ядре сразу означало бы
// считать одну и ту же запись два-три раза, а числа, которым нельзя верить,
// хуже отсутствующих.
//
// Транзакция здесь подменена целиком: её тело — это Задачи 7 и 8, у них свои
// тесты. Проверяется ровно то, что добавила Задача 25: КОГДА событие
// рождается, ЧТО в нём лежит и что попадает в лог при конфликте.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { expectRegistryClean, eventsNamed, type CapturedEvent } from '../../../../../tests/fixtures/analytics-capture';

const world = vi.hoisted(() => ({
    captured: [] as CapturedEvent[],
    logs: [] as string[],
    fail: null as Error | null,
}));

vi.mock('@/lib/analytics/track', () => ({
    track: vi.fn(async (_db: unknown, input: CapturedEvent) => { world.captured.push(input); }),
}));

vi.mock('@/lib/db', () => ({
    db: {
        // Тело транзакции не выполняется: колбэк не вызывается вовсе.
        $transaction: vi.fn(async () => {
            if (world.fail) throw world.fail;
            return { id: 'sess-1' };
        }),
        psychologistSettings: { findUnique: vi.fn(async () => ({ timezone: 'Europe/Moscow', blockConflicts: true })) },
    },
}));

vi.mock('../external-busy', () => ({ fetchExternalBusyBlocks: vi.fn(async () => []) }));

vi.mock('../slot-token', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../slot-token')>();
    return {
        ...actual,
        verifySlotToken: vi.fn((psychologistId: string, token: string) => (
            token === 'stale' ? null : {
                psychologistId,
                dateStr: '2026-09-10',
                time: '10:00',
                availabilitySlotId: 'slot-1',
                scheduleRuleId: 'rule-1',
                format: 'online',
                addressId: null,
                duration: 50,
            }
        )),
    };
});

const booking = await import('../booking');

beforeEach(() => {
    world.captured = [];
    world.logs = [];
    world.fail = null;
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { world.logs.push(args.join(' ')); });
});

function knownClient(slotToken = 'good') {
    return booking.createPracticeBooking({ psychologistId: 'psy-1', clientId: 'cl-1', slotToken, origin: 'manual' } as never);
}

function reschedule(slotToken = 'good') {
    return booking.reschedulePracticeBooking({ psychologistId: 'psy-1', sessionId: 'sess-1', slotToken } as never);
}

describe('наблюдаемость записи', () => {
    it('попытка и успех считаются один раз каждая, с одним источником', async () => {
        await knownClient();

        expect(world.captured.map((e) => e.event)).toEqual(['practice_booking_attempted', 'practice_booking_succeeded']);
        expect(world.captured[0].props).toEqual({ source: 'known_client' });
        expect(world.captured[1].props).toEqual({ source: 'known_client' });
        expectRegistryClean(world.captured);
    });

    it('успех пишется только после того, как транзакция завершилась', async () => {
        const order: string[] = [];
        const { db } = await import('@/lib/db');
        vi.mocked(db.$transaction).mockImplementationOnce((async () => {
            order.push('transaction');
            return { id: 'sess-1' };
        }) as never);
        const { track } = await import('@/lib/analytics/track');
        vi.mocked(track).mockImplementation(async (_db, input) => {
            order.push(input.event);
            world.captured.push(input as CapturedEvent);
        });

        await knownClient();

        expect(order).toEqual(['practice_booking_attempted', 'transaction', 'practice_booking_succeeded']);
    });

    it('конфликт слота: успеха нет, есть конфликт с машинным кодом', async () => {
        world.fail = new booking.BookingConflictError('SLOT_UNAVAILABLE', 'Это время уже заняли');

        await expect(knownClient()).rejects.toThrow();

        expect(eventsNamed(world.captured, 'practice_booking_succeeded')).toHaveLength(0);
        const [conflict] = eventsNamed(world.captured, 'practice_booking_conflict');
        expect(conflict.props).toEqual({ source: 'known_client', error_code: 'SLOT_UNAVAILABLE' });
        expectRegistryClean(world.captured);
    });

    it('перенос — свой источник, а не «ещё одна запись»', async () => {
        world.fail = new booking.BookingConflictError('CLIENT_ALREADY_BOOKED', 'У вас уже есть встреча в этот день');

        await expect(reschedule()).rejects.toThrow();

        const [conflict] = eventsNamed(world.captured, 'practice_booking_conflict');
        expect(conflict.props).toEqual({ source: 'reschedule', error_code: 'CLIENT_ALREADY_BOOKED' });
    });

    it('устаревшая ссылка попыткой не считается — событий нет вовсе', async () => {
        await expect(knownClient('stale')).rejects.toThrow();

        expect(world.captured).toEqual([]);
    });
});

describe('лог конфликта записи', () => {
    it('в логе correlation_id, источник и код — и ничего о человеке', async () => {
        world.fail = new booking.BookingConflictError('SLOT_UNAVAILABLE', 'Это время уже заняли: Анна Волкова, +7 999 123-45-67');

        await expect(knownClient()).rejects.toThrow();

        const line = world.logs.join('\n');
        expect(line).toContain('[practice-booking]');
        expect(line).toContain('source=known_client');
        expect(line).toContain('error_code=SLOT_UNAVAILABLE');
        expect(line).toMatch(/correlation_id=[0-9a-f-]{36}/);
        for (const secret of ['Волкова', '999', 'client=', 'phone=', 'email=', 'token=', 'notes=']) {
            expect(line).not.toContain(secret);
        }
    });

    it('correlation_id из лога есть на самой ошибке — по нему поддержка и ищет', async () => {
        world.fail = new booking.BookingConflictError('SLOT_UNAVAILABLE', 'занято');

        const error = await knownClient().catch((e) => e);

        expect(error).toBeInstanceOf(booking.BookingConflictError);
        expect(error.correlationId).toMatch(/^[0-9a-f-]{36}$/);
        expect(world.logs.join('\n')).toContain(`correlation_id=${error.correlationId}`);
    });

    it('correlation_id в аналитику не уходит: там он был бы ниточкой к человеку', async () => {
        world.fail = new booking.BookingConflictError('SESSION_NOT_FOUND', 'нет такой встречи');

        await expect(reschedule()).rejects.toThrow();

        for (const captured of world.captured) {
            expect(Object.keys(captured.props)).not.toContain('correlation_id');
        }
        expectRegistryClean(world.captured);
    });

    it('неожиданная ошибка логируется категорией, а не своим текстом', async () => {
        world.fail = new Error('connect ECONNREFUSED 10.0.0.5:5432 while booking Анна Волкова');

        await expect(knownClient()).rejects.toThrow();

        const line = world.logs.join('\n');
        expect(line).toContain('error_code=INTERNAL_ERROR');
        expect(line).not.toContain('Волкова');
        expect(line).not.toContain('ECONNREFUSED');
        expect(eventsNamed(world.captured, 'practice_booking_conflict')).toHaveLength(0);
    });
});
