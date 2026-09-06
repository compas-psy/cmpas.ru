// Task 15 (PRAKTIKA MVP) — Unified onboarding/client message builder.
//
// Раньше текст онбординга клиента собирался ДВАЖДЫ и по-разному: в веб-экшене
// sendClientOnboarding и в мобильном роуте POST /api/mobile/clients/[id]/onboarding.
// Формулировки расходились, мобильная ветка «без сессии» вообще не умела rich-канал,
// а MAX получал разметку <a href> как видимый текст.
//
// Здесь проверяется: точный семантический вывод общего билдера (rich/plain),
// человеческие имена документов вместо имён файлов, отсутствие «На связи …»,
// и главное — паритет веб/мобайл: оба вызывают ОДИН билдер и отправляют в канал
// побайтово одинаковый текст. Подписанная персональная ссылка (Task 3) при этом
// остаётся подписанной и client-scoped.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const DOC_LINK = 'https://cmpas.ru/client/documents/del-1?t=doctoken';

const db = vi.hoisted(() => ({
    diaryClient: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    diarySession: { findFirst: vi.fn() },
    scheduledClientMessage: { create: vi.fn() },
    clientInviteToken: { create: vi.fn() },
}));
vi.mock('@/lib/db', () => ({ db }));

const telegram = vi.hoisted(() => ({ sendTelegramMessage: vi.fn() }));
vi.mock('@/lib/telegram', () => telegram);

const maxBot = vi.hoisted(() => ({ sendMaxMessage: vi.fn() }));
vi.mock('@/lib/max-bot', () => maxBot);

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'psy-1' } })) }));

vi.mock('@/lib/mobile-auth', () => ({
    authenticateMobileRequest: vi.fn(async () => ({ userId: 'psy-1' })),
    unauthorizedResponse: () => new Response('unauthorized', { status: 401 }),
}));

vi.mock('@/lib/channel-binding', () => ({
    createClientChannelInvite: vi.fn(async () => ({
        rawToken: 'raw-token',
        smartLink: 'https://cmpas.ru/connect/raw-token',
        directLink: 'https://t.me/CompasProBot?start=c_raw-token',
        shareText: 'share',
        expiresAt: new Date('2026-10-01T00:00:00Z'),
        clientName: 'Мария Соколова',
        phone: null,
    })),
    getClientChannelStatus: vi.fn(),
}));

// Частичный мок: подписанные ссылки (clientBookingLink) и buildSessionClientMessage
// остаются НАСТОЯЩИМИ — проверяем реальную безопасность и реальный текст. Замещены
// только обращения к БД.
vi.mock('@/lib/client-workflow', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/client-workflow')>();
    return {
        ...actual,
        createClientDocumentDelivery: vi.fn(async () => ({
            deliveryId: 'del-1',
            documentId: 'doc-1',
            title: 'agreement_client_v2_final.pdf',
            version: 1,
            link: DOC_LINK,
        })),
        getPaymentInstruction: vi.fn(async () => null),
    };
});

const { buildClientOnboardingMessage, humanizeDocumentTitle } = await import('@/lib/practice/communications');
const { clientBookingLink } = await import('@/lib/client-workflow');

// Подписанная персональная ссылка несёт метку времени выпуска, поэтому два
// вызова в разные миллисекунды дают разные строки. Для проверок текста здесь
// стоит фиксированная ссылка того же вида; настоящая подпись проверяется
// отдельным тестом и под замороженными часами в блоке паритета.
const BOOKING_LINK = 'https://cmpas.ru/bot/book/psy-1?c=st1_signed-token';

function setClient(opts: { telegramChatId?: string | null; maxChatId?: string | null }) {
    db.diaryClient.findFirst.mockResolvedValue({
        id: 'client-1',
        psychologistId: 'psy-1',
        name: 'Мария Соколова',
        phone: '+79990000000',
        email: null,
        telegramChatId: opts.telegramChatId ?? null,
        maxChatId: opts.maxChatId ?? null,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-04T12:00:00Z'));
    db.user.findUnique.mockResolvedValue({
        id: 'psy-1',
        name: 'Анна',
        telegramChatId: null,
        psychologistSettings: { fullName: 'Анна Волкова', onlineSessionLink: null },
    });
    db.diarySession.findFirst.mockResolvedValue(null);
    db.scheduledClientMessage.create.mockResolvedValue({});
    db.clientInviteToken.create.mockResolvedValue({});
    setClient({ telegramChatId: 'tg-1', maxChatId: 'max-1' });
});

afterEach(() => {
    vi.useRealTimers();
});

describe('buildClientOnboardingMessage — точный семантический вывод', () => {
    const base = {
        clientName: 'Мария Соколова',
        psychologistName: 'Анна Волкова',
        documentLinks: [{ title: 'agreement_client_v2_final.pdf', link: DOC_LINK }],
        bookingLink: BOOKING_LINK,
    };

    it('rich-канал: название документа и «здесь» — кликабельные ссылки, без «Название — https://…»', () => {
        expect(buildClientOnboardingMessage({ ...base, mode: 'html' })).toBe([
            'Мария, здравствуйте!',
            '',
            'Специалист: Анна Волкова.',
            '',
            'Записываясь на консультацию, вы соглашаетесь с условиями договора:',
            `<a href="${DOC_LINK}">agreement client v2 final</a>`,
            '',
            `Управлять записями можно <a href="${BOOKING_LINK}">здесь</a>.`,
        ].join('\n'));
    });

    it('plain-share: один понятный ярлык и один адрес на строку, без разметки', () => {
        const text = buildClientOnboardingMessage({ ...base, mode: 'plain' });

        expect(text).toBe([
            'Мария, здравствуйте!',
            '',
            'Специалист: Анна Волкова.',
            '',
            'Записываясь на консультацию, вы соглашаетесь с условиями договора:',
            `agreement client v2 final: ${DOC_LINK}`,
            '',
            `Управлять записями можно здесь: ${BOOKING_LINK}`,
        ].join('\n'));
        expect(text).not.toContain('<a href');
    });

    it('без документов — приветствие/контекст и ссылка управления записями', () => {
        expect(buildClientOnboardingMessage({ ...base, documentLinks: [], mode: 'html' })).toBe([
            'Мария, здравствуйте!',
            '',
            'Специалист: Анна Волкова.',
            '',
            `Управлять записями можно <a href="${BOOKING_LINK}">здесь</a>.`,
        ].join('\n'));
    });

    it('фразы «На связи …» больше нет ни в одном режиме', () => {
        for (const mode of ['html', 'plain'] as const) {
            expect(buildClientOnboardingMessage({ ...base, mode })).not.toContain('На связи');
        }
    });

    it('имя файла клиенту не показывается ни в одном режиме', () => {
        for (const mode of ['html', 'plain'] as const) {
            const text = buildClientOnboardingMessage({ ...base, mode });
            // Сам адрес ссылки — не то, что читает человек: в подписанном
            // токене подчёркивание законно. Проверяем видимый текст.
            const visible = text
                .replace(/<a href="[^"]*">/g, '')
                .replace(/<\/a>/g, '')
                .replace(/https?:\/\/\S+/g, '');
            expect(visible).not.toContain('agreement_client_v2_final.pdf');
            expect(visible).not.toContain('.pdf');
            expect(visible).not.toContain('_');
        }
    });

    it('текст клиента экранируется в rich-режиме и не экранируется в plain', () => {
        const params = { ...base, psychologistName: 'Анна <Волкова> & Ко', documentLinks: [] };
        expect(buildClientOnboardingMessage({ ...params, mode: 'html' }))
            .toContain('Специалист: Анна &lt;Волкова&gt; &amp; Ко.');
        expect(buildClientOnboardingMessage({ ...params, mode: 'plain' }))
            .toContain('Специалист: Анна <Волкова> & Ко.');
    });

    it('персональная ссылка остаётся подписанной и не содержит сырого clientId (Task 3)', () => {
        const text = buildClientOnboardingMessage({
            ...base,
            bookingLink: clientBookingLink('psy-1', 'client-1'),
            mode: 'plain',
        });
        expect(text).toContain('?c=st1_');
        expect(text).not.toContain('client-1?');
        expect(text).not.toContain('c=client-1');
    });
});

describe('humanizeDocumentTitle', () => {
    it('снимает расширение и подчёркивания', () => {
        expect(humanizeDocumentTitle('agreement_client_v2_final.pdf')).toBe('agreement client v2 final');
        expect(humanizeDocumentTitle('privacy_policy_2026.pdf')).toBe('privacy policy 2026');
    });

    it('человеческое название оставляет как есть', () => {
        expect(humanizeDocumentTitle('Договор оферты')).toBe('Договор оферты');
        expect(humanizeDocumentTitle('Согласие на обработку данных')).toBe('Согласие на обработку данных');
    });

    it('название, состоящее только из расширения, не превращается в пустую строку', () => {
        expect(humanizeDocumentTitle('.pdf')).toBe('.pdf');
    });
});

async function runWeb(channel: 'telegram' | 'max', documentId: string | null, sendNotification = false) {
    const { sendClientOnboarding } = await import('@/app/diary/actions/client-onboarding');
    return sendClientOnboarding('client-1', { channel, sendNotification, documentId });
}

async function runMobile(channel: 'telegram' | 'max', documentId: string | null, sendNotification = false) {
    const { POST } = await import('@/app/api/mobile/clients/[id]/onboarding/route');
    const req = new Request('https://cmpas.ru/api/mobile/clients/client-1/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel, sendNotification, documentId }),
    });
    return POST(req as never, { params: Promise.resolve({ id: 'client-1' }) });
}

function sentTo(channel: 'telegram' | 'max'): string {
    const spy = channel === 'telegram' ? telegram.sendTelegramMessage : maxBot.sendMaxMessage;
    expect(spy).toHaveBeenCalledTimes(1);
    return spy.mock.calls[0][1] as string;
}

describe('паритет веб/мобайл — один билдер, один текст', () => {
    for (const channel of ['telegram', 'max'] as const) {
        it(`без предстоящей сессии: ${channel} получает от веба и мобайла один и тот же текст`, async () => {
            await runWeb(channel, 'doc-1');
            const web = sentTo(channel);

            vi.clearAllMocks();
            await runMobile(channel, 'doc-1');
            const mobile = sentTo(channel);

            expect(mobile).toBe(web);
            expect(web).toBe(buildClientOnboardingMessage({
                clientName: 'Мария Соколова',
                psychologistName: 'Анна Волкова',
                documentLinks: [{ title: 'agreement_client_v2_final.pdf', link: DOC_LINK }],
                bookingLink: clientBookingLink('psy-1', 'client-1'),
                mode: channel === 'telegram' ? 'html' : 'plain',
            }));
        });

        it(`с предстоящей сессией: ${channel} получает от веба и мобайла один и тот же текст`, async () => {
            db.diarySession.findFirst.mockResolvedValue({
                id: 'session-1',
                date: new Date('2026-09-15T00:00:00Z'),
                time: '19:00',
                format: 'online',
            });

            await runWeb(channel, 'doc-1', true);
            const web = sentTo(channel);

            vi.clearAllMocks();
            db.diarySession.findFirst.mockResolvedValue({
                id: 'session-1',
                date: new Date('2026-09-15T00:00:00Z'),
                time: '19:00',
                format: 'online',
            });
            await runMobile(channel, 'doc-1', true);

            expect(sentTo(channel)).toBe(web);
        });
    }

    it('MAX никогда не получает HTML-разметку как видимый текст', async () => {
        db.diarySession.findFirst.mockResolvedValue({
            id: 'session-1',
            date: new Date('2026-09-15T00:00:00Z'),
            time: '19:00',
            format: 'online',
        });

        await runMobile('max', 'doc-1', true);
        expect(sentTo('max')).not.toContain('<a href');

        vi.clearAllMocks();
        db.diarySession.findFirst.mockResolvedValue(null);
        await runMobile('max', 'doc-1');
        expect(sentTo('max')).not.toContain('<a href');
    });

    it('канал не подключён: в очередь кладётся текст того же канала — и у веба, и у мобайла', async () => {
        setClient({ telegramChatId: null, maxChatId: null });

        await runWeb('max', 'doc-1');
        const webQueued = db.scheduledClientMessage.create.mock.calls[0][0].data.text as string;

        vi.clearAllMocks();
        setClient({ telegramChatId: null, maxChatId: null });
        await runMobile('max', 'doc-1');
        const mobileQueued = db.scheduledClientMessage.create.mock.calls[0][0].data.text as string;

        expect(mobileQueued).toBe(webQueued);
        expect(webQueued).not.toContain('<a href');
        expect(telegram.sendTelegramMessage).not.toHaveBeenCalled();
        expect(maxBot.sendMaxMessage).not.toHaveBeenCalled();
    });

    it('канал не подключён: специалисту в обоих клиентах отдаётся один и тот же готовый текст для ручной отправки', async () => {
        setClient({ telegramChatId: null, maxChatId: null });

        const web = await runWeb('max', 'doc-1');

        vi.clearAllMocks();
        setClient({ telegramChatId: null, maxChatId: null });
        const mobile = await runMobile('max', 'doc-1');
        const mobileBody = await (mobile as Response).json();

        expect(web.status).toBe('pending');
        expect(mobileBody.status).toBe('pending');
        expect(mobileBody.readyText).toBe((web as { readyText: string }).readyText);
        expect(mobileBody.readyText).not.toContain('<a href');
    });
});
