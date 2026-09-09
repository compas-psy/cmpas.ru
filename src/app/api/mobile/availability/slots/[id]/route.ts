/**
 * Одно окно расписания из приложения: правка и удаление.
 *
 * Идентификатор в адресе — не разрешение (Task 1): и правка, и удаление
 * сужены по специалисту внутри ядра, поэтому чужое окно отвечает «не
 * найдено», а не «нельзя», и по ответу их не различить.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { updateSlotFor, deleteSlotFor } from '@/lib/practice/availability-core';

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    const { id } = await params;
    try {
        const body = await req.json();
        await updateSlotFor(auth.userId, id, {
            startTime: String(body.startTime ?? ''),
            endTime: String(body.endTime ?? ''),
            duration: body.duration ? Number(body.duration) : undefined,
            format: body.format ? String(body.format) : undefined,
            addressId: body.addressId ? String(body.addressId) : null,
        });
        return NextResponse.json({ ok: true });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Не удалось обновить окно';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    const { id } = await params;
    const removed = await deleteSlotFor(auth.userId, id);
    // Ноль — это чужое или уже удалённое окно. Для приложения разница
    // несущественна: в обоих случаях его на экране быть не должно.
    return NextResponse.json({ removed });
}
