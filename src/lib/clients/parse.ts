// Парсер "сырого" списка клиентов, вставляемого психологом.
// Формат: одна строка — один клиент. Поля разделены запятой / точкой с запятой / табом.
// Поля автоопределяются: email по "@", телефон по цифрам (≥7), остальное — имя.

export type ParsedClient = {
    name: string;
    phone?: string;
    email?: string;
    raw: string;
    valid: boolean;
    error?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Телефон: допускаем +, цифры, пробелы, скобки, тире — требуем минимум 7 цифр.
const PHONE_CHARS_RE = /^[\d\s+\-()]+$/;

function looksLikePhone(token: string): boolean {
    if (!PHONE_CHARS_RE.test(token)) return false;
    const digits = token.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
}

function normalizePhone(token: string): string {
    const digits = token.replace(/\D/g, '');
    if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
        return '+7' + digits.slice(1);
    }
    if (digits.length === 10) return '+7' + digits;
    if (token.trim().startsWith('+')) return '+' + digits;
    return digits;
}

function splitLine(line: string): string[] {
    // Разделители: ; , \t | или два+ пробелов
    return line
        .split(/[;,|\t]+| {2,}/)
        .map(s => s.trim())
        .filter(Boolean);
}

export function parseClientLine(raw: string): ParsedClient {
    const line = raw.trim();
    if (!line) {
        return { name: '', raw, valid: false, error: 'пустая строка' };
    }

    const parts = splitLine(line);
    let name = '';
    let phone: string | undefined;
    let email: string | undefined;
    const nameParts: string[] = [];

    for (const part of parts) {
        if (!email && EMAIL_RE.test(part)) {
            email = part.toLowerCase();
            continue;
        }
        if (!phone && looksLikePhone(part)) {
            phone = normalizePhone(part);
            continue;
        }
        nameParts.push(part);
    }

    // Если не нашли явных разделителей — пробуем выдернуть телефон/email из целой строки
    if (!phone) {
        const phoneMatch = line.match(/(\+?\d[\d\s\-()]{6,}\d)/);
        if (phoneMatch && looksLikePhone(phoneMatch[1])) {
            phone = normalizePhone(phoneMatch[1]);
        }
    }
    if (!email) {
        const emailMatch = line.match(/([^\s,;]+@[^\s,;]+\.[^\s,;]+)/);
        if (emailMatch) email = emailMatch[1].toLowerCase();
    }

    if (nameParts.length > 0) {
        name = nameParts.join(' ').trim();
    } else {
        // Если разделителей не было — имя = всё, что осталось после выдёргивания phone/email
        let rest = line;
        if (phone) rest = rest.replace(/(\+?\d[\d\s\-()]{6,}\d)/, '');
        if (email) rest = rest.replace(/([^\s,;]+@[^\s,;]+\.[^\s,;]+)/, '');
        name = rest.replace(/[,;|\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    if (!name || name.length < 2) {
        return { name: '', phone, email, raw, valid: false, error: 'не распознано имя' };
    }

    return { name, phone, email, raw, valid: true };
}

export function parseClientLines(text: string): ParsedClient[] {
    return text
        .split(/\r?\n/)
        .map(parseClientLine)
        .filter(p => p.raw.trim().length > 0);
}
