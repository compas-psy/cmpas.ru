import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * НАПОМИНАНИЕ ОБ ОПЛАТЕ ПЕРЕД ВСТРЕЧЕЙ.
 *
 * Решение учредителя 11.09.2026: «отправлять перед первой или последующими
 * сессиями ссылку на оплату нужно. Интервал за сколько до сессии отправлять
 * выбирает психолог». И рамка, в которой это живёт: «у нас нет связи с их
 * банками… мы не сможем самостоятельно проставить статус оплаты — только сам
 * психолог».
 *
 * Отсюда проверяемое: одно напоминание на встречу, по выбранному интервалу,
 * не ночью, не после отметки об оплате и ничего не обещающее от имени
 * сервиса.
 */

const SBP = 'https://qr.nspk.ru/AD10006L5QFVJJQO8P2C9T7A3RDAQF11?type=01&bank=100000000111';

type Row = Record<string, unknown>;

let settingsRows: Row[] = [];
let sessions: Row[] = [];
let paymentRequests: Array<{ sessionId: string; kind: string; markedPaidAt: Date | null }> = [];
const inserted: string[] = [];

vi.mock('@/lib/db', () => ({
    db: {
        $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
            const sql = strings.join('?');
            if (sql.includes('PsychologistPaymentSettings')) return settingsRows;
            if (sql.includes('SessionPaymentRequest')) {
                const sessionId = values[0] as string;
                const count = paymentRequests.filter(r =>
                    r.sessionId === sessionId && (r.kind === 'reminder' || r.markedPaidAt !== null),
                ).length;
                return [{ count }];
            }
            return [];
        }),
        $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
            const sql = strings.join('?');
            if (sql.includes('INSERT INTO "SessionPaymentRequest"')) {
                inserted.push(sql);
                paymentRequests.push({ sessionId: values[1] as string, kind: 'reminder', markedPaidAt: null });
            }
            return 1;
        }),
        diarySession: {
            findMany: vi.fn(async ({ where }: { where: Row }) => sessions.filter(s => {
                const date = s.date as Date;
                const range = where.date as { gt: Date; lte: Date };
                return s.psychologistId === where.psychologistId && date > range.gt && date <= range.lte;
            })),
        },
    },
}));

const sentTexts: string[] = [];
const sentPhotos: Array<{ caption?: string }> = [];
vi.mock('@/lib/messaging/deliver', () => ({
    deliverMessage: vi.fn(async (_bearer: unknown, text: string) => {
        sentTexts.push(text);
        return { channel: 'telegram', sent: true };
    }),
    deliverPhoto: vi.fn(async (_bearer: unknown, _photo: Buffer, caption?: string) => {
        sentPhotos.push({ caption });
        return { channel: 'telegram', sent: true };
    }),
}));

vi.mock('@/lib/analytics/track', () => ({ track: vi.fn(async () => {}) }));

import { processPaymentReminders, buildPaymentReminderText } from '@/lib/cron/payment-reminders';
import { clampReminderHours, DEFAULT_REMINDER_HOURS, REMINDER_HOUR_OPTIONS } from '@/lib/messaging/payment-reminder-interval';
import { paymentInstructionText } from '@/lib/client-workflow';

const SESSION_AT = new Date('2026-09-15T11:00:00Z');

function setup(overrides: { hours?: number; timezone?: string } = {}) {
    settingsRows = [{
        psychologistId: 'psy-1',
        paymentText: 'Оплата по СБП',
        paymentLink: SBP,
        paymentQrUrl: null,
        prepaymentRequired: true,
        paymentDueText: 'до 24:00 накануне',
        paymentReminderHoursBefore: overrides.hours ?? 24,
        timezone: overrides.timezone ?? 'Europe/Moscow',
    }];
    sessions = [{
        id: 'ses-1',
        psychologistId: 'psy-1',
        date: SESSION_AT,
        time: '14:00',
        status: 'confirmed',
        client: { id: 'cl-1', name: 'Иван', telegramChatId: '111', maxChatId: null, preferredChannel: 'telegram' },
    }];
    paymentRequests = [];
    sentTexts.length = 0;
    sentPhotos.length = 0;
    inserted.length = 0;
}

beforeEach(() => setup());
afterEach(() => vi.useRealTimers());

describe('интервал выбирает специалист', () => {
    it('за сутки — за сутки, за два часа — за два часа', async () => {
        // Сутки до встречи ещё не наступили: тишина.
        await processPaymentReminders(new Date('2026-09-13T12:00:00Z'));
        expect(sentTexts).toHaveLength(0);

        await processPaymentReminders(new Date('2026-09-14T12:00:00Z'));
        expect(sentTexts).toHaveLength(1);

        setup({ hours: 2 });
        await processPaymentReminders(new Date('2026-09-15T06:00:00Z'));
        expect(sentTexts, 'за 5 часов до встречи при интервале 2 часа слать рано').toHaveLength(0);
        await processPaymentReminders(new Date('2026-09-15T10:00:00Z'));
        expect(sentTexts).toHaveLength(1);
    });

    it('негодное значение не превращается в рассылку в момент начала встречи', () => {
        expect(clampReminderHours(0)).toBe(1);
        expect(clampReminderHours(-5)).toBe(1);
        expect(clampReminderHours(10_000)).toBe(168);
        expect(clampReminderHours(null)).toBe(DEFAULT_REMINDER_HOURS);
        expect(clampReminderHours(Number.NaN)).toBe(DEFAULT_REMINDER_HOURS);
        // Каждый вариант формы обязан пережить приведение неизменным, иначе
        // выбранное в списке сохранится не тем, что выбрали.
        for (const option of REMINDER_HOUR_OPTIONS) {
            expect(clampReminderHours(option.hours)).toBe(option.hours);
        }
    });

    it('после начала встречи напоминание об оплате уже не уходит', async () => {
        await processPaymentReminders(new Date('2026-09-15T11:30:00Z'));
        expect(sentTexts).toHaveLength(0);
    });
});

describe('одно напоминание на встречу', () => {
    it('второй проход того же дня ничего не шлёт', async () => {
        await processPaymentReminders(new Date('2026-09-14T12:00:00Z'));
        await processPaymentReminders(new Date('2026-09-14T12:15:00Z'));
        expect(sentTexts).toHaveLength(1);
        expect(inserted).toHaveLength(1);
    });

    it('встреча, отмеченная оплаченной, напоминания не получает', async () => {
        // Статус ведёт специалист: связи с банком у сервиса нет.
        paymentRequests.push({ sessionId: 'ses-1', kind: 'manual', markedPaidAt: new Date('2026-09-13T09:00:00Z') });
        await processPaymentReminders(new Date('2026-09-14T12:00:00Z'));
        expect(sentTexts).toHaveLength(0);
    });

    it('неудачная отправка повторится, а не сойдёт за отправленную', async () => {
        const { deliverMessage } = await import('@/lib/messaging/deliver');
        vi.mocked(deliverMessage).mockResolvedValueOnce({ channel: 'telegram', sent: false });
        await processPaymentReminders(new Date('2026-09-14T12:00:00Z'));
        expect(inserted, 'провал отправки не должен записываться как напоминание').toHaveLength(0);

        await processPaymentReminders(new Date('2026-09-14T12:15:00Z'));
        expect(sentTexts).toHaveLength(1);
    });
});

describe('ночью не приходит', () => {
    it('тихий час по поясу практики откладывает напоминание до утра', async () => {
        // 23:00 в Москве — тишина; 12:00 того же дня — уже нет.
        await processPaymentReminders(new Date('2026-09-14T20:00:00Z'));
        expect(sentTexts).toHaveLength(0);

        await processPaymentReminders(new Date('2026-09-14T12:00:00Z'));
        expect(sentTexts).toHaveLength(1);
    });

    it('пояс считается по практике, а не по серверу', async () => {
        // 09:00 UTC — это 19:00 во Владивостоке и ещё не тишина; 13:00 UTC
        // там уже 23:00.
        setup({ timezone: 'Asia/Vladivostok' });
        await processPaymentReminders(new Date('2026-09-14T13:00:00Z'));
        expect(sentTexts).toHaveLength(0);
    });
});

describe('что именно получает клиент', () => {
    it('встреча названа, инструкция та же, что при записи, и код следом', async () => {
        await processPaymentReminders(new Date('2026-09-14T12:00:00Z'));
        const text = sentTexts[0];
        expect(text).toContain('Иван');
        expect(text).toContain('15 сентября');
        expect(text).toContain('14:00');
        // Ровно тот же текст инструкции, что уходит при заведении клиента:
        // два разных текста об одной оплате выглядят как ошибка.
        expect(text).toContain(paymentInstructionText(settingsRows[0] as never));
        expect(sentPhotos, 'код оплаты рисуется из ссылки и уходит следом').toHaveLength(1);
    });

    it('сервис ничего не обещает от своего имени', async () => {
        await processPaymentReminders(new Date('2026-09-14T12:00:00Z'));
        expect(sentTexts[0]).toContain('ПРАКТИКА не принимает оплату и не подтверждает её поступление');
    });

    it('готовая картинка от банка не дублируется нарисованной', async () => {
        settingsRows[0].paymentQrUrl = 'https://bank.example/qr.png';
        await processPaymentReminders(new Date('2026-09-14T12:00:00Z'));
        expect(sentTexts).toHaveLength(1);
        expect(sentPhotos).toHaveLength(0);
    });

    it('текст собирается без часового пояса, если он не назван', () => {
        const text = buildPaymentReminderText({
            clientName: 'Иван', date: SESSION_AT, time: '14:00', instruction: 'инструкция',
        });
        expect(text).not.toContain('(');
    });
});

describe('куда уходит код оплаты', () => {
    const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf-8');

    it('оба пути заведения клиента шлют код в тот же мессенджер, что и текст', () => {
        // Раньше здесь стояло `if (channel === 'telegram')`, и клиенты в MAX
        // оставались вовсе без кода.
        for (const path of [
            'src/app/diary/actions/client-onboarding.ts',
            'src/app/api/mobile/clients/[id]/onboarding/route.ts',
        ]) {
            const source = read(path);
            expect(source, `${path} не шлёт код общей дверью`).toContain('deliverPhoto');
            expect(source, `${path} всё ещё шлёт код только в Telegram`).not.toContain('sendTelegramPhoto');
        }
    });

    it('в MAX картинка уходит по его правилам: загрузка, поле data, вложение', () => {
        const max = read('src/lib/max-bot.ts');
        expect(max).toContain("maxApi('/uploads', {}, { type: 'image' })");
        expect(max).toContain("form.append('data'");
        expect(max).toContain("type: 'image', payload");
    });
});
