/**
 * Verifies the MAX connect link signature server-side.
 * Called by the /diary/max-connect client page.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

// Подписывающий секрет обязателен. Значения по умолчанию быть не может:
// код репозитория публичен, и любая захардкоженная строка здесь означает,
// что кто угодно может подделать ссылку привязки MAX к чужому кабинету.
//
// Проверка живёт ВНУТРИ обработчика, а не на уровне модуля. Сборка Next.js
// вычисляет модуль, чтобы собрать данные страницы, и переменных окружения
// у неё нет — исключение на уровне модуля роняет сборку образа целиком.
// Именно так 18.08 встали все выкладки на бой.
function linkSecret(): string | null {
    return process.env.MAX_LINK_SECRET || process.env.AUTH_SECRET || null;
}

export async function POST(request: NextRequest) {
    const LINK_SECRET = linkSecret();
    if (!LINK_SECRET) {
        console.error('[max/verify] MAX_LINK_SECRET или AUTH_SECRET не задан: проверять подпись нечем.');
        return NextResponse.json({ valid: false }, { status: 500 });
    }

    const { mid, exp, sig } = await request.json();

    if (!mid || !exp || !sig) {
        return NextResponse.json({ valid: false });
    }

    const payload = `${mid}:${exp}`;
    const expected = createHmac('sha256', LINK_SECRET).update(payload).digest('hex');

    return NextResponse.json({ valid: expected === sig });
}
