'use server';

import { db } from '@/lib/db';
import { bot } from '@/lib/telegram-bot';
import { addDays, format, isBefore, startOfDay } from 'date-fns';

export async function getPsychologist(id: string) {
    return db.user.findUnique({ where: { id }, select: { name: true, image: true } });
}

function getAvailableTimesForDateStr(psychologistId: string, dateStr: string, slots: any[], blocks: any[], sessions: any[]) {
    // Expected dateStr format: 'yyyy-MM-dd'
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const today = startOfDay(new Date());
    const isToday = date.getTime() === today.getTime();
    const nowHours = new Date().getHours() + (new Date().getMinutes() / 60);

    const dayOfWeek = (date.getDay() + 6) % 7;

    // Check blocks
    const isBlocked = blocks.some(b => startOfDay(b.startDate) <= date && startOfDay(b.endDate) >= date);
    if (isBlocked) return [];

    const daySlots = slots.filter(s => {
        if (s.dayOfWeek !== dayOfWeek) return false;
        if (s.startDate && startOfDay(s.startDate) > date) return false;
        if (s.endDate && startOfDay(s.endDate) < date) return false;
        return true;
    });

    const daySessions = sessions.filter(s => s.date.getTime() === date.getTime());

    let times: string[] = [];

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
                times.push(timeStr);
            }

            currentTotalMins += duration;
        }
    });

    return Array.from(new Set(times)).sort();
}

export async function getAvailableDates(psychologistId: string, year: number, month: number) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const today = startOfDay(new Date());

    const slots = await db.availabilitySlot.findMany({ where: { psychologistId, isActive: true } });
    if (!slots.length) return [];

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
        const availableTimes = getAvailableTimesForDateStr(psychologistId, dateStr, slots, blocks, sessions);
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

    return getAvailableTimesForDateStr(psychologistId, dateStr, slots, blocks, sessions);
}

export async function bookSession(psychologistId: string, userDetails: any, form: { name: string, phone: string, date: string, time: string }) {
    let client = await db.diaryClient.findFirst({
        where: { psychologistId, phone: form.phone }
    });

    if (!client) {
        client = await db.diaryClient.create({
            data: {
                psychologistId,
                name: form.name,
                phone: form.phone,
                telegramChatId: userDetails?.id ? String(userDetails.id) : null,
            }
        });
    } else {
        if (userDetails?.id && !client.telegramChatId) {
            await db.diaryClient.update({
                where: { id: client.id },
                data: { telegramChatId: String(userDetails.id) }
            });
        }
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
            format: 'online',
            status: 'confirmed'
        }
    });

    const sessionsCount = await db.diarySession.count({ where: { clientId: client.id } });
    await db.diaryClient.update({
        where: { id: client.id },
        data: { totalSessions: sessionsCount }
    });

    const psy = await db.user.findUnique({ where: { id: psychologistId }, select: { telegramChatId: true } });
    if (psy?.telegramChatId && bot) {
        try {
            await bot.telegram.sendMessage(
                psy.telegramChatId,
                `🔥 <b>Новая запись через Telegram!</b>\n\nКлиент: ${form.name} (${form.phone})\n📅 Дата: ${form.date}\n⏰ Время: ${form.time}\n\nСвяжитесь с клиентом в Telegram или по телефону для подтверждения, если это необходимо.`,
                { parse_mode: 'HTML' }
            );
        } catch (e) {
            console.error("Failed to send telegram notification:", e);
        }
    }

    return session.id;
}
