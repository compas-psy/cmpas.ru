// MAX: контакт приходит вложением, а не текстом.
//
// Тест сторожит ровно то, из-за чего функции раньше не было: тип
// MaxUpdate объявлял тело сообщения как { mid, text? }, вложения не
// читались вовсе, и сообщение с контактом (у которого текста обычно нет)
// уходило в меню-заглушку.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const previewContactIntake = vi.fn();
const commitContactIntake = vi.fn();
vi.mock('@/lib/clients/contact-intake', () => ({
    previewContactIntake: (...a: unknown[]) => previewContactIntake(...a),
    commitContactIntake: (...a: unknown[]) => commitContactIntake(...a),
}));

const userFindFirst = vi.fn();
vi.mock('@/lib/db', () => ({
    db: {
        user: { findFirst: (...a: unknown[]) => userFindFirst(...a), findUnique: vi.fn() },
        diarySession: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
        diaryClient: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
        scheduledClientMessage: { findMany: vi.fn(), update: vi.fn() },
        telegramClient: { upsert: vi.fn(), updateMany: vi.fn() },
    },
}));
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn() }));
vi.mock('@/lib/calendar/auto-sync', () => ({ autoDeleteSessionFromCalendars: vi.fn() }));
vi.mock('@/lib/client-cancellation', () => ({ canClientCancel: vi.fn(), clientCancelBlockedMessage: vi.fn() }));
vi.mock('@/lib/channel-binding', () => ({ consumeClientChannelInvite: vi.fn() }));
vi.mock('@/lib/client-workflow', () => ({
    sessionActionToken: vi.fn(), sessionActionTokenExpiry: vi.fn(), personalClientToken: vi.fn(),
}));

const fetchMock = vi.fn();

const VCF = ['BEGIN:VCARD', 'FN:Анна Волкова', 'TEL;TYPE=CELL:+79161234567', 'END:VCARD'].join('\r\n');

function contactUpdate(): MaxUpdateArg {
    return {
        update_id: 1,
        update_type: 'message_created',
        timestamp: Date.now(),
        message: {
            sender: { user_id: 777002 },
            recipient: { chat_id: 'c1' },
            body: {
                mid: 'm1',
                attachments: [
                    { type: 'contact', payload: { vcf_info: VCF, max_info: { user_id: 999, first_name: 'Анна' } } },
                ],
            },
        },
    };
}

// Тип берём у самого бота: подписывать его «unknown» значило бы не
// заметить, если форма обновления однажды разойдётся с тем, что шлёт MAX.
type MaxUpdateArg = Parameters<typeof import('../src/lib/max-bot')['handleMaxUpdate']>[0];
let handleMaxUpdate: (u: MaxUpdateArg) => Promise<void>;

beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.MAX_BOT_TOKEN = 'test-token';
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
    ({ handleMaxUpdate } = await import('../src/lib/max-bot'));
});

describe('MAX — пересланный контакт', () => {
    it('вложение contact уходит в разбор, а не в меню-заглушку', async () => {
        previewContactIntake.mockResolvedValue({ kind: 'not_a_psychologist' });
        await handleMaxUpdate(contactUpdate());

        expect(previewContactIntake).toHaveBeenCalledTimes(1);
        const arg = previewContactIntake.mock.calls[0][0];
        expect(arg.source).toBe('max');
        // Идентификатор специалиста — с префиксом max_, как везде в этом боте.
        expect(arg.senderChatId).toBe('max_777002');
        expect(arg.contact.vcf_info).toContain('BEGIN:VCARD');
    });

    it('чужому человеку бот ничего не отвечает', async () => {
        previewContactIntake.mockResolvedValue({ kind: 'not_a_psychologist' });
        await handleMaxUpdate(contactUpdate());
        // Ни одного исходящего сообщения: человек мог ошибиться адресатом.
        const sends = fetchMock.mock.calls.filter(([url]) => String(url).includes('/messages'));
        expect(sends).toHaveLength(0);
    });

    it('специалисту показывается разбор с кнопками', async () => {
        previewContactIntake.mockResolvedValue({
            kind: 'new',
            contact: { name: 'Анна Волкова', phone: '+79161234567' },
            draftId: 'draft-1',
        });
        await handleMaxUpdate(contactUpdate());

        const send = fetchMock.mock.calls.find(([url]) => String(url).includes('/messages'));
        expect(send).toBeDefined();
        const body = JSON.parse(send![1].body);
        expect(body.text).toContain('Анна Волкова');
        const buttons = body.attachments[0].payload.buttons.flat();
        expect(buttons.map((b: { payload: string }) => b.payload)).toContain('intake_ok_draft-1');
    });

    it('кнопка «Завести» заводит клиента, и только по нажатию', async () => {
        userFindFirst.mockResolvedValue({ id: 'psy-1' });
        commitContactIntake.mockResolvedValue({ kind: 'created', clientName: 'Анна Волкова' });

        await handleMaxUpdate({
            update_id: 2,
            update_type: 'message_callback',
            timestamp: Date.now(),
            callback: {
                callback_id: 'cb1',
                user: { user_id: 777002 },
                message: { body: { mid: 'm1' } },
                payload: 'intake_ok_draft-1',
            },
        });

        expect(commitContactIntake).toHaveBeenCalledWith({
            draftId: 'draft-1',
            psychologistId: 'psy-1',
            action: 'create',
        });
    });

    it('кнопка «Отмена» ничего не заводит', async () => {
        userFindFirst.mockResolvedValue({ id: 'psy-1' });
        commitContactIntake.mockResolvedValue({ kind: 'cancelled' });

        await handleMaxUpdate({
            update_id: 3,
            update_type: 'message_callback',
            timestamp: Date.now(),
            callback: {
                callback_id: 'cb2',
                user: { user_id: 777002 },
                message: { body: { mid: 'm1' } },
                payload: 'intake_no_draft-1',
            },
        });

        expect(commitContactIntake).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'cancel' })
        );
    });

    it('обычный текст по-прежнему идёт своим путём', async () => {
        await handleMaxUpdate({
            update_id: 4,
            update_type: 'message_created',
            timestamp: Date.now(),
            message: { sender: { user_id: 777002 }, recipient: { chat_id: 'c1' }, body: { mid: 'm2', text: '/help' } },
        });
        expect(previewContactIntake).not.toHaveBeenCalled();
    });
});
