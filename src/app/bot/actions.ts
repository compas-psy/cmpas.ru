'use server';

import { db } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';
import { addDays } from 'date-fns';
import { createHash } from 'crypto';
import { createNotification } from '@/lib/notifications';
import { resolvePersonalClientToken, resolveSignedPersonalClientToken, personalClientToken } from '@/lib/client-workflow';
import { verifyTelegramWebAppInitData } from '@/lib/telegram-webapp';
import { resolveAvailableTimesForDay } from '@/lib/practice/booking/availability';
import { slotToken } from '@/lib/practice/booking/slot-token';
import { createSelfPracticeBooking, BookingConflictError } from '@/lib/practice/booking/booking';
import { fetchExternalBusyBlocks } from '@/lib/practice/booking/external-busy';
import { pickSuggestedTimes, TimePreference, SuggestedTimeCandidate } from '@/lib/booking/suggested-times';

/** Decodes the `?c=` booking-link param: signed token (current) or a legacy
 * raw clientId (accepted for a grace window — see resolvePersonalClientToken).
 * Non-sensitive UX use only (e.g. "is there a link worth trying at all") —
 * never use this to gate a read that discloses client/session/document data. */
export async function resolveClientLinkParam(token: string | null | undefined) {
    return resolvePersonalClientToken(token);
}

/** Strict variant for any client-facing flow that will look up a client's
 * own PII/sessions by the resolved id (Task 3, addendum §6): never falls
 * back to the legacy unsigned-raw-clientId path. */
export async function resolveSignedClientLinkParam(token: string | null | undefined) {
    return resolveSignedPersonalClientToken(token);
}

/**
 * Task 3 (PRAKTIKA MVP addendum §6): verifies Telegram Mini App initData and
 * returns the authenticated Telegram user id, or null.
 *
 * window.Telegram.WebApp.initDataUnsafe.user is client-controlled — a caller
 * can set it to any id before this page's own script reads it. Every call
 * site that resolves a client by Telegram id (getClientByTelegram,
 * getClientUpcomingSessions, checkConsentRequired) must be given ONLY an id
 * that passed through this verification, never initDataUnsafe.user.id
 * directly — otherwise a booking page visitor could read another client's
 * upcoming sessions/name/phone by supplying that client's Telegram id.
 */
export async function resolveVerifiedTelegramUserId(initData: string | null | undefined): Promise<string | null> {
    const user = verifyTelegramWebAppInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
    return user ? String(user.id) : null;
}

/** Send to Telegram and/or MAX depending on which IDs are set. Runs both in
 * parallel so a slow/failed Telegram send (e.g. flaky VPN) never delays or
 * blocks the MAX send, and vice versa. */
async function notifyUser(
    tgId: string | null | undefined,
    maxId: string | null | undefined,
    text: string
) {
    await Promise.allSettled([
        tgId ? sendTelegramMessage(tgId, text, { parse_mode: 'HTML' }).catch(e => console.error('[notify] Telegram error:', e)) : null,
        maxId ? sendMaxMessage(maxId, text).catch(e => console.error('[notify] MAX error:', e)) : null,
    ]);
}

export async function getPsychologist(id: string) {
    const user = await db.user.findUnique({
        where: { id },
        select: {
            name: true,
            image: true,
            psychologistSettings: {
                select: { fullName: true, scheduleMode: true, timeSuggestEnabled: true }
            }
        }
    });

    if (!user) return null;

    return {
        ...user,
        name: user.psychologistSettings?.fullName || user.name || 'Специалист',
        scheduleMode: user.psychologistSettings?.scheduleMode || 'private',
        timeSuggestEnabled: user.psychologistSettings?.timeSuggestEnabled ?? false
    };
}

export async function getScheduleMode(psychologistId: string): Promise<string> {
    const settings = await db.psychologistSettings.findUnique({
        where: { psychologistId },
        select: { scheduleMode: true }
    });
    return settings?.scheduleMode || 'private';
}

// Helper: convert any Date to 'yyyy-MM-dd' string in UTC to avoid timezone issues
function toDateStr(d: Date): string {
    return d.toISOString().slice(0, 10);
}

export async function getAvailableDates(psychologistId: string, year: number, month: number, skipModeCheck = false, clientId: string | null = null, skipBuffer = false) {
    // Check schedule mode — if private, return empty (only for client-facing calls)
    if (!skipModeCheck) {
        const mode = await getScheduleMode(psychologistId);
        if (mode === 'private') return [];
    }

    // Use UTC dates for DB queries to match how dates are stored
    const startDate = new Date(Date.UTC(year, month, 1));
    const endDate = new Date(Date.UTC(year, month + 1, 0));
    const todayStr = toDateStr(new Date());

    const slots = await db.availabilitySlot.findMany({ where: { psychologistId, isActive: true }, include: { scheduleRule: true } });
    if (!slots.length) return [];

    // Fetch settings for session break, limits, and external calendar blocking
    const settings = await db.psychologistSettings.findUnique({ where: { psychologistId } });
    const sessionBreak = settings?.sessionBreak ?? 15;
    const maxSessionsPerDay = settings?.maxSessionsPerDay ?? null;

    const blockConflicts = settings?.blockConflicts ?? true;

    const [blocks, externalBlocks] = await Promise.all([
        db.diaryBlock.findMany({
            where: {
                psychologistId,
                date: { lte: endDate, gte: startDate }
            }
        }),
        fetchExternalBusyBlocks(psychologistId, startDate, endDate, { timezone: settings?.timezone, blockConflicts }),
    ]);

    const allBlocks = [...blocks, ...externalBlocks];

    const sessions = await db.diarySession.findMany({
        where: {
            psychologistId,
            date: { gte: startDate, lte: endDate },
            status: { not: 'cancelled' }
        },
        select: { date: true, time: true, duration: true, clientId: true }
    });

    const availableDates: string[] = [];

    for (let d = new Date(startDate); d <= endDate; d = addDays(d, 1)) {
        const dateStr = toDateStr(d);
        if (dateStr < todayStr) continue;

        const availableTimes = resolveAvailableTimesForDay({ dateStr, slots, blocks: allBlocks, sessions, settings, clientId, skipBuffer });
        if (availableTimes.length > 0) {
            availableDates.push(dateStr);
        }
    }

    return availableDates;
}

export async function getAvailableTimes(psychologistId: string, dateStr: string, skipModeCheck = false, excludeSessionId?: string, clientId: string | null = null, skipBuffer = false) {
    // Check schedule mode — if private, return empty (only for client-facing calls)
    if (!skipModeCheck) {
        const mode = await getScheduleMode(psychologistId);
        if (mode === 'private') return [];
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    // Use UTC date for DB queries — this matches how bookSession creates dates
    const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

    const slots = await db.availabilitySlot.findMany({ where: { psychologistId, isActive: true }, include: { scheduleRule: true } });

    // Fetch settings for session break, limits, and external calendar blocking
    const settings = await db.psychologistSettings.findUnique({ where: { psychologistId } });
    const sessionBreak = settings?.sessionBreak ?? 15;
    const maxSessionsPerDay = settings?.maxSessionsPerDay ?? null;

    const blockConflicts = settings?.blockConflicts ?? true;

    const [blocks, externalBlocks] = await Promise.all([
        db.diaryBlock.findMany({
            where: {
                psychologistId,
                date: { gte: dayStart, lte: dayEnd }
            }
        }),
        fetchExternalBusyBlocks(psychologistId, dayStart, dayEnd, { timezone: settings?.timezone, blockConflicts }),
    ]);

    const allBlocks = [...blocks, ...externalBlocks];
    const sessions = await db.diarySession.findMany({
        where: {
            psychologistId,
            date: { gte: dayStart, lte: dayEnd },
            status: { not: 'cancelled' },
            ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
        },
        select: { date: true, time: true, duration: true, clientId: true }
    });

    const resolved = resolveAvailableTimesForDay({ dateStr, slots, blocks: allBlocks, sessions, settings, clientId, skipBuffer });

    // Task 7: every option carries a signed slotToken — the ONLY thing a
    // booking commit trusts for exact slot identity. Minted here, at read
    // time, from the exact same resolved option the client sees; never
    // reconstructed from date/time later.
    //
    // format:'both' is special: it means the RULE allows either format, and
    // the client picks one in a follow-up step (see BookingPageClient's
    // online/offline toggle) — there is no single concrete option to sign.
    // Two tokens are minted instead, one per concrete choice, so the token
    // always encodes exactly what will be booked, never an ambiguous format.
    return resolved.map(opt => {
        const mint = (format: string, addressId: string | null) => slotToken({
            psychologistId,
            dateStr,
            time: opt.time,
            availabilitySlotId: opt.availabilitySlotId,
            scheduleRuleId: opt.scheduleRuleId,
            format,
            addressId,
            duration: opt.duration,
        });

        if (opt.format === 'both') {
            return { ...opt, slotToken: null, slotTokenOnline: mint('online', null), slotTokenOffline: mint('offline', opt.addressId) };
        }
        return { ...opt, slotToken: mint(opt.format, opt.addressId), slotTokenOnline: null, slotTokenOffline: null };
    });
}

/**
 * Mechanic B "подбор времени" (product/practice/CJM_booking_v1.md этап 2):
 * a preference question and 2-3 matching slots instead of a bare grid.
 * Scans the current and next month via the existing per-date helpers, then
 * hands the flat candidate list to the pure pickSuggestedTimes.
 */
export async function getSuggestedTimes(
    psychologistId: string,
    preference: TimePreference,
    clientId: string | null = null
): Promise<SuggestedTimeCandidate[]> {
    const now = new Date();
    const candidates: SuggestedTimeCandidate[] = [];

    for (const monthOffset of [0, 1]) {
        const scanDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
        const dates = await getAvailableDates(psychologistId, scanDate.getFullYear(), scanDate.getMonth(), false, clientId);

        for (const dateStr of dates) {
            const times = await getAvailableTimes(psychologistId, dateStr, false, undefined, clientId);
            for (const slot of times) {
                if (slot.isOwnBooking) continue;
                // Task 7: carry exact-slot identity through — suggested-times and
                // the full calendar must share one exact-slot contract, so a
                // signed slotToken can be issued for a suggested candidate
                // without re-resolving/guessing which rule it came from later.
                // A format:'both' rule normally waits for a follow-up online/
                // offline choice in the full grid — the one-tap suggestion
                // quick-pick has no such step, so it defaults to online.
                const isBoth = slot.format === 'both';
                candidates.push({
                    date: dateStr,
                    time: slot.time,
                    format: isBoth ? 'online' : slot.format,
                    addressId: isBoth ? null : slot.addressId,
                    availabilitySlotId: slot.availabilitySlotId,
                    scheduleRuleId: slot.scheduleRuleId,
                    duration: slot.duration,
                    slotToken: (isBoth ? slot.slotTokenOnline : slot.slotToken) as string,
                });
            }
        }

        if (candidates.length >= 8) break; // enough runway to choose from
    }

    return pickSuggestedTimes(candidates, preference);
}

/**
 * Empty-schedule fallback for Mechanic B (CJM_booking_v1.md §2 этап 8):
 * capture only, no matching/notification engine — see WaitlistEntry in
 * prisma/schema.prisma.
 */
export async function submitWaitlistInterest(psychologistId: string, name: string, contact: string, preference?: string) {
    const trimmedName = name.trim().slice(0, 200);
    const trimmedContact = contact.trim().slice(0, 200);
    if (!trimmedName || !trimmedContact) {
        return { success: false, error: 'Укажите имя и контакт' };
    }

    await db.waitlistEntry.create({
        data: { psychologistId, name: trimmedName, contact: trimmedContact, preference: preference || null },
    });
    return { success: true };
}

export async function bookSession(psychologistId: string, telegramInitData: string | null, form: { name: string, phone: string, slotToken: string }) {
    // Task 7 (founder review): client find-or-create, Telegram binding, and
    // consent sync now live INSIDE createSelfPracticeBooking's own
    // transaction — together with the slot commit, under the same
    // (psychologist, day) advisory lock — so a rejected booking (stale slot,
    // day cap reached) rolls back the just-created DiaryClient too, instead
    // of leaving an orphan. telegramInitData is the raw, signed
    // window.Telegram.WebApp.initData string; createSelfPracticeBooking
    // verifies it server-side and never trusts a client-supplied user id.
    let result;
    try {
        result = await createSelfPracticeBooking({
            psychologistId,
            name: form.name,
            phone: form.phone,
            slotToken: form.slotToken,
            telegramInitData,
        });
    } catch (e) {
        if (e instanceof BookingConflictError) {
            return { success: false, error: e.message };
        }
        throw e;
    }

    const { session, client } = result;
    const dateStr = toDateStr(session.date);
    const format = session.format;

    const sessionsCount = await db.diarySession.count({ where: { clientId: client.id } });
    await db.diaryClient.update({
        where: { id: client.id },
        data: { totalSessions: sessionsCount }
    });

    const psy = await db.user.findUnique({
        where: { id: psychologistId },
        include: { psychologistSettings: true }
    }) as any;

    const onlineLink = format === 'online' ? (psy?.psychologistSettings?.onlineSessionLink || '') : '';
    const linkText = onlineLink ? `\n🔗 Ссылка для подключения: ${onlineLink}` : '';

    // Notify psychologist (Telegram + MAX)
    await notifyUser(
        psy?.telegramChatId,
        (psy as any)?.maxChatId,
        `🔥 <b>Новая запись!</b>\n\nКлиент: ${form.name} (${form.phone})\n📅 Дата: ${dateStr}\n⏰ Время: ${session.time}\n📍 Формат: ${format === 'offline' ? 'Очно (в кабинете)' : 'Онлайн'}`
    );
    await createNotification({
        psychologistId,
        type: 'new_booking',
        title: 'Новая самозапись',
        subtitle: `${form.name} · ${dateStr} в ${session.time}`,
        sessionId: session.id,
        clientId: client.id,
    });

    // Notify client (Telegram + MAX)
    const clientMsg = `✅ <b>Вы успешно записаны!</b>\n\nСпециалист: ${psy?.psychologistSettings?.fullName || psy?.name || 'Психолог'}\n📅 Дата: ${dateStr}\n⏰ Время: ${session.time}\n📍 Формат: ${format === 'offline' ? 'Очная встреча' : 'Онлайн-консультация'}${linkText}`;
    await notifyUser(
        client.telegramChatId,
        (client as any).maxChatId,
        clientMsg
    );

    // Auto-sync to calendars
    try {
        const { autoSyncSessionToCalendars } = await import('@/lib/calendar/auto-sync');
        const fullSession = await db.diarySession.findUnique({
            where: { id: session.id },
            include: { client: { select: { name: true } } },
        });
        if (fullSession) {
            autoSyncSessionToCalendars(psychologistId, fullSession).catch(console.error);
        }
    } catch (e) {
        console.error('Auto-sync after booking failed:', e);
    }

    // clientToken (not the raw id) is what the browser is allowed to keep for
    // "manage my bookings" / return-visit purposes — Task 3, addendum §6: a
    // raw clientId is never proof of identity, only a signature this server
    // issued is.
    return { success: true, sessionId: session.id, clientId: client.id, clientToken: personalClientToken(client.id) };
}

// Direct client lookup by ID (for when MiniApp opens in browser without Telegram context)
export async function getClientById(psychologistId: string, clientId: string) {
    if (!clientId || !psychologistId) return null;

    const client = await db.diaryClient.findFirst({
        where: {
            id: clientId,
            psychologistId
        },
        select: { id: true, name: true, phone: true, consentVersion: true }
    });

    return client;
}

// Get upcoming sessions by clientId (for no-TG context)
export async function getClientUpcomingSessionsById(psychologistId: string, clientId: string) {
    if (!clientId) return [];

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const sessions = await db.diarySession.findMany({
        where: {
            psychologistId,
            clientId,
            date: { gte: now },
            status: { not: 'cancelled' }
        },
        include: {
            address: { select: { name: true, address: true } }
        },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        take: 10
    });

    return sessions.map(s => ({
        id: s.id,
        date: s.date,
        time: s.time,
        endTime: s.endTime,
        status: s.status,
        format: s.format,
        addressName: s.address?.name || null,
        addressFull: s.address?.address || null,
    }));
}

export async function getClientByTelegram(psychologistId: string, telegramUserId: string, explicitClientId?: string) {
    if (!telegramUserId) return null;

    // 0. Если передан точный clientId из ссылки
    if (explicitClientId) {
        const exactClient = await db.diaryClient.findFirst({
            where: {
                id: explicitClientId,
                psychologistId
            },
            select: { id: true, name: true, phone: true, consentVersion: true }
        });

        if (exactClient) {
            // Привязываем телеграмм, если еще не привязан
            await db.diaryClient.update({
                where: { id: explicitClientId },
                data: { telegramChatId: telegramUserId }
            });
            return exactClient;
        }
    }

    // 1. Прямой поиск по DiaryClient.telegramChatId
    const client = await db.diaryClient.findFirst({
        where: {
            psychologistId,
            telegramChatId: telegramUserId,
        },
        select: { id: true, name: true, phone: true, consentVersion: true }
    });
    if (client) return client;

    // 2. Fallback: TelegramClient → DiaryClient (для inline-режима)
    const tgClient = await db.telegramClient.findUnique({
        where: { telegramUserId },
        include: {
            diaryClient: {
                select: { id: true, name: true, phone: true, consentVersion: true, psychologistId: true }
            }
        }
    });

    if (tgClient?.diaryClient && tgClient.diaryClient.psychologistId === psychologistId) {
        // Привязать telegramChatId к DiaryClient для будущих поисков
        await db.diaryClient.update({
            where: { id: tgClient.diaryClient.id },
            data: { telegramChatId: telegramUserId }
        });
        return tgClient.diaryClient;
    }

    // 3. Fallback: DiaryClient без telegramChatId, но связанный через TelegramClient
    if (tgClient?.diaryClientId) {
        const linkedClient = await db.diaryClient.findUnique({
            where: { id: tgClient.diaryClientId },
            select: { id: true, name: true, phone: true, consentVersion: true, psychologistId: true }
        });
        if (linkedClient && linkedClient.psychologistId === psychologistId) {
            await db.diaryClient.update({
                where: { id: linkedClient.id },
                data: { telegramChatId: telegramUserId }
            });
            return linkedClient;
        }
    }

    return null;
}

export async function getClientUpcomingSessions(psychologistId: string, telegramUserId: string) {
    if (!telegramUserId) return [];

    // Find client for this psychologist
    const client = await db.diaryClient.findFirst({
        where: {
            psychologistId,
            OR: [
                { telegramChatId: telegramUserId },
            ]
        }
    });

    if (!client) {
        // Try through TelegramClient
        const tgClient = await db.telegramClient.findUnique({
            where: { telegramUserId },
        });
        if (!tgClient?.diaryClientId) return [];

        const linkedClient = await db.diaryClient.findUnique({
            where: { id: tgClient.diaryClientId }
        });
        if (!linkedClient || linkedClient.psychologistId !== psychologistId) return [];

        return getSessionsForClient(linkedClient.id);
    }

    return getSessionsForClient(client.id);
}

async function getSessionsForClient(clientId: string) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const sessions = await db.diarySession.findMany({
        where: {
            clientId,
            date: { gte: now },
            status: { not: 'cancelled' }
        },
        include: {
            address: { select: { name: true, address: true } }
        },
        orderBy: [
            { date: 'asc' },
            { time: 'asc' }
        ],
        take: 10
    });

    return sessions.map(s => ({
        id: s.id,
        date: s.date,
        time: s.time,
        endTime: s.endTime,
        status: s.status,
        format: s.format,
        addressName: s.address?.name || null,
        addressFull: s.address?.address || null,
    }));
}

export async function getAddressById(addressId: string) {
    if (!addressId) return null;
    const address = await db.psychologistAddress.findUnique({
        where: { id: addressId },
        select: { name: true, address: true }
    });
    return address;
}

export async function checkConsentRequired(telegramUserId: string, psychologistId: string) {
    if (!telegramUserId) return { required: true, text: '', version: '' };

    // Get active consent version
    const activeConsent = await db.consentVersion.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
    });

    if (!activeConsent) return { required: false, text: '', version: '' };

    // Check if client already consented to this version via DiaryClient
    const diaryClient = await db.diaryClient.findFirst({
        where: {
            psychologistId,
            telegramChatId: telegramUserId,
        },
        select: { consentVersion: true }
    });

    if (diaryClient?.consentVersion === activeConsent.version) {
        return { required: false, text: activeConsent.text, version: activeConsent.version };
    }

    // Also check via TelegramClient → DiaryClient link
    const tgClient = await db.telegramClient.findUnique({
        where: { telegramUserId },
        include: {
            diaryClient: {
                select: { consentVersion: true }
            }
        }
    });
    if (tgClient?.diaryClient?.consentVersion === activeConsent.version) {
        return { required: false, text: activeConsent.text, version: activeConsent.version };
    }

    // Check consentGiven flag on TelegramClient as last resort
    if (tgClient?.consentGiven) {
        return { required: false, text: activeConsent.text, version: activeConsent.version };
    }

    return { required: true, text: activeConsent.text, version: activeConsent.version };
}

export async function saveConsent(
    psychologistId: string,
    telegramUserId: string,
    consentVersion: string
) {
    const timestamp = new Date().toISOString();
    const hashInput = `${telegramUserId}:${consentVersion}:${timestamp}`;
    const consentHash = createHash('sha256').update(hashInput).digest('hex');

    // Find or prepare to update client
    let client = await db.diaryClient.findFirst({
        where: {
            psychologistId,
            OR: [
                { telegramChatId: telegramUserId },
            ]
        }
    });

    // Save consent data on DiaryClient
    if (client) {
        await db.diaryClient.update({
            where: { id: client.id },
            data: {
                consentVersion,
                consentHash,
                consentDate: new Date(),
            }
        });
    }

    // Also update TelegramClient consent
    const tgClient = await db.telegramClient.upsert({
        where: { telegramUserId },
        update: { consentGiven: true, consentDate: new Date() },
        create: {
            telegramUserId,
            consentGiven: true,
            consentDate: new Date(),
        }
    });

    if (tgClient.diaryClientId && !client) {
        await db.diaryClient.update({
            where: { id: tgClient.diaryClientId },
            data: {
                consentVersion,
                consentHash,
                consentDate: new Date(),
            }
        });
    }

    return { hash: consentHash, timestamp };
}
