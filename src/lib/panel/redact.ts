/**
 * Вычистка свободного текста перед показом на панели (ТЗ §8).
 *
 * На панель не попадает содержимое — ни путей к файлам, ни адресов почты,
 * ни телефонов. Два места дают свободный текст, который панель не сочиняет
 * сама и потому не может проверить на входе:
 *
 *  · `DeployLog.errorNote` — пишет скрипт выкладки, туда легко попадает
 *    путь до файла миграции или до лога;
 *  · сообщение упавшего запроса, которое `guard` кладёт в `reason` —
 *    Prisma охотно вставляет туда фрагмент запроса и значения параметров.
 *
 * Оба показываются администратору, но правило §8 не про уровень доступа,
 * а про то, что содержимого на панели не бывает вовсе.
 */

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const UNIX_PATH = /(?:^|[\s"'(])(\/(?:[\w.-]+\/)*[\w.-]+)/g;
const WINDOWS_PATH = /[A-Za-z]:\\(?:[\w.-]+\\)*[\w.-]+/g;
const PHONE = /(?:\+7|8)[\s(-]?\d{3}[\s)-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g;

/** Сколько текста вообще имеет смысл показывать: дальше это уже дамп. */
const MAX_LENGTH = 200;

export const REDACTED = '<…>';

export function redact(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;

    const cleaned = value
        .replace(EMAIL, REDACTED)
        .replace(PHONE, REDACTED)
        .replace(WINDOWS_PATH, REDACTED)
        // Путь заменяем, сохраняя разделитель перед ним, иначе слова слипаются.
        .replace(UNIX_PATH, (_m, _p1, offset: number) => (offset === 0 ? REDACTED : ` ${REDACTED}`))
        .trim();

    if (!cleaned) return null;
    return cleaned.length > MAX_LENGTH ? `${cleaned.slice(0, MAX_LENGTH)}…` : cleaned;
}
