/**
 * Разбор vCard до двух полей: имя и телефон.
 *
 * Нужен из-за MAX: вложение contact приходит строкой vcf_info, а не
 * готовыми полями (см. официальный SDK @maxhub/max-bot-api,
 * ContactAttachment). Telegram отдаёт phone_number и first_name прямо в
 * message.contact, там разбирать нечего.
 *
 * Своя реализация, а не зависимость `vcf`: из всего формата нам нужны два
 * свойства, а тянуть в прод библиотеку разбора ради них — лишний вес и
 * лишняя поверхность. Взамен здесь честно обработаны те четыре вещи, на
 * которых ломается наивный разбор и которые реально встречаются в
 * выгрузках телефонов: складывание длинных строк, quoted-printable,
 * параметры у свойства и группы iOS.
 *
 * Умышленно НЕ поддерживается: base64-фото, множественные карточки в одном
 * файле, кодировки кроме UTF-8. Ничего из этого в контакте из мессенджера
 * нам не нужно.
 */

export interface ParsedVCard {
    fullName?: string;
    phone?: string;
}

/**
 * Развернуть сложенные строки. По RFC 6350 длинная строка переносится, и
 * продолжение начинается с пробела или табуляции — их надо приклеить к
 * предыдущей, иначе имя обрежется на середине.
 */
function unfold(text: string): string[] {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const out: string[] = [];
    for (const line of lines) {
        const prev = out.length > 0 ? out[out.length - 1] : undefined;

        if (prev !== undefined && (line.startsWith(' ') || line.startsWith('\t'))) {
            // Перенос и ведущий пробел убираются оба: слово, разорванное
            // переносом, должно снова стать целым.
            out[out.length - 1] = prev + line.slice(1);
            continue;
        }

        // Мягкий перенос quoted-printable — своё правило, не RFC 6350:
        // строка кончается на «=», а продолжение идёт БЕЗ ведущего пробела,
        // поэтому предыдущая ветка его не поймает.
        if (prev !== undefined && prev.endsWith('=') && /QUOTED-PRINTABLE/i.test(prev)) {
            out[out.length - 1] = prev.slice(0, -1) + line;
            continue;
        }

        out.push(line);
    }
    return out;
}

/**
 * Раскодировать quoted-printable. Так пишут старые Android-экспорты: без
 * этого в карточку клиента попадёт «=D0=90=D0=BD=D0=BD=D0=B0» вместо имени.
 * Мягкий перенос — «=» в конце строки — склеивается.
 */
function decodeQuotedPrintable(value: string): string {
    const joined = value.replace(/=\n/g, '').replace(/=$/g, '');
    const bytes: number[] = [];
    for (let i = 0; i < joined.length; i++) {
        if (joined[i] === '=' && i + 2 < joined.length && /^[0-9A-Fa-f]{2}$/.test(joined.slice(i + 1, i + 3))) {
            bytes.push(parseInt(joined.slice(i + 1, i + 3), 16));
            i += 2;
        } else {
            bytes.push(joined.charCodeAt(i));
        }
    }
    try {
        return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    } catch {
        return joined;
    }
}

/** Снять экранирование значений: \, \; \n — по RFC 6350. */
function unescapeValue(value: string): string {
    return value.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}

interface VCardLine {
    /** Имя свойства в верхнем регистре, без группы: FN, N, TEL. */
    name: string;
    /** Параметры в верхнем регистре одной строкой: «TYPE=CELL;ENCODING=QUOTED-PRINTABLE». */
    params: string;
    value: string;
}

function parseLine(raw: string): VCardLine | null {
    const colon = raw.indexOf(':');
    if (colon < 0) return null;

    const head = raw.slice(0, colon);
    let value = raw.slice(colon + 1);

    const parts = head.split(';');
    // iOS пишет свойства с группой: «item1.TEL». Группа нам не нужна.
    const nameWithGroup = parts[0];
    const dot = nameWithGroup.lastIndexOf('.');
    const name = (dot >= 0 ? nameWithGroup.slice(dot + 1) : nameWithGroup).trim().toUpperCase();
    const params = parts.slice(1).join(';').toUpperCase();

    if (params.includes('QUOTED-PRINTABLE')) value = decodeQuotedPrintable(value);

    return { name, params, value };
}

/** «Соколова;Мария;Петровна;;» → «Мария Соколова» — человеческий порядок. */
function nameFromStructured(value: string): string | undefined {
    const [family, given] = value.split(';').map((p) => unescapeValue(p));
    const assembled = [given, family].filter(Boolean).join(' ').trim();
    return assembled || undefined;
}

export function parseVCard(text: string): ParsedVCard {
    if (!text || !text.includes('BEGIN:VCARD')) return {};

    let fullName: string | undefined;
    let structuredName: string | undefined;
    let phone: string | undefined;
    let phoneIsMobile = false;

    for (const raw of unfold(text)) {
        const line = parseLine(raw);
        if (!line) continue;

        if (line.name === 'FN' && !fullName) {
            const value = unescapeValue(line.value);
            if (value) fullName = value;
            continue;
        }

        if (line.name === 'N' && !structuredName) {
            structuredName = nameFromStructured(line.value);
            continue;
        }

        if (line.name === 'TEL') {
            const value = line.value.trim();
            if (!value) continue;
            // Мобильный предпочтительнее: по рабочему городскому в
            // мессенджер не напишешь, а карточке нужен рабочий контакт.
            const isMobile = line.params.includes('CELL') || line.params.includes('MOBILE');
            if (!phone || (isMobile && !phoneIsMobile)) {
                phone = value;
                phoneIsMobile = isMobile;
            }
        }
    }

    const result: ParsedVCard = {};
    const name = fullName || structuredName;
    if (name) result.fullName = name;
    if (phone) result.phone = phone;
    return result;
}
