// Задача 19 — подсказки адресов DaData.
//
// Прокси существует, чтобы токен DaData не уезжал в браузер, но сам прокси до
// сих пор был открытой дверью: без авторизации, без ограничения частоты, без
// проверки запроса и без таймаута. Подсказки DaData платные и считаются по
// запросам — открытый эндпоинт это чужой счёт, который любой может тратить.
//
// Здесь собран весь разбор: маршрут остаётся тонким адаптером (кто спрашивает),
// а условия обращения к внешнему сервису — тут, где их видно и можно проверить
// тестом без Next.
//
// Принцип деградации: подсказки — удобство, а не обязательное условие. Поле
// адреса остаётся рабочим при любой неудаче. Но НЕ МОЛЧА: причина неудачи
// доходит до вызывающего (reason), маршрут превращает её в честный код
// ответа, а человек видит, что подсказок сейчас нет. Пустой список — это
// «ничего не нашли», и путать его с «сервис недоступен» нельзя: в первом
// случае адрес просто редкий, во втором сломана интеграция, и молчание о ней
// означает, что о поломке узнают через месяцы.

const DADATA_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address';

/** Короче трёх символов подсказка бессмысленна — и это лишний платный запрос. */
export const MIN_QUERY_LENGTH = 3;
/**
 * Длиннее любого реального адреса. Такой запрос отклоняется целиком, а не
 * обрезается: молча искать по обрезку — значит отвечать не на то, о чём
 * спросили, и выдавать это за результат.
 */
export const MAX_QUERY_LENGTH = 200;

const RATE_LIMIT_WINDOW_MS = 60_000;
/** Живой набор адреса — это ~10 запросов после дебаунса; 60 в минуту с запасом. */
const RATE_LIMIT_MAX_HITS = 60;

const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 500;

const REQUEST_TIMEOUT_MS = 4_000;

export type AddressSuggestion = {
    value: string;
    data: {
        fias_id?: string;
        city?: string;
        street?: string;
        house?: string;
        block?: string;
        region?: string;
    };
};

type CacheEntry = { at: number; suggestions: AddressSuggestion[] };

export const defaultRateLimitStore = new Map<string, number[]>();
export const defaultSuggestionCache = new Map<string, CacheEntry>();

/**
 * Ограничение частоты на специалиста, а не на IP: платит владелец ключа, и
 * считать надо тому, кто расходует. В памяти процесса — задача притупить
 * одного разошедшегося клиента, а не быть точным счётчиком на нескольких
 * инстансах.
 */
export function isRateLimited(
    userId: string,
    now: number,
    store: Map<string, number[]> = defaultRateLimitStore,
): boolean {
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    const hits = (store.get(userId) ?? []).filter(hit => hit > cutoff);
    hits.push(now);
    store.set(userId, hits);
    return hits.length > RATE_LIMIT_MAX_HITS;
}

/** Нормализация запроса: тот же адрес разным регистром — один и тот же запрос. */
export function normalizeQuery(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const value = raw.replace(/\s+/g, ' ').trim();
    if (value.length < MIN_QUERY_LENGTH) return null;
    if (value.length > MAX_QUERY_LENGTH) return null;
    return value;
}

function cacheKey(query: string) {
    return query.toLowerCase();
}

function readCache(query: string, now: number, cache: Map<string, CacheEntry>): AddressSuggestion[] | null {
    const entry = cache.get(cacheKey(query));
    if (!entry) return null;
    if (now - entry.at > CACHE_TTL_MS) {
        cache.delete(cacheKey(query));
        return null;
    }
    return entry.suggestions;
}

function writeCache(query: string, suggestions: AddressSuggestion[], now: number, cache: Map<string, CacheEntry>) {
    if (cache.size >= CACHE_MAX_ENTRIES) {
        // Простое вытеснение самого старого ключа: кэш экономит платные
        // запросы, а не хранит данные, поэтому точность вытеснения не важна.
        const oldest = cache.keys().next();
        if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(cacheKey(query), { at: now, suggestions });
}

function mapSuggestions(payload: unknown): AddressSuggestion[] {
    const raw = (payload as { suggestions?: unknown })?.suggestions;
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((item): item is { value?: unknown; data?: Record<string, unknown> } => Boolean(item) && typeof item === 'object')
        .map(item => ({
            value: String(item.value ?? ''),
            data: {
                fias_id: asString(item.data?.fias_id),
                city: asString(item.data?.city),
                street: asString(item.data?.street),
                house: asString(item.data?.house),
                block: asString(item.data?.block),
                region: asString(item.data?.region),
            },
        }))
        .filter(item => item.value.length > 0);
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export type SuggestOutcome = {
    suggestions: AddressSuggestion[];
    /**
     * Что именно произошло. Маршрут превращает это в код ответа: пустой
     * список при 'ok' — честное «ничего не нашли», а при 'upstream_error'
     * или 'timeout' — поломка, о которой нужно сказать вслух.
     */
    reason: 'ok' | 'cached' | 'invalid_query' | 'rate_limited' | 'no_token' | 'upstream_error' | 'timeout';
};

export async function suggestAddresses(params: {
    userId: string;
    query: unknown;
    token?: string | null;
    now?: number;
    fetchImpl?: typeof fetch;
    rateLimitStore?: Map<string, number[]>;
    cache?: Map<string, CacheEntry>;
    timeoutMs?: number;
}): Promise<SuggestOutcome> {
    const {
        userId,
        token,
        now = Date.now(),
        fetchImpl = fetch,
        rateLimitStore = defaultRateLimitStore,
        cache = defaultSuggestionCache,
        timeoutMs = REQUEST_TIMEOUT_MS,
    } = params;

    const query = normalizeQuery(params.query);
    // Негодный запрос отсеивается ДО лимита и до внешнего вызова: он не должен
    // ни стоить денег, ни съедать чужую квоту частоты.
    if (!query) return { suggestions: [], reason: 'invalid_query' };

    const cached = readCache(query, now, cache);
    if (cached) return { suggestions: cached, reason: 'cached' };

    if (isRateLimited(userId, now, rateLimitStore)) {
        return { suggestions: [], reason: 'rate_limited' };
    }

    if (!token) return { suggestions: [], reason: 'no_token' };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetchImpl(DADATA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Token ${token}`,
            },
            body: JSON.stringify({ query, count: 7, locations: [{ country: 'Россия' }] }),
            signal: controller.signal,
        });

        if (!res.ok) {
            // Статус — да, тело и запрос — нет: в запросе адрес кабинета
            // специалиста, ему не место в логах.
            console.error('[dadata] upstream responded', res.status);
            return { suggestions: [], reason: 'upstream_error' };
        }

        const suggestions = mapSuggestions(await res.json());
        writeCache(query, suggestions, now, cache);
        return { suggestions, reason: 'ok' };
    } catch (error) {
        const aborted = (error as { name?: string })?.name === 'AbortError';
        console.error('[dadata]', aborted ? 'request timed out' : 'request failed');
        return { suggestions: [], reason: aborted ? 'timeout' : 'upstream_error' };
    } finally {
        clearTimeout(timer);
    }
}
