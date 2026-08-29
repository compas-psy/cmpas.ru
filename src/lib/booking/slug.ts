import { db } from '@/lib/db';
import { publicBaseUrl } from '@/lib/client-workflow';

/**
 * §5.1 (O-260829, "ПРАКТИКА · CJM записи: пакетное ТЗ на исправление") —
 * human-readable booking addresses (`/u/<slug>`, `/у/<slug>`) instead of a
 * raw psychologistId in URLs shown to clients. Backed by PsychologistSlug
 * (prisma/schema.prisma) — each row is either the current address or a
 * retired one kept around so already-sent links keep resolving forever.
 */

// Explicit, deterministic table — no transliteration library. Uppercase
// input is lowercased before lookup, so the map only needs lowercase keys.
const CYRILLIC_TO_LATIN: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
    щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** Cyrillic → Latin, char by char. Non-Cyrillic characters pass through untouched. */
export function transliterate(input: string): string {
    let out = '';
    for (const ch of input.toLowerCase()) {
        out += ch in CYRILLIC_TO_LATIN ? CYRILLIC_TO_LATIN[ch] : ch;
    }
    return out;
}

/** "Анна Волкова" → "anna-volkova". Lowercase, transliterated, `[a-z0-9-]` only, collapsed dashes. */
export function slugify(name: string): string {
    const transliterated = transliterate(name.trim());
    const dashed = transliterated.replace(/\s+/g, '-');
    const cleaned = dashed.replace(/[^a-z0-9-]/g, '');
    return cleaned.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/** "Анна Волкова" → "анна-волкова" — same shape as slugify() but keeps Cyrillic, for slugCyrillic. */
export function cyrillicSlugify(name: string): string {
    const lower = name.trim().toLowerCase();
    const dashed = lower.replace(/\s+/g, '-');
    const cleaned = dashed.replace(/[^а-яё0-9-]/g, '');
    return cleaned.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/** Appends -2, -3, ... until `field` (slug or slugCyrillic) is free across all rows. */
async function firstFreeCandidate(base: string, field: 'slug' | 'slugCyrillic'): Promise<string> {
    let candidate = base;
    let n = 2;
    // Bounded by n in practice (namesakes are rare); no artificial cap needed
    // — a DB round-trip per attempt is cheap and this only runs once per
    // psychologist, lazily, the first time their link is needed.
    while (await db.psychologistSlug.findFirst({ where: { [field]: candidate }, select: { id: true } })) {
        candidate = `${base}-${n}`;
        n++;
    }
    return candidate;
}

async function resolveDisplayName(psychologistId: string): Promise<string> {
    const user = await db.user.findUnique({
        where: { id: psychologistId },
        select: { name: true, psychologistSettings: { select: { fullName: true } } },
    });
    return user?.psychologistSettings?.fullName || user?.name || 'Специалист';
}

/**
 * Returns the psychologist's current slug, creating one on first use
 * (lazy assignment — §5.1). Never touches an existing current row: if one
 * is already there it's returned as-is.
 */
export async function ensurePsychologistSlug(psychologistId: string): Promise<{ slug: string; slugCyrillic: string | null }> {
    const existing = await db.psychologistSlug.findFirst({
        where: { psychologistId, isCurrent: true },
        select: { slug: true, slugCyrillic: true },
    });
    if (existing) return existing;

    const displayName = await resolveDisplayName(psychologistId);
    const baseLatin = slugify(displayName) || 'specialist';
    const baseCyrillic = cyrillicSlugify(displayName);

    const slug = await firstFreeCandidate(baseLatin, 'slug');
    const slugCyrillic = baseCyrillic ? await firstFreeCandidate(baseCyrillic, 'slugCyrillic') : null;

    const created = await db.psychologistSlug.create({
        data: { psychologistId, slug, slugCyrillic, isCurrent: true },
        select: { slug: true, slugCyrillic: true },
    });
    return created;
}

/**
 * Resolves a slug (Latin or Cyrillic column, current OR retired — matched
 * across all rows) to a psychologistId. Used by both /u/[slug] and /у/[slug]:
 * an old address never stops working once a specialist changes it.
 */
export async function resolvePsychologistIdBySlug(slug: string): Promise<string | null> {
    if (!slug) return null;
    const row = await db.psychologistSlug.findFirst({
        where: { OR: [{ slug }, { slugCyrillic: slug }] },
        select: { psychologistId: true },
    });
    return row?.psychologistId ?? null;
}

/**
 * Full public booking URL for a psychologist, assigning a slug on first
 * need. Falls back to the old `/bot/book/<id>` form if slug lookup/creation
 * fails for any reason — a working (if less pretty) link beats a broken one.
 */
export async function getPsychologistBookingUrl(psychologistId: string): Promise<string> {
    try {
        const { slug } = await ensurePsychologistSlug(psychologistId);
        if (slug) return `${publicBaseUrl()}/u/${slug}`;
    } catch (e) {
        console.error('[booking/slug] failed to resolve booking URL, falling back to /bot/book/<id>:', e);
    }
    return `${publicBaseUrl()}/bot/book/${psychologistId}`;
}
