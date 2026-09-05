// Задача 22, главная приёмка: блокировка, поставленная с телефона, реально
// закрывает время для клиента.
//
// Проверка сквозная и намеренно без подмен посередине: блокировка создаётся
// НАСТОЯЩИМ мобильным ресурсом POST /api/mobile/blocks, строка, которую он
// записал, отдаётся НАСТОЯЩЕМУ резолверу доступности из Задачи 6
// (resolveAvailableTimesForDay) — тому же, которым живёт клиентская запись.
// Между ними ничего не переписывается руками: разойдись форматы даты или
// времени — тест покраснеет, а не промолчит.
//
// Декоративная блокировка, о которой знает только экран, — это обещание
// клиенту времени, которого у специалиста нет. Поэтому проверяется не факт
// записи в базу, а исчезновение слотов.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveAvailableTimesForDay } from '@/lib/practice/booking/availability';
import type { AvailabilitySlotInput, BlockInput } from '@/lib/practice/booking/types';

type BlockRow = {
    id: string;
    psychologistId: string;
    date: Date;
    startTime: string;
    endTime: string;
    type: string;
    reason: string | null;
};

const world = vi.hoisted(() => ({
    blocks: [] as BlockRow[],
    authUserId: 'psy-1' as string | null,
    nextId: 1,
}));

vi.mock('@/lib/mobile-auth', () => ({
    authenticateMobileRequest: vi.fn(async () => (world.authUserId ? { userId: world.authUserId } : null)),
    unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));

vi.mock('@/lib/db', () => ({
    db: {
        diaryBlock: {
            findMany: vi.fn(async () => world.blocks),
            createMany: vi.fn(async ({ data }: { data: Omit<BlockRow, 'id'>[] }) => {
                for (const row of data) world.blocks.push({ id: `b-${world.nextId++}`, ...row });
                return { count: data.length };
            }),
        },
        diarySession: { findMany: vi.fn(async () => []), updateMany: vi.fn(async () => ({ count: 0 })) },
    },
}));

const blocksApi = await import('@/app/api/mobile/blocks/route');

const DATE = '2026-09-10'; // четверг
/** «Сейчас» — сильно раньше этого дня, чтобы буфер записи не съедал слоты сам. */
const NOW = new Date('2026-09-01T06:00:00.000Z');

/** Окно приёма 14:00–18:00 в этот день недели. */
const slot: AvailabilitySlotInput = {
    id: 'slot-1',
    dayOfWeek: 3, // 0=Пн … 3=Чт
    startTime: '14:00',
    endTime: '18:00',
    duration: 60,
    format: 'online',
    addressId: null,
    startDate: null,
    endDate: null,
    scheduleRuleId: null,
    scheduleRule: null,
};

/** Блокировки в том виде, в каком их читает клиентская запись. */
function blocksForResolver(): BlockInput[] {
    return world.blocks.map((b) => ({ date: b.date, startTime: b.startTime, endTime: b.endTime }));
}

function offeredTimes() {
    return resolveAvailableTimesForDay({
        dateStr: DATE,
        slots: [slot],
        blocks: blocksForResolver(),
        sessions: [],
        settings: { timezone: 'Europe/Moscow', bookingBufferHours: 0, bookingHorizonDays: 60, sessionBreak: 0 },
        now: NOW,
    }).map((option) => option.time);
}

beforeEach(() => {
    world.blocks = [];
    world.authUserId = 'psy-1';
    world.nextId = 1;
});

describe('блокировка убирает время из клиентской записи', () => {
    it('до блокировки клиенту предлагается всё окно приёма', () => {
        expect(offeredTimes()).toEqual(['14:00', '15:00', '16:00', '17:00']);
    });

    it('после создания блокировки 15:00–16:00 пересекающееся время исчезает', async () => {
        const res = await blocksApi.POST({
            json: async () => ({ date: DATE, startTime: '15:00', endTime: '16:00', reason: 'Врач' }),
        } as never);
        expect(res.status).toBe(201);

        // Ровно тот час, что закрыли, и ни часом больше.
        expect(offeredTimes()).toEqual(['14:00', '16:00', '17:00']);
    });

    it('блокировка шире одного слота закрывает все пересекающиеся часы', async () => {
        await blocksApi.POST({
            json: async () => ({ date: DATE, startTime: '14:30', endTime: '17:00' }),
        } as never);

        // 14:00–15:00 пересекается с 14:30, 15:00 и 16:00 внутри блокировки.
        expect(offeredTimes()).toEqual(['17:00']);
    });

    it('блокировка на другой день окно этого дня не трогает', async () => {
        await blocksApi.POST({
            json: async () => ({ date: '2026-09-11', startTime: '15:00', endTime: '16:00' }),
        } as never);

        expect(offeredTimes()).toEqual(['14:00', '15:00', '16:00', '17:00']);
    });

    it('блокировка вплотную к слоту его не съедает', async () => {
        // 13:00–14:00 заканчивается ровно там, где начинается приём.
        await blocksApi.POST({
            json: async () => ({ date: DATE, startTime: '13:00', endTime: '14:00' }),
        } as never);

        expect(offeredTimes()).toEqual(['14:00', '15:00', '16:00', '17:00']);
    });
});
