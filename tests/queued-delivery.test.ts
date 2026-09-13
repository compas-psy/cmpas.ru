// ЖИВОЙ СЛУЧАЙ, 13.09.2026: учредитель привязал клиенту MAX — и человеку
// немедленно пришло «Подтверждаю запись на консультацию … 26 февраля
// 2026 г. в 17:15». Февраль был семь месяцев назад.
//
// Сообщение, которому некуда было уйти, кладётся в очередь со сроком
// приглашения (30 дней), а слив очереди при привязке брал ВСЁ, что лежит в
// pending, без условия на возраст и на то, не прошла ли названная встреча.
// Тот же слив был скопирован в шесть мест — и ошибка была во всех.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
const update = vi.fn().mockResolvedValue({});
const sessionFindUnique = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        scheduledClientMessage: {
            findMany: (...a: unknown[]) => findMany(...a),
            update: (...a: unknown[]) => update(...a),
        },
        diarySession: {
            findUnique: (...a: unknown[]) => sessionFindUnique(...a),
        },
    },
}));

import { flushQueuedMessages, queuedMessageSkipReason, QUEUED_MESSAGE_TTL_MS } from '@/lib/messaging/queued-delivery';

const NOW = new Date('2026-09-13T10:00:00Z');

beforeEach(() => {
    vi.clearAllMocks();
    update.mockResolvedValue({});
});

function queued(overrides: Record<string, unknown> = {}) {
    return {
        id: 'msg-1',
        text: 'Подтверждаю запись…',
        sessionId: null,
        createdAt: new Date('2026-09-12T10:00:00Z'),
        ...overrides,
    };
}

describe('что ещё правда, а что протухло', () => {
    it('встреча прошла — не досылаем', async () => {
        sessionFindUnique.mockResolvedValue({ date: new Date('2026-02-26T00:00:00Z'), time: '17:15', status: 'confirmed' });
        expect(await queuedMessageSkipReason(queued({ sessionId: 's1' }), NOW)).toBe('SESSION_PASSED');
    });

    it('встреча впереди — досылаем', async () => {
        sessionFindUnique.mockResolvedValue({ date: new Date('2026-09-20T00:00:00Z'), time: '17:15', status: 'confirmed' });
        expect(await queuedMessageSkipReason(queued({ sessionId: 's1' }), NOW)).toBeNull();
    });

    it('встречу отменили, пока сообщение лежало — не досылаем', async () => {
        sessionFindUnique.mockResolvedValue({ date: new Date('2026-09-20T00:00:00Z'), time: '17:15', status: 'cancelled' });
        expect(await queuedMessageSkipReason(queued({ sessionId: 's1' }), NOW)).toBe('SESSION_CANCELLED');
    });

    it('встречи больше нет вовсе — не досылаем', async () => {
        sessionFindUnique.mockResolvedValue(null);
        expect(await queuedMessageSkipReason(queued({ sessionId: 's1' }), NOW)).toBe('SESSION_GONE');
    });

    it('текст без встречи живёт столько же, сколько приглашение', async () => {
        const fresh = queued({ createdAt: new Date(NOW.getTime() - QUEUED_MESSAGE_TTL_MS + 60_000) });
        expect(await queuedMessageSkipReason(fresh, NOW)).toBeNull();

        const stale = queued({ createdAt: new Date(NOW.getTime() - QUEUED_MESSAGE_TTL_MS - 60_000) });
        expect(await queuedMessageSkipReason(stale, NOW)).toBe('QUEUED_TOO_LONG');
    });
});

describe('слив очереди при привязке мессенджера', () => {
    it('протухшее не уходит человеку, но и не остаётся висеть', async () => {
        findMany.mockResolvedValue([queued({ id: 'old', sessionId: 's1' })]);
        sessionFindUnique.mockResolvedValue({ date: new Date('2026-02-26T00:00:00Z'), time: '17:15', status: 'confirmed' });
        const send = vi.fn();

        const result = await flushQueuedMessages({ clientId: 'c1', channel: 'max', send, now: NOW });

        expect(send).not.toHaveBeenCalled();
        expect(result).toEqual({ sent: 0, skipped: 1, failed: 0 });
        // Терминальный статус с причиной: иначе всплывёт при следующей
        // привязке и будет выглядеть доставленным в отчётах.
        expect(update).toHaveBeenCalledWith({
            where: { id: 'old' },
            data: { status: 'failed', errorMsg: 'SESSION_PASSED' },
        });
    });

    it('живое уходит и помечается отправленным', async () => {
        findMany.mockResolvedValue([queued({ id: 'fresh' })]);
        const send = vi.fn().mockResolvedValue(undefined);

        const result = await flushQueuedMessages({ clientId: 'c1', channel: 'telegram', send, now: NOW });

        expect(send).toHaveBeenCalledWith('Подтверждаю запись…');
        expect(result).toEqual({ sent: 1, skipped: 0, failed: 0 });
        expect(update).toHaveBeenCalledWith({
            where: { id: 'fresh' },
            data: { status: 'sent', sentAt: NOW },
        });
    });

    it('одно упавшее не задерживает остальные', async () => {
        findMany.mockResolvedValue([queued({ id: 'a' }), queued({ id: 'b', text: 'второе' })]);
        const send = vi.fn()
            .mockRejectedValueOnce(new Error('сеть'))
            .mockResolvedValueOnce(undefined);

        const result = await flushQueuedMessages({ clientId: 'c1', channel: 'telegram', send, now: NOW });

        expect(send).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ sent: 1, skipped: 0, failed: 1 });
    });

    it('в журнал не попадает ни текст, ни имя — только причина и канал', async () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        findMany.mockResolvedValue([queued({ id: 'old', text: 'Ирина, здравствуйте! +7 903 716-11-11', sessionId: 's1' })]);
        sessionFindUnique.mockResolvedValue({ date: new Date('2026-02-26T00:00:00Z'), time: '17:15', status: 'confirmed' });

        await flushQueuedMessages({ clientId: 'c1', channel: 'max', send: vi.fn(), now: NOW });

        const printed = log.mock.calls.map(c => c.join(' ')).join('\n');
        expect(printed).toContain('SESSION_PASSED');
        expect(printed).not.toContain('Ирина');
        expect(printed).not.toContain('716');
        log.mockRestore();
    });
});
