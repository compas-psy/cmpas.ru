// Извлечение имени клиента из заголовка календарного события.
// Цель: найти повторяющиеся имена в прошлых событиях, чтобы предложить их как клиентов.
// Осознанно эвристический: точность > полнота. Лучше пропустить событие, чем создать "Планёрку" как клиента.

const STOP_WORDS = new Set([
    'планерка', 'планёрка', 'zoom', 'zoom-встреча', 'звонок', 'созвон',
    'обед', 'lunch', 'перерыв', 'break', 'отпуск', 'vacation',
    'встреча', 'meeting', 'супервизия', 'личная терапия', 'группа',
    'интервизия', 'обучение', 'вебинар', 'конференция',
    'врач', 'стоматолог', 'массаж', 'фитнес', 'тренировка',
    'телеграм', 'telegram', 'max', 'google meet', 'teams',
    'sync', 'daily', 'standup', 'review',
    'free', 'busy', 'занято',
]);

const PREFIXES = [
    /^сесси[яи]\s+с?\s*/i,
    /^сесси[яи]:\s*/i,
    /^встреча\s+с\s+/i,
    /^консультаци[яи]\s+/i,
    /^терапи[яи]\s+/i,
    /^приём\s+/i,
    /^прием\s+/i,
    /^клиент[:]?\s+/i,
    /^session\s+with\s+/i,
    /^session[:]?\s+/i,
    /^meeting\s+with\s+/i,
    /^appointment\s+/i,
];

function stripPrefix(s: string): string {
    let result = s;
    for (const prefix of PREFIXES) {
        result = result.replace(prefix, '');
    }
    return result.trim();
}

function stripTrailingTime(s: string): string {
    // Убираем "19:00", "19.00", "в 19", "10:30-11:20"
    return s
        .replace(/\s*\d{1,2}[:.]\d{2}(\s*[-–]\s*\d{1,2}[:.]\d{2})?\s*$/i, '')
        .replace(/\s*в\s+\d{1,2}(:\d{2})?\s*$/i, '')
        .trim();
}

function normalizeForKey(name: string): string {
    return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function extractClientNameFromSummary(summary: string | null | undefined): string | null {
    if (!summary) return null;
    let s = summary.trim();
    if (!s) return null;

    s = stripPrefix(s);
    s = stripTrailingTime(s);
    // Убираем скобки с комментариями
    s = s.replace(/\([^)]*\)/g, '').trim();
    // Убираем эмодзи (примитивно)
    s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();

    if (s.length < 2) return null;

    const lower = normalizeForKey(s);
    if (STOP_WORDS.has(lower)) return null;

    // Если начинается со стоп-слова + пробел — тоже отбрасываем
    for (const stop of STOP_WORDS) {
        if (lower.startsWith(stop + ' ') || lower === stop) return null;
    }

    // Считаем слова, начинающиеся с заглавной (ру или лат)
    const words = s.split(/\s+/).filter(w => w.length > 0);
    const capitalizedWords = words.filter(w => /^[A-ZА-ЯЁ]/.test(w));

    // Если нет ни одного слова с заглавной → это, скорее всего, обычный текст, не имя
    if (capitalizedWords.length === 0) return null;

    // Берём первые 1-2 слова с заглавной подряд (Имя или Имя Фамилия)
    const result: string[] = [];
    for (const w of words) {
        if (/^[A-ZА-ЯЁ][a-zа-яё-]*$/.test(w)) {
            result.push(w);
            if (result.length >= 2) break;
        } else if (result.length > 0) {
            break;
        }
    }

    if (result.length === 0) return null;
    const final = result.join(' ');
    if (final.length < 2) return null;
    if (STOP_WORDS.has(normalizeForKey(final))) return null;

    return final;
}

export type CandidateClient = {
    name: string;
    count: number;
    lastDate: Date;
};

export function aggregateCandidates(
    events: { summary: string; start: Date; end: Date }[],
    minCount = 2
): CandidateClient[] {
    const map = new Map<string, CandidateClient>();

    for (const ev of events) {
        const name = extractClientNameFromSummary(ev.summary);
        if (!name) continue;
        const key = normalizeForKey(name);
        const existing = map.get(key);
        if (existing) {
            existing.count++;
            if (ev.start > existing.lastDate) existing.lastDate = ev.start;
        } else {
            map.set(key, { name, count: 1, lastDate: ev.start });
        }
    }

    return Array.from(map.values())
        .filter(c => c.count >= minCount)
        .sort((a, b) => b.count - a.count);
}
