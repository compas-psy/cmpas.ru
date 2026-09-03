// O-260829 §5.2: тихое уведомление листа ожидания при освобождении часа.
// Основатель решил (17.08.2026), что ПРАКТИКА не принимает и не держит деньги
// клиентов — поэтому это просто уведомление о свободном времени, без
// "осталось N мест", без списка ожидания на публичном экране, без денег.
//
// WaitlistEntry раньше только сохранял заявку — никто её не читал при
// отмене/переносе. Эта функция закрывает разрыв: одно сообщение самой
// старой подходящей заявке, без гонки и без давления на клиента.

import { db } from '@/lib/db';
import { matchesPreference, type SuggestedTimeCandidate, type TimePreference } from '@/lib/booking/suggested-times';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max';
import { publicBaseUrl } from '@/lib/client-workflow';

function normalizeDigits(value: string): string {
    return value.replace(/\D/g, '');
}

/**
 * Контакт в WaitlistEntry — сырая строка ("Телефон или Telegram"), введённая
 * человеком вручную, а не привязка к конкретному DiaryClient/TelegramClient.
 * В КОМПАСе нет SMS-шлюза, а Telegram Bot API не умеет писать первым по
 * никнейму (нужен chat id, известный только из предыдущего диалога с ботом) —
 * поэтому реальная доставка возможна только тем, кто уже известен этому
 * специалисту по телефону или Telegram-нику. Незнакомый контакт технически
 * недостижим существующими каналами — это не баг этой функции, а честная
 * граница возможностей доставки.
 */
async function resolveContactChannel(
    psychologistId: string,
    contact: string
): Promise<{ telegramChatId: string | null; maxChatId: string | null } | null> {
    const trimmed = contact.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('@')) {
        const username = trimmed.slice(1).toLowerCase();
        if (!username) return null;
        const client = await db.telegramClient.findFirst({
            where: { psychologistId, telegramUsername: { equals: username, mode: 'insensitive' } },
        });
        if (!client) return null;
        return { telegramChatId: client.telegramUserId, maxChatId: null };
    }

    const digits = normalizeDigits(trimmed);
    if (digits.length < 10) return null;
    const suffix = digits.slice(-10);

    const clients = await db.diaryClient.findMany({
        where: { psychologistId, phone: { not: null } },
        select: { phone: true, telegramChatId: true, maxChatId: true },
    });
    const match = clients.find((c) => c.phone && normalizeDigits(c.phone).slice(-10) === suffix);
    if (!match) return null;
    return { telegramChatId: match.telegramChatId, maxChatId: match.maxChatId };
}

function toDateStr(d: Date): string {
    return d.toISOString().slice(0, 10);
}

async function psychologistDisplayName(psychologistId: string): Promise<string> {
    const psy = await db.user.findUnique({
        where: { id: psychologistId },
        select: { name: true, psychologistSettings: { select: { fullName: true } } },
    });
    return psy?.psychologistSettings?.fullName || psy?.name || 'специалист';
}

/**
 * Освободился час — молча предлагаем его самой старой подходящей заявке
 * листа ожидания. Одно сообщение одному человеку; остальные заявки не
 * трогаем (v2 §2.3: "без гонки и давления"). Ссылка ведёт на обычную
 * страницу записи специалиста — конкретное время названо в тексте, а не
 * подставлено в ссылку автоматически: отдельного механизма
 * предзаполненного времени в форме записи сегодня нет, и вводить его ради
 * одной этой функции — больше риска (общий компонент записи меняется
 * параллельно в этом же заходе), чем пользы.
 */
export async function notifyWaitlistOnFreedSlot(
    psychologistId: string,
    freedDate: Date,
    freedTime: string
): Promise<{ notified: boolean; entryId?: string }> {
    // PRAKTIKA MVP addendum §7: утверждённый launch-дизайн не обещает клиенту
    // автоматическое уведомление — заявка листа ожидания только сохраняется.
    // Механику не удаляем (может понадобиться после отдельного решения
    // владельца), но по умолчанию она выключена.
    if (process.env.PRACTICE_WAITLIST_AUTO_NOTIFY_ENABLED !== 'true') {
        return { notified: false };
    }

    const entries = await db.waitlistEntry.findMany({
        where: { psychologistId, notifiedAt: null },
        orderBy: { createdAt: 'asc' },
    });
    if (entries.length === 0) return { notified: false };

    const candidate: SuggestedTimeCandidate = { date: toDateStr(freedDate), time: freedTime, format: 'online', addressId: null };
    const matching = entries.filter((e) => matchesPreference(candidate, (e.preference as TimePreference) || 'any'));
    if (matching.length === 0) return { notified: false };

    const psychologistName = await psychologistDisplayName(psychologistId);
    const dateLabel = freedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const bookingLink = `${publicBaseUrl()}/bot/book/${psychologistId}`;
    const text = `Здравствуйте! У ${psychologistName} освободилось время: ${dateLabel} в ${freedTime}. Записаться: ${bookingLink}`;

    for (const entry of matching) {
        const channel = await resolveContactChannel(psychologistId, entry.contact);

        // Отмечаем обработанной независимо от исхода — недостижимый контакт
        // не должен блокировать очередь навсегда (следующий проход отмены/
        // переноса просто перейдёт к следующей заявке), а повторно слать
        // тому же человеку по тому же освободившемуся часу тоже незачем.
        await db.waitlistEntry.update({
            where: { id: entry.id },
            data: { notifiedAt: new Date() },
        });

        if (!channel || (!channel.telegramChatId && !channel.maxChatId)) {
            continue;
        }

        if (channel.telegramChatId) {
            await sendTelegramMessage(channel.telegramChatId, text);
        } else if (channel.maxChatId) {
            await sendMaxMessage(channel.maxChatId, text);
        }
        return { notified: true, entryId: entry.id };
    }

    return { notified: false };
}
