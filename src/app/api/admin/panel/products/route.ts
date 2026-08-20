import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requirePanelAdmin } from '@/lib/panel/auth';
import { screenTag } from '@/lib/panel/cache';
import { screen } from '@/lib/panel/build';
import { isProductKey } from '@/lib/panel/screens';
import { screenFailure } from '../handler';

export const dynamic = 'force-dynamic';

/** `?product=practice|zapiski|momenty` — закрытый словарь, не свободный срез. */
export async function GET(request: Request) {
    const denied = await requirePanelAdmin();
    if (denied) return denied.response;

    // Разбираем адрес сами, а не через `nextUrl`: обработчик обязан работать
    // с обычным Request — так его можно вызвать и из теста, и из рантайма.
    const raw = new URL(request.url).searchParams.get('product') ?? 'practice';
    if (!isProductKey(raw)) {
        return NextResponse.json({ error: 'unknown_product', product: raw }, { status: 400 });
    }

    try {
        return NextResponse.json(await screen('products', raw));
    } catch (error) {
        return screenFailure('products', error);
    }
}

export async function POST() {
    const denied = await requirePanelAdmin();
    if (denied) return denied.response;

    revalidateTag(screenTag('products'), 'max');
    return NextResponse.json({ revalidated: 'products' });
}
