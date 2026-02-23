'use server';

import { db } from '@/lib/db';
import { bot } from '@/lib/telegram-bot';
import { addDays, format, isBefore, startOfDay } from 'date-fns';

export async function getPsychologist(id: string) {
    const user = await db.user.findUnique({
        where: { id },
        select: {
            name: true,
            image: true,
            psychologistSettings: {
                select: { fullName: true }
            }
        }
    });

    if (!user) return null;

    return {
        ...user,
        name: user.psychologistSettings?.fullName || user.name || 'Специалист'
    };
}

function getAvailableTimesForDateStr(psychologistId: string, dateStr: string, slots: any[], blocks: any[], sessions: any[], sessionBreak: number) {
    // Expected dateStr format: 'yyyy-MM-dd'
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const today = startOfDay(new Date());
    const isToday = date.getTime() === today.getTime();
    const nowHours = new Date().getHours() + (new Date().getMinutes() / 60);

    const dayOfWeek = (date.getDay() + 6) % 7;

    // Check blocks
    const isBlocked = blocks.some(b => {
        const bStartStr = format(b.startDate, 'yyyy-MM-dd');
        const bEndStr = format(b.endDate, 'yyyy-MM-dd');
        return dateStr >= bStartStr && dateStr <= bEndStr;
    });
    if (isBlocked) return [];

    const daySlots = slots.filter(s => {
        if (s.dayOfWeek !== dayOfWeek) return false;

        if (s.startDate) {
            const slotStartStr = format(s.startDate, 'yyyy-MM-dd');
            if (dateStr < slotStartStr) return false;
        }
        if (s.endDate) {
            const slotEndStr = format(s.endDate, 'yyyy-MM-dd');
            if (dateStr > slotEndStr) return false;
        }
        return true;
    });

    const daySessions = sessions.filter(s => format(s.date, 'yyyy-MM-dd') === dateStr);

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

            if (!hasClash) {
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

export async function getAvailableDates(psychologistId: string, year: number, month: number) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const today = startOfDay(new Date());

    const slots = await db.availabilitySlot.findMany({ where: { psychologistId, isActive: true } });
    if (!slots.length) return [];

    const sessionBreak = 15;

    const blocks = await db.timeBlock.findMany({
        where: {
            psychologistId,
            startDate: { lte: endDate },
            endDate: { gte: startDate }
        }
    });

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
        if (isBefore(d, today)) continue;

        const dateStr = format(d, 'yyyy-MM-dd');
        const availableTimes = getAvailableTimesForDateStr(psychologistId, dateStr, slots, blocks, sessions, sessionBreak);
        if (availableTimes.length > 0) {
            availableDates.push(dateStr);
        }
    }

    return availableDates;
}

export async function getAvailableTimes(psychologistId: string, dateStr: string) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    const slots = await db.availabilitySlot.findMany({ where: { psychologistId, isActive: true } });
    const sessionBreak = 15;

    const blocks = await db.timeBlock.findMany({
        where: {
            psychologistId,
            startDate: { lte: date },
            endDate: { gte: date }
        }
    });
    const sessions = await db.diarySession.findMany({
        where: {
            psychologistId,
            date,
            status: { not: 'cancelled' }
        },
        select: { date: true, time: true, duration: true }
    });

    return getAvailableTimesForDateStr(psychologistId, dateStr, slots, blocks, sessions, sessionBreak);
}

export async function bookSession(psychologistId: string, userDetails: any, form: { name: string, phone: string, date: string, time: string, format?: string, addressId?: string | null }) {
    let client = await db.diaryClient.findFirst({
        where: { psychologistId, phone: form.phone }
    });

    const tgUserId = userDetails?.id ? String(userDetails.id) : null;

    if (!client) {
        client = await db.diaryClient.create({
            data: {
                psychologistId,
                name: form.name,
                phone: form.phone,
                telegramChatId: tgUserId,
            }
        });
    } else if (tgUserId && !client.telegramChatId) {
        client = await db.diaryClient.update({
            where: { id: client.id },
            data: { telegramChatId: tgUserId }
        });
    }

    const [y, m, d] = form.date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d)); // Use UTC so 00:00 stays 00:00

    const duration = 50;
    const [h, min] = form.time.split(':').map(Number);
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

    return session.id;
}
export async function getClientSessions(telegramChatId: string) {
    if (!telegramChatId) return [];

    const client = await db.diaryClient.findFirst({
        where: { telegramChatId }
    });

    if (!client) return [];

    const now = new Date();
    // Reset time to start of day for comparison so we don't miss today's later sessions
    now.setHours(0, 0, 0, 0);

    const sessions = await db.diarySession.findMany({
        where: {
            clientId: client.id,
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
