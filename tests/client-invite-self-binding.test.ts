// Своя же ссылка-приглашение не должна привязывать специалиста как клиента.
//
// ЖИВОЙ СЛУЧАЙ, 09.09.2026. Учредитель отправил клиенту ссылку на подключение
// бота, клиент подключиться не смог. Учредитель открыл ссылку сам — проверить,
// работает ли она. Проверки «кто открыл» в коде не было, и произошло ровно то,
// что и должно было:
//
//   1. его аккаунт мессенджера записался клиенту в карточку;
//   2. токен погас (usedAt), и настоящий клиент по той же ссылке получил
//      «страница не найдена»;
//   3. наутро уведомление ДЛЯ КЛИЕНТА («не хотите записаться?») пришло
//      специалисту — система считала его этим клиентом.
//
// Открыть собственную ссылку, чтобы посмотреть, — нормальное человеческое
// действие, а не ошибка пользователя. Значит защищать должен код.
//
// Здесь проверяется и вторая половина: токен при отказе НЕ гасится. Он выдан
// клиенту и обязан продолжать работать — иначе клиент наказан за то, что
// специалист заглянул в свою же ссылку.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
    clientInviteToken: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    diaryClient: { update: vi.fn() },
    telegramClient: { updateMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ db }));
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn() }));

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);

/** Приглашение, живое и непогашенное. */
function invite(over: Record<string, unknown> = {}) {
    return {
        id: 'inv-1',
        psychologistId: 'psy-1',
        clientId: 'client-1',
        channel: 'auto',
        usedAt: null,
        expiresAt: FUTURE,
        ...over,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    db.clientInviteToken.findFirst.mockResolvedValue(invite());
    db.clientInviteToken.findUnique.mockResolvedValue(invite());
    // Транзакция выполняется на тех же заглушках: нам важно не то, как
    // Prisma её обернёт, а то, дошло ли дело до записи вообще.
    db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));
    db.diaryClient.update.mockResolvedValue({ id: 'client-1', name: 'Аркадий', psychologistId: 'psy-1' });
    db.telegramClient.findUnique.mockResolvedValue(null);
});

describe('приглашение и его владелец', () => {
    it('специалист открыл СВОЮ ссылку — привязки нет', async () => {
        db.user.findUnique.mockResolvedValue({ telegramChatId: '555', maxChatId: null });
        const { consumeClientChannelInvite } = await import('@/lib/channel-binding');

        await expect(consumeClientChannelInvite({
            token: 'raw',
            channel: 'telegram',
            providerUserId: '555',
            providerChatId: '555',
        })).rejects.toThrow('INVITE_SELF_BINDING');

        // Ни карточка клиента, ни привязка Telegram не тронуты.
        expect(db.diaryClient.update).not.toHaveBeenCalled();
        expect(db.telegramClient.upsert).not.toHaveBeenCalled();
    });

    it('и токен при этом НЕ гасится — он ещё нужен клиенту', async () => {
        db.user.findUnique.mockResolvedValue({ telegramChatId: '555', maxChatId: null });
        const { consumeClientChannelInvite } = await import('@/lib/channel-binding');

        await expect(consumeClientChannelInvite({
            token: 'raw',
            channel: 'telegram',
            providerUserId: '555',
            providerChatId: '555',
        })).rejects.toThrow('INVITE_SELF_BINDING');

        expect(db.clientInviteToken.update).not.toHaveBeenCalled();
    });

    it('то же и в МАКСе', async () => {
        db.user.findUnique.mockResolvedValue({ telegramChatId: null, maxChatId: 'max_777' });
        const { consumeClientChannelInvite } = await import('@/lib/channel-binding');

        await expect(consumeClientChannelInvite({
            token: 'raw',
            channel: 'max',
            providerUserId: 'max_777',
            providerChatId: 'max_777',
        })).rejects.toThrow('INVITE_SELF_BINDING');
        expect(db.diaryClient.update).not.toHaveBeenCalled();
    });

    it('клиент по той же ссылке подключается как раньше', async () => {
        db.user.findUnique.mockResolvedValue({ telegramChatId: '555', maxChatId: null });
        const { consumeClientChannelInvite } = await import('@/lib/channel-binding');

        const client = await consumeClientChannelInvite({
            token: 'raw',
            channel: 'telegram',
            providerUserId: '999',
            providerChatId: '999',
        });

        expect(client.name).toBe('Аркадий');
        expect(db.diaryClient.update).toHaveBeenCalled();
        // А вот теперь токен гасится: им воспользовались по назначению.
        expect(db.clientInviteToken.update).toHaveBeenCalled();
    });

    it('у специалиста мессенджер не подключён — проверять не с чем, привязка идёт', async () => {
        // Честная граница: без известного идентификатора специалиста этот
        // случай не отличить. Молчаливо ломать привязку здесь было бы хуже.
        db.user.findUnique.mockResolvedValue({ telegramChatId: null, maxChatId: null });
        const { consumeClientChannelInvite } = await import('@/lib/channel-binding');

        await consumeClientChannelInvite({
            token: 'raw',
            channel: 'telegram',
            providerUserId: '555',
            providerChatId: '555',
        });
        expect(db.diaryClient.update).toHaveBeenCalled();
    });
});

describe('слова отказа живут в одном месте', () => {
    it('у своей ссылки — свой текст, и он говорит, что ссылка цела', async () => {
        const { channelInviteFailureMessage } = await import('@/lib/channel-binding');
        const text = channelInviteFailureMessage('INVITE_SELF_BINDING');
        expect(text).toContain('ваша собственная ссылка');
        expect(text).toContain('осталась действующей');
    });

    it('погашенная и истёкшая различаются', async () => {
        const { channelInviteFailureMessage } = await import('@/lib/channel-binding');
        expect(channelInviteFailureMessage('INVITE_ALREADY_USED')).toContain('уже использована');
        expect(channelInviteFailureMessage('INVITE_EXPIRED')).toContain('истёк');
    });
});
