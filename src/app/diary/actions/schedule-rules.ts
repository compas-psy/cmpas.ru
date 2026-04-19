'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { RULE_COLORS } from './schedule-constants';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

/**
 * Get all schedule rules for the current psychologist.
 * Returns rules with slot counts.
 */
export async function getScheduleRules() {
    try {
        const psychologistId = await getPsychologistId();

        const rules = await db.scheduleRule.findMany({
            where: { psychologistId },
            include: {
                _count: { select: { slots: true } },
                slots: {
                    select: {
                        id: true,
                        dayOfWeek: true,
                        startTime: true,
                        endTime: true,
                        format: true,
                        startDate: true,
                        endDate: true,
                    },
                    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
                },
            },
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        });

        return {
            success: true,
            data: rules.map(r => ({
                id: r.id,
                name: r.name,
                priority: r.priority,
                isActive: r.isActive,
                color: r.color,
                slotCount: r._count.slots,
                slots: r.slots,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
            })),
        };
    } catch (e: any) {
        console.error('[ScheduleRules] getScheduleRules error:', e);
        // Return empty data instead of error — graceful pre-migration fallback
        return { success: true, data: [] };
    }
}

/**
 * Create a new schedule rule (without slots).
 */
export async function createScheduleRule(data: {
    name: string;
    color?: string;
    priority?: number;
}) {
    try {
        const psychologistId = await getPsychologistId();

        // Pick a color if not specified — use the next unused one
        let color = data.color;
        if (!color) {
            const existing = await db.scheduleRule.findMany({
                where: { psychologistId },
                select: { color: true },
            });
            const usedColors = new Set(existing.map(r => r.color));
            color = RULE_COLORS.find(c => !usedColors.has(c)) || RULE_COLORS[0];
        }

        const rule = await db.scheduleRule.create({
            data: {
                psychologistId,
                name: data.name,
                color,
                priority: data.priority ?? 0,
            },
        });

        revalidatePath('/diary/availability');
        return { success: true, data: rule };
    } catch (e: any) {
        console.error('[ScheduleRules] createScheduleRule error:', e);
        return { success: false, error: e.message || 'Ошибка при создании правила' };
    }
}

/**
 * Update rule name, color, priority or active status.
 */
export async function updateScheduleRule(id: string, data: {
    name?: string;
    color?: string;
    priority?: number;
    isActive?: boolean;
}) {
    try {
        const psychologistId = await getPsychologistId();

        // Verify ownership
        const existing = await db.scheduleRule.findUnique({ where: { id } });
        if (!existing || existing.psychologistId !== psychologistId) {
            throw new Error('Unauthorized');
        }

        const rule = await db.scheduleRule.update({
            where: { id },
            data,
        });

        revalidatePath('/diary/availability');
        return { success: true, data: rule };
    } catch (e: any) {
        console.error('[ScheduleRules] updateScheduleRule error:', e);
        return { success: false, error: e.message || 'Ошибка при обновлении правила' };
    }
}

/**
 * Delete a schedule rule. Slots are NOT deleted — they lose their grouping (scheduleRuleId → null).
 */
export async function deleteScheduleRule(id: string) {
    try {
        const psychologistId = await getPsychologistId();

        const existing = await db.scheduleRule.findUnique({ where: { id } });
        if (!existing || existing.psychologistId !== psychologistId) {
            throw new Error('Unauthorized');
        }

        // Unlink slots first (SetNull on FK handles this, but let's be explicit)
        await db.availabilitySlot.updateMany({
            where: { scheduleRuleId: id },
            data: { scheduleRuleId: null },
        });

        await db.scheduleRule.delete({ where: { id } });

        revalidatePath('/diary/availability');
        return { success: true };
    } catch (e: any) {
        console.error('[ScheduleRules] deleteScheduleRule error:', e);
        return { success: false, error: e.message || 'Ошибка при удалении правила' };
    }
}

/**
 * Clone a schedule rule: copies all its slots with new date range.
 */
export async function cloneScheduleRule(id: string, data: {
    name: string;
    startDate: string;
    endDate: string;
}) {
    try {
        const psychologistId = await getPsychologistId();

        const existing = await db.scheduleRule.findUnique({
            where: { id },
            include: { slots: true },
        });

        if (!existing || existing.psychologistId !== psychologistId) {
            throw new Error('Unauthorized');
        }

        if (existing.slots.length === 0) {
            throw new Error('Нечего клонировать — правило не содержит слотов');
        }

        const newStart = new Date(data.startDate);
        const newEnd = new Date(data.endDate);

        if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
            throw new Error('Некорректные даты');
        }

        // Pick next available color
        const allRules = await db.scheduleRule.findMany({
            where: { psychologistId },
            select: { color: true },
        });
        const usedColors = new Set(allRules.map(r => r.color));
        const color = RULE_COLORS.find(c => !usedColors.has(c)) || existing.color || RULE_COLORS[0];

        // Create new rule
        const newRule = await db.scheduleRule.create({
            data: {
                psychologistId,
                name: data.name,
                color,
                priority: existing.priority,
            },
        });

        // Clone slots
        for (const slot of existing.slots) {
            await db.availabilitySlot.create({
                data: {
                    psychologistId,
                    dayOfWeek: slot.dayOfWeek,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    duration: slot.duration,
                    format: slot.format,
                    addressId: slot.addressId,
                    isRecurring: slot.isRecurring,
                    startDate: newStart,
                    endDate: newEnd,
                    isActive: true,
                    scheduleRuleId: newRule.id,
                },
            });
        }

        revalidatePath('/diary/availability');
        return { success: true, data: newRule };
    } catch (e: any) {
        console.error('[ScheduleRules] cloneScheduleRule error:', e);
        return { success: false, error: e.message || 'Ошибка при клонировании правила' };
    }
}

/**
 * Migrate orphan slots (those without a scheduleRuleId) to a default rule.
 * Creates a "Основное расписание" rule and assigns all unlinked slots.
 */
export async function migrateOrphanSlots() {
    try {
        const psychologistId = await getPsychologistId();

        // Count orphan slots
        const orphanCount = await db.availabilitySlot.count({
            where: { psychologistId, scheduleRuleId: null, isActive: true },
        });

        if (orphanCount === 0) {
            return { success: true, migrated: 0 };
        }

        // Check if there's already a default rule
        let defaultRule = await db.scheduleRule.findFirst({
            where: { psychologistId, name: 'Основное расписание' },
        });

        if (!defaultRule) {
            defaultRule = await db.scheduleRule.create({
                data: {
                    psychologistId,
                    name: 'Основное расписание',
                    color: RULE_COLORS[0],
                    priority: 0,
                },
            });
        }

        // Assign orphan slots
        const result = await db.availabilitySlot.updateMany({
            where: { psychologistId, scheduleRuleId: null },
            data: { scheduleRuleId: defaultRule.id },
        });

        revalidatePath('/diary/availability');
        return { success: true, migrated: result.count, ruleId: defaultRule.id };
    } catch (e: any) {
        console.error('[ScheduleRules] migrateOrphanSlots error:', e);
        // Silent failure — table may not exist yet pre-migration
        return { success: true, migrated: 0 };
    }
}
