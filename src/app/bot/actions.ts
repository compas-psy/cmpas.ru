'use server';

import { db } from '@/lib/db';
import { bot } from '@/lib/telegram-bot';
import { addDays } from 'date-fns';
import { createHash } from 'crypto';
import { fetchGoogleCalendarEvents } from '@/lib/calendar/google';
import { fetchYandexCalendarEvents } from '@/lib/calendar/yandex';

export async function getPsychologist(id: string) {
    const user = await db.user.findUnique({
        where: { id },
        select: {
            name: true,
            image: true,
            psychologistSettings: {
                select: { fullName: true, scheduleMode: true }
            }
        }
    });

    if (!user) return null;

    return {
        ...user,
        name: user.psychologistSettings?.fullName || user.name || 'Специалист',
        scheduleMode: user.psychologistSettings?.scheduleMode || 'private'
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

function getAvailableTimesForDateStr(psychologistId: string, dateStr: string, slots: any[], blocks: any[], sessions: any[], sessionBreak: number) {
    // Expected dateStr format: 'yyyy-MM-dd'
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const now = new Date();
    const todayStr = toDateStr(now);
    const isToday = dateStr === todayStr;
    const nowHours = now.getHours() + (now.getMinutes() / 60);

    const dayOfWeek = (date.getUTCDay() + 6) % 7;

    const daySlots = slots.filter(s => {
        if (s.dayOfWeek !== dayOfWeek) return false;

        if (s.startDate) {
            const slotStartStr = toDateStr(new Date(s.startDate));
            if (dateStr < slotStartStr) return false;
        }
        if (s.endDate) {
            const slotEndStr = toDateStr(new Date(s.endDate));
            if (dateStr > slotEndStr) return false;
        }
        return true;
    });

    const daySessions = sessions.filter(s => toDateStr(new Date(s.date)) === dateStr);

    let timesObj: Record<string, { time: string, format: string, addressId: string | null }> = {};

    daySlots.forEach(slot => {
        const [startH, startM] = slot.startTime.split(':').map(Number);
        const [endH, endM] = slot.endTime.split(':').map(Number);
        const duration = slot.duration || 50;

        let currentTotalMins = startH * 60 + startM;
        const endTotalMins = endH * 60 + endM;

        while (currentTotalMins + duration <= endTotalMins) {
            const h = Math.floor(currentTotalMins / 60);
            const m = currentTotalMins % 60;
            const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

            // Check if past (if today)
            if (isToday && (h + m / 60 <= nowHours)) {
                currentTotalMins += duration;
                continue;
            }

            // Check if clashes with any session
            const slotEndTimeMins = currentTotalMins + duration;
            const hasClash = daySessions.some(sess => {
                const [sessH, sessM] = sess.time.split(':').map(Number);
                const sessStartMins = sessH * 60 + sessM;
                const sessEndMins = sessStartMins + (sess.duration || 50);

                return currentTotalMins < sessEndMins && slotEndTimeMins > sessStartMins;
            });

            // Check if clashes with any block
            const hasBlock = blocks.some(b => {
                if (toDateStr(new Date(b.date)) !== dateStr) return false;
                const [bSH, bSM] = b.startTime.split(':').map(Number);
                const [bEH, bEM] = b.endTime.split(':').map(Number);
                const blockStartMins = bSH * 60 + bSM;
                const blockEndMins = bEH * 60 + bEM;
                return currentTotalMins < blockEndMins && slotEndTimeMins > blockStartMins;
            });

            if (!hasClash && !hasBlock) {
                const key = `${timeStr}-${slot.format || 'online'}`;
                if (!timesObj[key]) {
                    timesObj[key] = {
                        time: timeStr,
                        format: slot.format || 'online',
                        addressId: slot.addressId || null
                    };
                }
            }

            currentTotalMins += duration + sessionBreak;
        }
    });

    return Object.values(timesObj).sort((a, b) => a.time.localeCompare(b.time));
}

export async function getAvailableDates(psychologistId: string, year: number, month: number, skipModeCheck = false) {
    // Check schedule mode — if private, return empty (only for client-facing calls)
    if (!skipModeCheck) {
        const mode = await getScheduleMode(psychologistId);
        if (mode === 'private') return [];
    }

    // Use UTC dates for DB queries to match how dates are stored
    const startDate = new Date(Date.UTC(year, month, 1));
    const endDate = new Date(Date.UTC(year, month + 1, 0));
    const todayStr = toDateStr(new Date());

    const slots = await db.availabilitySlot.findMany({ where: { psychologistId, isActive: true } });
    if (!slots.length) return [];

    const sessionBreak = 15;

    // Fetch settings to check if we should block conflicts from external calendars
    const settings = await db.psychologistSettings.findUnique({ where: { psychologistId } });
    const blockConflicts = settings?.blockConflicts ?? false;

    let externalBlocks: any[] = [];
    if (blockConflicts) {
        // @ts-ignore: syncFrom is added to schema but prisma generate failed due to db connection
        // @ts-ignore: syncFrom is added to schema but prisma generate failed due to db connection
        const integrations = await db.calendarIntegration.findMany({
            // @ts-ignore: syncFrom is added to schema but prisma generate failed due to db connection
            where: { psychologistId, isActive: true, syncFrom: true }
        });

        for (const integration of integrations) {
            let res;
            if (integration.provider === 'google') {
                res = await fetchGoogleCalendarEvents(integration.id, startDate, endDate);
            } else if (integration.provider === 'yandex') {
                res = await fetchYandexCalendarEvents(integration.id, startDate, endDate);
            }

            if (res && res.success && res.events) {
                // Map external events into a structure similar to diaryBlocks
                const mapped = res.events.map((ev: any) => {
                    const localStart = new Date(ev.start);
                    const localEnd = new Date(ev.end);
                    return {
                        date: new Date(Date.UTC(localStart.getFullYear(), localStart.getMonth(), localStart.getDate())),
                        startTime: `${String(localStart.getHours()).padStart(2, '0')}:${String(localStart.getMinutes()).padStart(2, '0')}`,
                        endTime: `${String(localEnd.getHours()).padStart(2, '0')}:${String(localEnd.getMinutes()).padStart(2, '0')}`,
                        _external: true
                    };
                });
                externalBlocks.push(...mapped);
            }
        }
    }

    const blocks = await db.diaryBlock.findMany({
        where: {
            psychologistId,
            date: { lte: endDate, gte: startDate }
        }
    });

    const allBlocks = [...blocks, ...externalBlocks];

    const sessions = await db.diarySession.findMany({
        where: {
            psychologistId,
            date: { gte: startDate, lte: endDate },
            status: { not: 'cancelled' }
        },
        select: { date: true, time: true, duration: true }
    });

    const availableDates: string[] = [];

    for (let d = new Date(startDate); d <= endDate; d = addDays(d, 1)) {
        const dateStr = toDateStr(d);
        if (dateStr < todayStr) continue;

        const availableTimes = getAvailableTimesForDateStr(psychologistId, dateStr, slots, allBlocks, sessions, sessionBreak);
        if (availableTimes.length > 0) {
            availableDates.push(dateStr);
        }
    }

    return availableDates;
}

export async function getAvailableTimes(psychologistId: string, dateStr: string, skipModeCheck = false) {
    // Check schedule mode — if private, return empty (only for client-facing calls)
    if (!skipModeCheck) {
        const mode = await getScheduleMode(psychologistId);
        if (mode === 'private') return [];
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    // Use UTC date for DB queries — this matches how bookSession creates dates
    const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

    const slots = await db.availabilitySlot.findMany({ where: { psychologistId, isActive: true } });
    const sessionBreak = 15;

    // Fetch settings to check if we should block conflicts from external calendars
    const settings = await db.psychologistSettings.findUnique({ where: { psychologistId } });
    const blockConflicts = settings?.blockConflicts ?? false;

    let externalBlocks: any[] = [];
    if (blockConflicts) {
        // @ts-ignore: syncFrom is added to schema but prisma generate failed due to db connection
        const integrations = await db.calendarIntegration.findMany({
            where: { psychologistId, isActive: true, syncFrom: true }
        });

        for (const integration of integrations) {
            let res;
            if (integration.provider === 'google') {
                res = await fetchGoogleCalendarEvents(integration.id, dayStart, dayEnd);
            } else if (integration.provider === 'yandex') {
                res = await fetchYandexCalendarEvents(integration.id, dayStart, dayEnd);
            }

            if (res && res.success && res.events) {
                const mapped = res.events.map((ev: any) => {
                    const localStart = new Date(ev.start);
                    const localEnd = new Date(ev.end);
                    return {
                        date: new Date(Date.UTC(localStart.getFullYear(), localStart.getMonth(), localStart.getDate())),
                        startTime: `${String(localStart.getHours()).padStart(2, '0')}:${String(localStart.getMinutes()).padStart(2, '0')}`,
                        endTime: `${String(localEnd.getHours()).padStart(2, '0')}:${String(localEnd.getMinutes()).padStart(2, '0')}`,
                        _external: true
                    };
                });
                externalBlocks.push(...mapped);
            }
        }
    }

    const blocks = await db.diaryBlock.findMany({
        where: {
            psychologistId,
            date: { gte: dayStart, lte: dayEnd }
        }
    });

    const allBlocks = [...blocks, ...externalBlocks];
    const sessions = await db.diarySession.findMany({
        where: {
            psychologistId,
            date: { gte: dayStart, lte: dayEnd },
            status: { not: 'cancelled' }
        },
        select: { date: true, time: true, duration: true }
    });

    return getAvailableTimesForDateStr(psychologistId, dateStr, slots, allBlocks, sessions, sessionBreak);
}

export async function bookSession(psychologistId: string, userDetails: any, form: { name: string, phone: string, date: string, time: string, format?: string, addressId?: string | null }) {
    let normalizedPhone = form.phone.replace(/[^\d+]/g, '');
    const plainDigits = normalizedPhone.replace(/[^\d]/g, '');

    if (plainDigits.length === 11 && (plainDigits.startsWith('8') || plainDigits.startsWith('7'))) {
        normalizedPhone = '+7' + plainDigits.slice(1);
    } else if (plainDigits.length === 10) {
        normalizedPhone = '+7' + plainDigits;
    } else if (!normalizedPhone.startsWith('+') && normalizedPhone.length > 0) {
        normalizedPhone = '+' + plainDigits;
    }

    let client = await db.diaryClient.findFirst({
        where: {
            psychologistId,
            OR: [
                { phone: normalizedPhone },
                { phone: plainDigits },
                { phone: '+' + plainDigits },
                { phone: form.phone } // legacy formats
            ]
        },
        orderBy: { createdAt: 'desc' }
    });

    const tgUserId = userDetails?.id ? String(userDetails.id) : null;

    if (!client) {
        client = await db.diaryClient.create({
            data: {
                psychologistId,
                name: form.name,
                phone: normalizedPhone,
                telegramChatId: tgUserId,
            }
        });
    } else {
        // Клиент найден по телефону — обновляем только telegramChatId, имя НЕ меняем
        const updateData: any = {};
        if (tgUserId && !client.telegramChatId) updateData.telegramChatId = tgUserId;
        if (Object.keys(updateData).length > 0) {
            client = await db.diaryClient.update({
                where: { id: client.id },
                data: updateData
            });
        }
    }

    // Привязать TelegramClient → DiaryClient если есть
    if (tgUserId) {
        const tgClient = await db.telegramClient.findUnique({
            where: { telegramUserId: tgUserId }
        });
        if (tgClient && !tgClient.diaryClientId) {
            await db.telegramClient.update({
                where: { id: tgClient.id },
                data: { diaryClientId: client.id, psychologistId }
            });
            // Also sync consent from TelegramClient to DiaryClient if given
            if (tgClient.consentGiven && tgClient.consentDate && !client.consentVersion) {
                // Get active consent version to store on DiaryClient
                const activeConsentVer = await db.consentVersion.findFirst({
                    where: { isActive: true },
                    orderBy: { createdAt: 'desc' },
                    select: { version: true }
                });
                if (activeConsentVer) {
                    const hashInput = `${tgUserId}:${activeConsentVer.version}:${tgClient.consentDate.toISOString()}`;
                    const hash = createHash('sha256').update(hashInput).digest('hex');
                    await db.diaryClient.update({
                        where: { id: client.id },
                        data: {
                            consentVersion: activeConsentVer.version,
                            consentHash: hash,
                            consentDate: tgClient.consentDate,
                        }
                    });
                }
            }
        }
    }

    const [y, m, d] = form.date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));

    const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));

    // Валидация: слот не занят
    const duration = 50;
    const [h, min] = form.time.split(':').map(Number);
    const newStartMins = h * 60 + min;
    const newEndMins = newStartMins + duration;

    const existingSessions = await db.diarySession.findMany({
        where: {
            psychologistId,
            date: { gte: dayStart, lte: dayEnd },
            status: { not: 'cancelled' },
        },
    });

    for (const existing of existingSessions) {
        const [eH, eM] = existing.time.split(':').map(Number);
        const eStartMins = eH * 60 + eM;
        const eEndMins = eStartMins + (existing.duration || 50);
        if (newStartMins < eEndMins && newEndMins > eStartMins) {
            return { success: false, error: 'Это время уже занято' };
        }
    }

    // Валидация: один клиент не может записаться 2+ раз в один день
    const clientSessionsToday = existingSessions.filter(s => s.clientId === client!.id);
    if (clientSessionsToday.length > 0) {
        return { success: false, error: 'Вы уже записаны на этот день' };
    }

    const endMinutes = h * 60 + min + duration;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    const session = await db.diarySession.create({
        data: {
            psychologistId,
            clientId: client.id,
            date: dateObj,
            time: form.time,
            endTime,
            duration,
            type: 'individual',
            format: form.format || 'online',
            status: 'confirmed'
        }
    });

    const sessionsCount = await db.diarySession.count({ where: { clientId: client.id } });
    await db.diaryClient.update({
        where: { id: client.id },
        data: { totalSessions: sessionsCount }
    });

    const psy = await db.user.findUnique({ where: { id: psychologistId } }) as any;
    if (psy?.telegramChatId && bot) {
        try {
            await bot.telegram.sendMessage(
                psy.telegramChatId,
                `🔥 <b>Новая запись через Telegram!</b>\n\nКлиент: ${form.name} (${form.phone})\n📅 Дата: ${form.date}\n⏰ Время: ${form.time}\n📍 Формат: ${form.format === 'offline' ? 'Очно (в кабинете)' : 'Онлайн'}\n\nСвяжитесь с клиентом в Telegram или по телефону для подтверждения, если это необходимо.`,
                { parse_mode: 'HTML' }
            );
        } catch (e) {
            console.error("Failed to send telegram notification:", e);
        }
    }

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

    return { success: true, sessionId: session.id, clientId: client.id };
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

export async function getClientSessions(telegramChatId: string) {
    if (!telegramChatId) return [];

    const client = await db.diaryClient.findFirst({
        where: { telegramChatId }
    });

    if (!client) return [];

    return getClientSessionsById(client.id);
}

export async function getClientSessionsById(clientId: string) {
    if (!clientId) return [];

    const now = new Date();
    // Reset time to start of day for comparison so we don't miss today's later sessions
    now.setHours(0, 0, 0, 0);

    const sessions = await db.diarySession.findMany({
        where: {
            clientId: clientId,
            date: { gte: now },
            status: { not: 'cancelled' }
        },
        include: {
            psychologist: {
                select: {
                    name: true,
                    psychologistSettings: {
                        select: { fullName: true }
                    }
                }
            }
        },
        orderBy: [
            { date: 'asc' },
            { time: 'asc' }
        ]
    });

    return sessions.map(s => ({
        id: s.id,
        date: s.date,
        time: s.time,
        status: s.status,
        format: s.format,
        psychologistId: s.psychologistId,
        psychologistName: s.psychologist.psychologistSettings?.fullName || s.psychologist.name || 'Специалист'
    }));
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
            psychologistId,
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
