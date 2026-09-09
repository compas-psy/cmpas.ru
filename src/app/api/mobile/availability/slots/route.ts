/**
 * Рабочие часы из приложения: POST /api/mobile/availability/slots
 *
 * До этого мобильный API умел расписание только ЧИТАТЬ, и экран честно
 * отправлял человека в веб: «Тонкая настройка правил — в веб-кабинете».
 * Практик с телефоном в руках не мог поправить часы вторника.
 *
 * Правила не переписаны заново: они в src/lib/practice/availability-core.ts,
 * и веб-действие зовёт ровно их же. Копия проверки пересечений разошлась бы
 * молча — и разошлась бы там, где это стоит человеку потерянного или
 * задвоенного часа.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { createSlotsFor } from '@/lib/practice/availability-core';

export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const body = await req.json();
        const created = await createSlotsFor(auth.userId, {
            startDate: String(body.startDate ?? ''),
            endDate: String(body.endDate ?? body.startDate ?? ''),
            daysOfWeek: Array.isArray(body.daysOfWeek) ? body.daysOfWeek.map(Number) : [],
            startTime: String(body.startTime ?? ''),
            endTime: String(body.endTime ?? ''),
            duration: body.duration ? Number(body.duration) : undefined,
            hasLunch: Boolean(body.hasLunch),
            lunchStart: body.lunchStart ? String(body.lunchStart) : undefined,
            lunchEnd: body.lunchEnd ? String(body.lunchEnd) : undefined,
            format: body.format ? String(body.format) : undefined,
            addressId: body.addressId ? String(body.addressId) : null,
            scheduleRuleId: body.scheduleRuleId ? String(body.scheduleRuleId) : null,
        });
        return NextResponse.json({ created });
    } catch (e) {
        // Сообщение ядра адресовано человеку («Расписание пересекается с
        // существующим: Вт 10:00–18:00») и должно доехать до экрана целиком:
        // подменить его на «Ошибка» значит отнять у практика единственную
        // подсказку, что именно мешает сохранить.
        const message = e instanceof Error ? e.message : 'Не удалось сохранить окно';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
