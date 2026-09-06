import { NextRequest, NextResponse } from 'next/server';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import {
    AddressInUseError,
    deactivatePracticeAddress,
    listPracticeAddresses,
    setPrimaryPracticeAddress,
    updatePracticeAddress,
} from '@/lib/practice/addresses';
import { OwnershipError } from '@/lib/practice/ownership';

/**
 * Один кабинет практики (Задача 21).
 *
 * PATCH принимает ровно три вещи: название, адрес и «сделать основным».
 * Никаких произвольных полей: isActive через эту дверь не меняется — вывод из
 * работы это DELETE со своими проверками, а не поле в теле запроса.
 *
 * DELETE — вывод из работы, а не удаление строки. Пока кабинет держат будущие
 * записи или действующие правила расписания, приходит 409 ADDRESS_IN_USE и не
 * меняется ничего: молча переносить чужие зависимости сервер не вправе.
 */

type PatchBody = {
    name?: unknown;
    address?: unknown;
    isPrimary?: unknown;
};

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id } = await params;

    try {
        const body = await req.json().catch(() => null) as PatchBody | null;

        const patch: { name?: string; address?: string } = {};
        if (typeof body?.name === 'string') patch.name = body.name;
        if (typeof body?.address === 'string') patch.address = body.address;
        const makePrimary = body?.isPrimary === true;

        if (Object.keys(patch).length === 0 && !makePrimary) {
            return NextResponse.json({ error: 'NOTHING_TO_UPDATE' }, { status: 400 });
        }
        if (Object.values(patch).some((value) => !value.trim())) {
            return NextResponse.json({ error: 'NAME_AND_ADDRESS_REQUIRED' }, { status: 400 });
        }

        // Порядок не случаен: «сделать основным» проверяет и владение, и то,
        // что кабинет в работе. Сделай это после переименования — и запрос,
        // который целиком отвергнут, успел бы поменять название.
        if (makePrimary) {
            await setPrimaryPracticeAddress(auth.userId, id);
        }
        if (Object.keys(patch).length > 0) {
            await updatePracticeAddress(auth.userId, id, patch);
        }

        // Возвращается список целиком: «основной» — свойство набора, а не
        // строки (его держит PsychologistSettings), поэтому один изменённый
        // кабинет не описывает результат.
        return NextResponse.json({ addresses: await listPracticeAddresses(auth.userId) });
    } catch (error) {
        if (error instanceof OwnershipError) {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        console.error('[mobile/addresses/id PATCH]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    const { id } = await params;

    try {
        await deactivatePracticeAddress(auth.userId, id);
        return NextResponse.json({ addresses: await listPracticeAddresses(auth.userId) });
    } catch (error) {
        if (error instanceof AddressInUseError) {
            return NextResponse.json({
                error: 'ADDRESS_IN_USE',
                message: error.message,
                futureSessions: error.blockers.futureSessions,
                activeSchedule: error.blockers.activeSchedule,
            }, { status: 409 });
        }
        if (error instanceof OwnershipError) {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        console.error('[mobile/addresses/id DELETE]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
