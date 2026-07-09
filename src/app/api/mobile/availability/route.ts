import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const [settings, rules, slots, blocks] = await Promise.all([
            db.psychologistSettings.findUnique({
                where: { psychologistId: auth.userId },
                select: { scheduleMode: true, bookingBufferHours: true, bookingHorizonDays: true, cancellationHours: true },
            }),
            db.scheduleRule.findMany({
                where: { psychologistId: auth.userId },
                orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
                take: 50,
            }),
            db.availabilitySlot.findMany({
                where: { psychologistId: auth.userId, isActive: true },
                orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
                take: 200,
            }),
            db.diaryBlock.findMany({
                where: { psychologistId: auth.userId, date: { gte: new Date() } },
                orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
                take: 50,
            }),
        ]);

        return NextResponse.json({
            scheduleMode: settings?.scheduleMode || 'private',
            bookingBufferHours: settings?.bookingBufferHours ?? 24,
            bookingHorizonDays: settings?.bookingHorizonDays ?? 14,
            cancellationHours: settings?.cancellationHours ?? 24,
            rules: rules.map((rule) => ({
                id: rule.id,
                name: rule.name,
                priority: rule.priority,
                isActive: rule.isActive,
                color: rule.color,
                format: rule.format,
                duration: rule.duration,
                breakDuration: rule.breakDuration,
                audienceFilter: rule.audienceFilter,
                startDate: rule.startDate?.toISOString().split('T')[0] || null,
                endDate: rule.endDate?.toISOString().split('T')[0] || null,
            })),
            slots: slots.map((slot) => ({
                id: slot.id,
                ruleId: slot.scheduleRuleId,
                dayOfWeek: slot.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
                duration: slot.duration ?? 50,
                format: slot.format || 'online',
                addressId: slot.addressId,
            })),
            blocks: blocks.map((block) => ({
                id: block.id,
                date: block.date.toISOString().split('T')[0],
                startTime: block.startTime,
                endTime: block.endTime,
                type: block.type,
                reason: block.reason,
            })),
        });
    } catch (error) {
        console.error('[mobile/availability GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
