import crypto from 'crypto';

/**
 * Кто именно стучится в POST /ingest — и под каким продуктом ему разрешено
 * слать.
 *
 * Зачем это отдельно от маршрута. ANALYTICS_INGEST_SECRET был один на весь
 * контур: им пользуется мост ЗАПИСОК, им пользуется веб ПРАКТИКИ, и им же
 * предполагалось снабдить МОМЕНТЫ — мобильное приложение, чей APK публикуется
 * в релизах. Секрет внутри публикуемого пакета извлекается из скачанного файла
 * за минуты, поэтому один общий секрет означал бы: публикация приложения
 * публикует ключ от приёма всех трёх продуктов.
 *
 * Теперь секретов несколько, и каждый знает свой список продуктов. Компрометация
 * секрета МОМЕНТОВ даёт возможность слать только события МОМЕНТОВ — не события
 * ПРАКТИКИ и не события ЗАПИСОК.
 *
 * Порядок проверок в маршруте, и он важен:
 *   1) подлинность (эта функция) — до разбора тела, иначе неаутентифицированный
 *      запрос управлял бы разбором;
 *   2) проверка конверта (validateEvent) — испорченный конверт обязан получать
 *      «неверный конверт», а не «не тот продукт»;
 *   3) привязка секрет→продукт (IngestIdentity.allows) — уже зная, что конверт
 *      корректен и какой в нём product.
 */

interface SecretSlot {
    /** Имя переменной окружения. */
    env: string;
    /** Продукты, под которыми этому секрету разрешено слать. */
    products: readonly string[];
}

/**
 * Старый ANALYTICS_INGEST_SECRET остаётся действующим для practice и zapiski —
 * мост ЗАПИСОК и веб ПРАКТИКИ продолжают работать без единой правки у себя.
 *
 * Сужение его до этих двух продуктов ничего работающего не ломает и у МОМЕНТОВ:
 * их клиент (compas-voice, KompasApp.kt) сегодня не шлёт заголовок Authorization
 * вовсе — во всём том репозитории нет ни одного упоминания Bearer или секрета, —
 * то есть все их события уже отвергаются с 401. Новая переменная — то, чем их
 * клиенту предстоит пользоваться, когда он научится слать заголовок.
 */
const SLOTS: readonly SecretSlot[] = [
    { env: 'ANALYTICS_INGEST_SECRET_MOMENTS', products: ['moments'] },
    { env: 'ANALYTICS_INGEST_SECRET', products: ['practice', 'zapiski'] },
];

export interface IngestIdentity {
    /** Имя переменной, чей секрет подошёл — для журналов, не для ответа наружу. */
    readonly slot: string;
    /** Разрешено ли этому секрету слать под таким продуктом. */
    allows(product: string): boolean;
}

/**
 * Постоянное по времени сравнение, устойчивое к разной длине.
 *
 * crypto.timingSafeEqual бросает исключение на буферах разной длины, поэтому
 * сравнивать напрямую нельзя: разница в длине выдала бы себя исключением
 * раньше, чем сравнением. Сводим оба значения к дайджестам фиксированной
 * длины — сравнение всегда идёт над 32 байтами, независимо от входа.
 */
function secretMatches(got: string, want: string): boolean {
    const a = crypto.createHash('sha256').update(got, 'utf8').digest();
    const b = crypto.createHash('sha256').update(want, 'utf8').digest();
    return crypto.timingSafeEqual(a, b);
}

const BEARER = 'Bearer ';

/**
 * Разбирает заголовок Authorization и возвращает права предъявителя.
 *
 * `null` означает отказ — и когда заголовка нет, и когда секрет не подошёл, и
 * когда в окружении не настроен НИ ОДИН секрет. Последнее особенно важно:
 * приёмник fail-closed, отсутствие настройки не открывает его всем (в отличие
 * от TELEGRAM_WEBHOOK_SECRET, который намеренно fail-open, потому что скрипт
 * выкладки его гарантированно генерирует).
 *
 * Все настроенные секреты проверяются до конца, без раннего выхода на первом
 * совпадении: время ответа не должно зависеть от того, какой именно секрет
 * подошёл.
 */
export function resolveIngestIdentity(authorizationHeader: string | null | undefined): IngestIdentity | null {
    if (!authorizationHeader || !authorizationHeader.startsWith(BEARER)) return null;
    const presented = authorizationHeader.slice(BEARER.length);
    if (!presented) return null;

    let matched: SecretSlot | null = null;
    for (const slot of SLOTS) {
        const expected = process.env[slot.env];
        if (!expected) continue;
        if (secretMatches(presented, expected) && matched === null) {
            matched = slot;
        }
    }
    if (!matched) return null;

    const products = matched.products;
    return {
        slot: matched.env,
        allows: (product: string) => products.includes(product),
    };
}

/** Список продуктов, которым разрешён этот секрет — для сообщения об отказе. */
export function productsFor(identity: IngestIdentity): string[] {
    return SLOTS.find((s) => s.env === identity.slot)?.products.slice() ?? [];
}
