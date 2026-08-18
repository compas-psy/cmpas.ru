/**
 * Verifies the MAX connect link signature server-side.
 * Called by the /diary/max-connect client page.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

// Подписывающий секрет обязателен. Значения по умолчанию быть не может:
// код репозитория публичен, и любая захардкоженная строка здесь означает,
// что кто угодно может подделать ссылку привязки MAX к чужому кабинету.
const RAW_LINK_SECRET = process.env.MAX_LINK_SECRET || process.env.AUTH_SECRET;
if (!RAW_LINK_SECRET) {
    throw new Error('MAX_LINK_SECRET или AUTH_SECRET обязателен: подписывать ссылки привязки MAX нечем.');
}
// Явный тип нужен, иначе сужение из проверки выше не доживает до использования
// внутри обработчика запроса, и tsc видит string | undefined.
const LINK_SECRET: string = RAW_LINK_SECRET;

export async function POST(request: NextRequest) {
    const { mid, exp, sig } = await request.json();

    if (!mid || !exp || !sig) {
        return NextResponse.json({ valid: false });
    }

    const payload = `${mid}:${exp}`;
    const expected = createHmac('sha256', LINK_SECRET).update(payload).digest('hex');

    return NextResponse.json({ valid: expected === sig });
}
