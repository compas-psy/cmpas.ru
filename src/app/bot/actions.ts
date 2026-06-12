'use server';

import { db } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';
import { addDays } from 'date-fns';
import { createHash } from 'crypto';

/** Send to Telegram and/or MAX depending on which IDs are set */
async function notifyUser(
    tgId: string | null | undefined,
    maxId: string | null | undefined,
    text: string
) {
    if (tgId) {
        try { await sendTelegramMessage(tgId, text, { parse_mode: 'HTML' }); }
        catch (e) { console.error('[notify] Telegram error:', e); }
    }
    if (maxId) {
        try { await sendMaxMessage(maxId, text); }
        catch (e) { console.error('[notify] MAX error:', e); }
    }
}
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

// Helper: robust date parsing to specified timezone without relying on server's local time
function getPartsInTz(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
    
    // Some runtimes return "24" instead of "00" for midnight with hour12: false
    let hour = get('hour');
    if (hour === '24') hour = '00';

    return {
        year: Number(get('year')),
        month: Number(get('month')),
        day: Number(get('day')),
        hour,
        minute: get('minute')
    };
}

function getAvailableTimesForDateStr(psychologistId: string, dateStr: string, slots: any[], blocks: any[], sessions: any[], settings: any, clientId: string | null = null, skipBuffer = false) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    // Use the practice timezone (default Europe/Moscow) for "now" — the server
    // runs in UTC, but slot times like "17:00" are local wall-clock. Comparing
    // against UTC hours wrongly offers past slots (e.g. 17:00 at 19:07 MSK).
    const tz = settings?.timezone || 'Europe/Moscow';
    const now = new Date();
    const nowParts = getPartsInTz(now, tz);
    const todayStr = `${nowParts.year}-${String(nowParts.month).padStart(2, '0')}-${String(nowParts.day).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const nowH = Number(nowParts.hour);
    const nowM = Number(nowParts.minute);

    // Global settings checks
    const bufferHours = settings?.bookingBufferHours ?? 24;
    const bufferDate = new Date(now.getTime() + bufferHours * 60 * 60 * 1000);
    const bufferParts = getPartsInTz(bufferDate, tz);
    const bufferDateStr = `${bufferParts.year}-${String(bufferParts.month).padStart(2, '0')}-${String(bufferParts.day).padStart(2, '0')}`;
    // If the check date is historically earlier or earlier than buffer date
    if (dateStr < todayStr) return [];
    
    // Horizon check — only for client-facing booking, not psychologist
    if (!skipBuffer) {
        const horizonDays = settings?.bookingHorizonDays ?? 14;
        const horizonDate = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
        const horizonDateStr = toDateStr(horizonDate);
        if (dateStr > horizonDateStr) return [];
    }

    const maxSessionsPerDay = settings?.maxSessionsPerDay ?? null;
    const defaultSessionBreak = settings?.sessionBreak ?? 15;

    const dayOfWeek = (date.getUTCDay() + 6) % 7;

    const daySlots = slots.filter(s => {
        if (s.dayOfWeek !== dayOfWeek) return false;

        const ruleStart = s.scheduleRule?.startDate || s.startDate;
        if (ruleStart) {
            const slotStartStr = toDateStr(new Date(ruleStart));
            if (dateStr < slotStartStr) return false;
        }
        
        const ruleEnd = s.scheduleRule?.endDate || s.endDate;
        if (ruleEnd) {
            const slotEndStr = toDateStr(new Date(ruleEnd));
            if (dateStr > slotEndStr) return false;
        }
        return true;
    });

    const clientAudience = clientId ? 'regular' : 'new';
    const daySessions = sessions.filter(s => toDateStr(new Date(s.date)) === dateStr);
    const bookedCount = daySessions.length;

    let timesObj: Record<string, { time: string, format: string, addressId: string | null, isOwnBooking?: boolean }> = {};

    daySlots.forEach(slot => {
        const audienceFilter = slot.scheduleRule?.audienceFilter || 'all';
        if (audienceFilter !== 'all' && audienceFilter !== clientAudience) return;

        const [startH, startM] = slot.startTime.split(':').map(Number);
        const [endH, endM] = slot.endTime.split(':').map(Number);
        const duration = slot.scheduleRule?.duration ?? slot.duration ?? 50;
        const format = slot.scheduleRule?.format ?? slot.format ?? 'online';
        const addressId = slot.scheduleRule?.addressId ?? slot.addressId ?? null;
        const breakDuration = slot.scheduleRule?.breakDuration ?? defaultSessionBreak;

        let currentTotalMins = startH * 60 + startM;
        const endTotalMins = endH * 60 + endM;

        while (currentTotalMins + duration <= endTotalMins) {
            const h = Math.floor(currentTotalMins / 60);
            const m = currentTotalMins % 60;
            const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

            if (maxSessionsPerDay && (bookedCount + Object.keys(timesObj).filter(k => !timesObj[k].isOwnBooking).length) >= maxSessionsPerDay) {
                break;
            }

            const slotEndTimeMins = currentTotalMins + duration;
            
            // Evaluated exact time buffer.
            if (skipBuffer) {
                // Psychologist manually creating — no buffer restriction, only skip past times for today
                if (isToday) {
                    if (h < nowH || (h === nowH && m <= nowM)) {
                        currentTotalMins += duration + breakDuration;
                        continue;
                    }
                }
            } else if (isToday || dateStr === bufferDateStr) {
                 // bufferDate comparison. If this exact slot starts before the buffer Date/Time, skip it.
                 const [bH, bM] = [Number(bufferParts.hour), Number(bufferParts.minute)];
                 if (dateStr === bufferDateStr && (h < bH || (h === bH && m < bM))) {
                     currentTotalMins += duration + breakDuration;
                     continue;
                 } else if (dateStr < bufferDateStr) {
                     currentTotalMins += duration + breakDuration;
                     continue;
                 }
            }

            const hasBlock = blocks.some(b => {
                const blockStr = toDateStr(new Date(b.date));
                if (blockStr !== dateStr && blockStr !== toDateStr(new Date(b.date.getTime() + 86400000))) return false; // Basic safeguard. Usually b.date is in UTC on same day.
                if (toDateStr(new Date(b.date)) !== dateStr) return false;
                const [bSH, bSM] = b.startTime.split(':').map(Number);
                const [bEH, bEM] = b.endTime.split(':').map(Number);
                const blockStartMins = bSH * 60 + bSM;
                const blockEndMins = bEH * 60 + bEM;
                return currentTotalMins < blockEndMins && slotEndTimeMins > blockStartMins;
            });

            let isOwnSession = false;
            let hasClash = false;
            const collidingSession = daySessions.find(sess => {
                const [sessH, sessM] = sess.time.split(':').map(Number);
                const sessStartMins = sessH * 60 + sessM;
                const sessEndMins = sessStartMins + (sess.duration || 50);
                return currentTotalMins < sessEndMins && slotEndTimeMins > sessStartMins;
            });

            if (collidingSession) {
                if (clientId && collidingSession.clientId === clientId) {
                    isOwnSession = true;
                } else {
                    hasClash = true;
                }
            }

            if (!hasClash && !hasBlock) {
                const key = `${timeStr}-${format}`;
                if (!timesObj[key]) {
                    timesObj[key] = {
                        time: timeStr,
                        format: format,
                        addressId: addressId,
                        isOwnBooking: isOwnSession
                    };
                }
            }

            currentTotalMins += duration + breakDuration;
        }
    });

    return Object.values(timesObj).sort((a, b) => a.time.localeCompare(b.time));
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

    let externalBlocks: any[] = [];
    if (blockConflicts) {
        const integrations = await db.calendarIntegration.findMany({
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
                const tz = settings?.timezone || 'Europe/Moscow';
                // Map external events into a structure similar to diaryBlocks.
                // Yandex iCal events without 'Z' suffix are "floating" local time —
                // they come back with a startLocalStr/endLocalStr to avoid UTC mis-conversion.
                const mapped = res.events.map((ev: any) => {
                    const getParts = (dateInput: Date, localStr?: string) => {
                        if (localStr) {
                            const [d, t] = localStr.split('T');
                            const [y, m, day] = d.split('-');
                            const [h, min] = t.split(':');
                            return { year: Number(y), month: Number(m), day: Number(day), hour: h, minute: min };
                        }
                        return getPartsInTz(dateInput, tz);
                    };

                    const localStart = new Date(ev.start);
                    const localEnd = new Date(ev.end);
                    const startParts = getParts(localStart, ev.startLocalStr);
                    const endParts = getParts(localEnd, ev.endLocalStr);

                    const date = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
                    const startTime = `${startParts.hour}:${startParts.minute}`;
                    const endTime = `${endParts.hour}:${endParts.minute}`;

                    return { date, startTime, endTime, _external: true };
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
        select: { date: true, time: true, duration: true, clientId: true }
    });

    const availableDates: string[] = [];

    for (let d = new Date(startDate); d <= endDate; d = addDays(d, 1)) {
        const dateStr = toDateStr(d);
        if (dateStr < todayStr) continue;

        const availableTimes = getAvailableTimesForDateStr(psychologistId, dateStr, slots, allBlocks, sessions, settings, clientId, skipBuffer);
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

    let externalBlocks: any[] = [];
    if (blockConflicts) {
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
                const tz = settings?.timezone || 'Europe/Moscow';
                // Yandex iCal events without 'Z' suffix are "floating" local time —
                // they come back with a startLocalStr/endLocalStr to avoid UTC mis-conversion.
                const mapped = res.events.map((ev: any) => {
                    const getParts = (dateInput: Date, localStr?: string) => {
                        if (localStr) {
                            const [d, t] = localStr.split('T');
                            const [y, m, day] = d.split('-');
                            const [h, min] = t.split(':');
                            return { year: Number(y), month: Number(m), day: Number(day), hour: h, minute: min };
                        }
                        return getPartsInTz(dateInput, tz);
                    };

                    const localStart = new Date(ev.start);
                    const localEnd = new Date(ev.end);
                    const startParts = getParts(localStart, ev.startLocalStr);
                    const endParts = getParts(localEnd, ev.endLocalStr);

                    const date = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
                    const startTime = `${startParts.hour}:${startParts.minute}`;
                    const endTime = `${endParts.hour}:${endParts.minute}`;

                    return { date, startTime, endTime, _external: true };
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
            status: { not: 'cancelled' },
            ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
        },
        select: { date: true, time: true, duration: true, clientId: true }
    });

    return getAvailableTimesForDateStr(psychologistId, dateStr, slots, allBlocks, sessions, settings, clientId, skipBuffer);
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
        
        if (tgClient) {
            // Update the link if it doesn't exist yet
            if (!tgClient.diaryClientId) {
                await db.telegramClient.update({
                    where: { id: tgClient.id },
                    data: { diaryClientId: client.id, psychologistId }
                });
            }

            // Sync consent from TelegramClient to DiaryClient if given
            if (tgClient.consentGiven && tgClient.consentDate && !client.consentVersion) {
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

    // Get duration from the matching availability slot for this booking
    const [h, min] = form.time.split(':').map(Number);
    const bookingDayOfWeek = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
    const matchingSlot = await db.availabilitySlot.findFirst({
        where: {
            psychologistId,
            isActive: true,
            dayOfWeek: bookingDayOfWeek,
        },
        orderBy: { createdAt: 'desc' },
    });
    const duration = matchingSlot?.duration || 50;
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

    const psy = await db.user.findUnique({ 
        where: { id: psychologistId },
        include: { psychologistSettings: true }
    }) as any;

    const onlineLink = form.format === 'online' ? (psy?.psychologistSettings?.onlineSessionLink || '') : '';
    const linkText = onlineLink ? `\n🔗 Ссылка для подключения: ${onlineLink}` : '';

    // Notify psychologist (Telegram + MAX)
    await notifyUser(
        psy?.telegramChatId,
        (psy as any)?.maxChatId,
        `🔥 <b>Новая запись!</b>\n\nКлиент: ${form.name} (${form.phone})\n📅 Дата: ${form.date}\n⏰ Время: ${form.time}\n📍 Формат: ${form.format === 'offline' ? 'Очно (в кабинете)' : 'Онлайн'}`
    );

    // Notify client (Telegram + MAX)
    const clientMsg = `✅ <b>Вы успешно записаны!</b>\n\nСпециалист: ${psy?.psychologistSettings?.fullName || psy?.name || 'Психолог'}\n📅 Дата: ${form.date}\n⏰ Время: ${form.time}\n📍 Формат: ${form.format === 'offline' ? 'Очная встреча' : 'Онлайн-консультация'}${linkText}`;
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
                        select: { fullName: true, onlineSessionLink: true }
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
        psychologistName: s.psychologist.psychologistSettings?.fullName || s.psychologist.name || 'Специалист',
        onlineSessionLink: s.psychologist.psychologistSettings?.onlineSessionLink || null
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
