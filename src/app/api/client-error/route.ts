import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { track } from '@/lib/analytics/track';

/**
 * КУДА ПОПАДАЕТ АВАРИЯ, СЛУЧИВШАЯСЯ В БРАУЗЕРЕ.
 *
 * До 10.09.2026 не попадала никуда. Серверная ошибка оставляет в журнале
 * строку и отпечаток (digest), который человек видит на экране, — по нему
 * авария находится за минуту. Клиентская не оставляла ничего: экран
 * «Страница не открылась» показывался и исчезал, а мы узнавали о нём только
 * если кто-то расскажет.
 *
 * Так и вышло: учредитель сообщил, что в мобильном вебе при клике на клиента
 * возникает ошибка. Воспроизвести не удалось — настоящая база, настоящий
 * браузер на кадре телефона, все вкладки карточки, клиенты без встреч, с
 * отменёнными, с кривой анкетой. Ни одного падения. Спросить было не у чего:
 * следа не осталось.
 *
 * ЧТО СЮДА ПОПАДАЕТ И ЧЕГО НЕ ПОПАДАЕТ. Имя ошибки, её текст, ОДИН верхний
 * кадр стека и путь страницы. Путь — без строки запроса: там ходят
 * идентификаторы клиентов. Текст обрезается и чистится от того, что похоже
 * на почту и на длинные цепочки цифр: сообщение об ошибке иногда несёт
 * значение, а значением бывает телефон. Ни имён, ни сообщений, ни заметок
 * здесь быть не может — их неоткуда взять.
 */

const MAX_TEXT = 300;

/** Почта и длинные цепочки цифр — единственное ПД, что может протечь в текст ошибки. */
function scrub(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw
        .slice(0, MAX_TEXT)
        .replace(/[\w.+-]+@[\w.-]+\.\w+/g, '<почта>')
        .replace(/\d{6,}/g, '<цифры>');
}

/** Путь без строки запроса: в ней ходят идентификаторы клиентов и встреч. */
function scrubPath(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.split(/[?#]/)[0].slice(0, 200);
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ ok: true });

    const report = {
        name: scrub((body as Record<string, unknown>).name) || 'Error',
        message: scrub((body as Record<string, unknown>).message),
        frame: scrub((body as Record<string, unknown>).frame),
        path: scrubPath((body as Record<string, unknown>).path),
        digest: scrub((body as Record<string, unknown>).digest),
    };

    // Строка в журнале — то, ради чего всё это. Читается там же, где серверные.
    console.error('[client-error]', JSON.stringify(report));

    // Событие пишем только когда есть, к какой учётной записи его отнести:
    // device_id без согласия на аналитику мы не пишем (charter/12_ANALYTICS.md §2).
    const session = await auth().catch(() => null);
    const accountId = session?.user?.id;
    if (accountId) {
        await track(db, {
            event: 'web_client_error',
            product: 'practice',
            accountId,
            props: report,
        }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true });
}
