'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { resolveScheduleAddressId } from '@/lib/practice/ownership';
import { createSlotsFor, updateSlotFor, deleteSlotFor } from '@/lib/practice/availability-core';
import { resolveBlockWindow, sessionOverlapsBlock } from '@/lib/practice/block-window';

async function fixMissingIsActive(psychologistId: string) {
    try {
        // Maintenance: ensure all slots for this user have isActive: true or are not null
        // We only fix slots that don't have isActive specifically set to false
        const result = await db.availabilitySlot.updateMany({
            where: {
                psychologistId,
                OR: [
                    { isActive: { equals: null as any } },
                    { isActive: false } // Force-enable for now to recover "vanished" slots
                ]
            },
            data: { isActive: true }
        });
        if (result.count > 0) {
            console.log(`[Availability] Fixed ${result.count} inactive slots for user ${psychologistId}`);
        }
    } catch (e) {
        console.error('[Availability] fixMissingIsActive warning:', e);
    }
}

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export async function getAvailabilitySlots() {
    try {
        const psychologistId = await getPsychologistId();
        console.log(`[Availability] Fetching slots for psychologist: ${psychologistId}`);

        // Run fix first
        await fixMissingIsActive(psychologistId);

        // Try with scheduleRule include, fallback to without if migration not yet applied
        let slots;
        try {
            slots = await db.availabilitySlot.findMany({
                where: { psychologistId, isActive: true },
                orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
                include: {
                    scheduleRule: { select: { id: true, name: true, color: true } },
                },
            });
        } catch {
            // Fallback if scheduleRule relation doesn't exist yet (pre-migration)
            slots = await db.availabilitySlot.findMany({
                where: { psychologistId, isActive: true },
                orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
            });
        }
        console.log(`[Availability] Found ${slots.length} active slots`);
        return { success: true, data: slots };
    } catch (e: any) {
        console.error('[Availability] getAvailabilitySlots error:', e);
        return { success: false, error: e.message || 'Ошибка при получении расписания' };
    }
}

/**
 * Веб-вход в создание окон. Тонкая обёртка: сессия → ядро → revalidate.
 * Сами правила (пересечения, кабинет, раскладка обеда) живут в
 * src/lib/practice/availability-core.ts, потому что тем же правилам должен
 * подчиняться и мобильный маршрут.
 */
export async function createAvailabilitySlot(data: {
    startDate: string;
    endDate: string;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    duration?: number;
    hasLunch?: boolean;
    lunchStart?: string;
    lunchEnd?: string;
    format?: string;
    addressId?: string | null;
    scheduleRuleId?: string | null;
}) {
    try {
        const psychologistId = await getPsychologistId();
        const created = await createSlotsFor(psychologistId, data);
        console.log(`[Availability] Created ${created} slots`);
        revalidatePath('/diary/availability');
        return { success: true };
    } catch (e: any) {
        console.error('[Availability] createAvailabilitySlot error:', e);
        return { success: false, error: e.message || 'Внутренняя ошибка сервера' };
    }
}

export async function deleteAvailabilitySlot(id: string) {
    try {
        const psychologistId = await getPsychologistId();
        await deleteSlotFor(psychologistId, id);
        revalidatePath('/diary/availability');
        return { success: true };
    } catch (e: any) {
        console.error('[Availability] deleteAvailabilitySlot error:', e);
        return { success: false, error: e.message || 'Ошибка при удалении окна' };
    }
}

export async function updateAvailabilitySlot(id: string, data: {
    startTime: string;
    endTime: string;
    duration: number;
    format: string;
    addressId?: string | null;
}) {
    try {
        const psychologistId = await getPsychologistId();
        await updateSlotFor(psychologistId, id, data);
        revalidatePath('/diary/availability');
        return { success: true };
    } catch (e: any) {
        console.error('[Availability] updateAvailabilitySlot error:', e);
        return { success: false, error: e.message || 'Ошибка при обновлении окна' };
    }
}

export async function getTimeBlocks() {
    try {
        const psychologistId = await getPsychologistId();
        const blocks = await db.diaryBlock.findMany({
            where: { psychologistId },
            orderBy: { date: 'desc' },
        });

        // Часы отдаются экрану: с появлением почасовых блокировок две записи
        // на один день различаются только ими, и без них список показывал бы
        // одинаковые карточки для разного времени.
        const formatted = blocks.map(b => ({
            id: b.id,
            startDate: b.date,
            endDate: b.date,
            startTime: b.startTime,
            endTime: b.endTime,
            type: b.type,
            reason: b.reason
        }));
        return { success: true, data: formatted };
    } catch (e: any) {
        console.error('getTimeBlocks error:', e);
        return { success: false, error: e.message || 'Ошибка при получении блокировок' };
    }
}

export async function createTimeBlock(data: {
    startDate: string;
    endDate: string;
    type: string;
    reason?: string;
    /**
     * Часы блокировки. Не заданы — целый день, как было до появления этих
     * полей: специалист, закрывавший вторник целиком, продолжает делать это
     * тем же действием.
     */
    startTime?: string;
    endTime?: string;
    cancelIntersectingSessions?: boolean;
}) {
    try {
        const psychologistId = await getPsychologistId();

        // Окно разбирается общим правилом — тем же, которым живёт мобильный
        // маршрут блокировок. Две трактовки «что такое пересечение» здесь
        // означали бы отменённые встречи живых людей.
        const window = resolveBlockWindow(data);
        if (!window) return { success: false, error: 'Конец блокировки должен быть позже начала' };

        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        const blocksToCreate = [];

        // Создаем блоки на каждый день от startDate до endDate
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            blocksToCreate.push({
                psychologistId,
                date: new Date(d),
                startTime: window.startTime,
                endTime: window.endTime,
                type: data.type,
                reason: data.reason || null,
            });
        }

        await db.diaryBlock.createMany({
            data: blocksToCreate
        });

        if (data.cancelIntersectingSessions) {
            // Find and cancel all intersecting sessions in this range.
            // 'no_show' excluded alongside 'completed' (O-260829): a session
            // already marked "не пришёл" already happened (or didn't) — it's
            // not an open booking to auto-cancel with a client notification.
            const candidates = await db.diarySession.findMany({
                where: {
                    psychologistId,
                    date: { gte: start, lte: end },
                    status: { notIn: ['cancelled', 'completed', 'no_show'] }
                },
                include: { client: { include: { telegramClient: true } } }
            });

            // Отбор по ЧАСАМ, а не только по дате. Без него блокировка обеда
            // отменяла бы весь день — и клиенты получили бы отмену встреч,
            // которых блокировка не касается.
            const sessionsToCancel = candidates.filter(session => sessionOverlapsBlock(session, window));

            if (sessionsToCancel.length > 0) {
                await db.diarySession.updateMany({
                    where: { id: { in: sessionsToCancel.map(s => s.id) } },
                    data: { status: 'cancelled' }
                });

                // Trigger telegram messages
                for (const session of sessionsToCancel) {
                    const clientChatId = session.client?.telegramClient?.telegramUserId || session.client?.telegramChatId;
                    if (clientChatId) {
                        const message = `⚠️ Ваша запись на ${session.date.toLocaleDateString('ru-RU')} в ${session.time} была отменена психологом ` +
                            (data.reason ? `(Причина: ${data.reason}). ` : `. `) +
                            `Пожалуйста, свяжитесь для переноса.`;

                        try {
                            const { sendTelegramMessage } = await import('@/lib/telegram');
                            await sendTelegramMessage(clientChatId, message);
                        } catch (e) {
                            console.error('Failed to send cancellation notice to', clientChatId, e);
                        }
                    }
                }
            }
        }

        revalidatePath('/diary/availability');
        revalidatePath('/diary');
        return { success: true };
    } catch (e: any) {
        console.error('[Availability] createTimeBlock error:', e);
        return { success: false, error: e.message || 'Ошибка при создании блокировки' };
    }
}

export async function deleteTimeBlock(id: string) {
    try {
        const psychologistId = await getPsychologistId();
        await db.diaryBlock.deleteMany({ where: { id, psychologistId } });
        revalidatePath('/diary/availability');
        return { success: true };
    } catch (e: any) {
        console.error('[Availability] deleteTimeBlock error:', e);
        return { success: false, error: e.message || 'Ошибка при удалении блокировки' };
    }
}

export async function checkBlockIntersections(
    startDate: string,
    endDate: string,
    /** Часы блокировки. Не заданы — целый день. */
    hours?: { startTime?: string; endTime?: string },
) {
    try {
        const psychologistId = await getPsychologistId();
        const start = new Date(startDate);
        const end = new Date(endDate);
        const window = resolveBlockWindow(hours ?? {});
        if (!window) return { success: false, error: 'Конец блокировки должен быть позже начала' };

        // Find sessions in this date range
        const sessions = await db.diarySession.findMany({
            where: {
                psychologistId,
                date: {
                    gte: start,
                    lte: end
                },
                status: { notIn: ['cancelled', 'completed', 'no_show'] }
            },
            include: { client: true }
        });

        // Показываем человеку ровно то, что попадёт под отмену: тот же отбор
        // по часам, что и в самой отмене. Иначе список пересечений обещал бы
        // одно, а отменялось бы другое.
        const formatted = sessions
            .filter(s => sessionOverlapsBlock(s, window))
            .map(s => ({
                id: s.id,
                date: s.date,
                time: s.time,
                clientName: s.client.name
            }));
        return { success: true, data: formatted };
    } catch (e: any) {
        console.error('[Availability] checkBlockIntersections error:', e);
        return { success: false, error: e.message || 'Ошибка при проверке пересечений' };
    }
}

/**
 * Create a single manual slot for a specific day of week.
 * Used by the visual timeline for click-to-add.
 */
export async function createManualSlot(data: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    duration?: number;
    format?: string;
    addressId?: string | null;
    startDate: string;
    endDate: string;
    scheduleRuleId?: string | null;
}) {
    try {
        const psychologistId = await getPsychologistId();

        // Load settings for defaults
        const settings = await db.psychologistSettings.findUnique({
            where: { psychologistId },
        });

        const duration = data.duration || settings?.defaultSessionDuration || 50;
        const addressId = await resolveScheduleAddressId(psychologistId, data.format, data.addressId);

        // Check for overlaps
        const existing = await db.availabilitySlot.findMany({
            where: { psychologistId, isActive: true, dayOfWeek: data.dayOfWeek },
        });

        const [newStartH, newStartM] = data.startTime.split(':').map(Number);
        const [newEndH, newEndM] = data.endTime.split(':').map(Number);
        const newStartMins = newStartH * 60 + newStartM;
        const newEndMins = newEndH * 60 + newEndM;

        for (const slot of existing) {
            const [exStartH, exStartM] = slot.startTime.split(':').map(Number);
            const [exEndH, exEndM] = slot.endTime.split(':').map(Number);
            const exStartMins = exStartH * 60 + exStartM;
            const exEndMins = exEndH * 60 + exEndM;

            // Check date overlap
            const slotStart = slot.startDate ? slot.startDate.getTime() : 0;
            const slotEnd = slot.endDate ? slot.endDate.getTime() : Infinity;
            const newStart = new Date(data.startDate).getTime();
            const newEnd = new Date(data.endDate).getTime();
            if (newStart > slotEnd || newEnd < slotStart) continue;

            if (newStartMins < exEndMins && newEndMins > exStartMins) {
                throw new Error('Это время уже занято');
            }
        }

        const created = await db.availabilitySlot.create({
            data: {
                psychologistId,
                dayOfWeek: data.dayOfWeek,
                startTime: data.startTime,
                endTime: data.endTime,
                duration,
                format: data.format || 'online',
                addressId,
                isRecurring: true,
                startDate: new Date(data.startDate),
                endDate: new Date(data.endDate),
                isActive: true,
                scheduleRuleId: data.scheduleRuleId || null,
            },
        });

        revalidatePath('/diary/availability');
        return { success: true, data: created };
    } catch (e: any) {
        console.error('[Availability] createManualSlot error:', e);
        return { success: false, error: e.message || 'Ошибка при создании слота' };
    }
}
