// ПРАКТИКА · CJM записи, ТЗ 29.08.2026 §5.1: человекочитаемый адрес записи
// (/u/<slug>, /у/<slug>) вместо голого psychologistId в ссылках. Эти тесты
// проверяют PsychologistSlug-функции из src/lib/booking/slug.ts:
// транслитерацию, разрешение коллизий, резолвинг слага (текущего и
// исторического) к psychologistId, и то, что смена адреса не ломает уже
// разосланные ссылки на старый слаг.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
    psychologistSlug: {
        findFirst: vi.fn(),
        create: vi.fn(),
    },
    user: {
        findUnique: vi.fn(),
    },
}));
vi.mock('@/lib/db', () => ({ db }));

vi.mock('@/lib/client-workflow', () => ({
    publicBaseUrl: () => 'https://cmpas.ru',
}));

const {
    transliterate,
    slugify,
    cyrillicSlugify,
    ensurePsychologistSlug,
    resolvePsychologistIdBySlug,
    getPsychologistBookingUrl,
} = await import('@/lib/booking/slug');

beforeEach(() => {
    vi.clearAllMocks();
});

describe('transliterate / slugify', () => {
    it('translit по явной таблице: "Анна Волкова" → "anna-volkova"', () => {
        expect(transliterate('Анна Волкова')).toBe('anna volkova');
        expect(slugify('Анна Волкова')).toBe('anna-volkova');
    });

    it('ё→e, й→i, х→h, ц→ts, ч→ch, ш→sh, щ→sch, ъ/ь отбрасываются, ю→yu, я→ya', () => {
        expect(slugify('Щёкина Хачатурьян')).toBe('schekina-hachaturyan');
    });

    it('lowercase, пробелы → дефис, всё вне [a-z0-9-] вырезается, дефисы схлопываются', () => {
        expect(slugify('  Иван   Петров!!! ')).toBe('ivan-petrov');
    });

    it('cyrillicSlugify сохраняет кириллицу вместо транслита', () => {
        expect(cyrillicSlugify('Анна Волкова')).toBe('анна-волкова');
    });
});

describe('ensurePsychologistSlug', () => {
    it('возвращает уже существующий текущий слаг, не трогая БД на запись', async () => {
        db.psychologistSlug.findFirst.mockResolvedValueOnce({ slug: 'anna-volkova', slugCyrillic: 'анна-волкова' });

        const result = await ensurePsychologistSlug('psy-1');

        expect(result).toEqual({ slug: 'anna-volkova', slugCyrillic: 'анна-волкова' });
        expect(db.psychologistSlug.create).not.toHaveBeenCalled();
    });

    it('создаёт слаг из fullName при первом обращении', async () => {
        db.psychologistSlug.findFirst
            .mockResolvedValueOnce(null) // no existing current slug
            .mockResolvedValueOnce(null) // 'anna-volkova' free
            .mockResolvedValueOnce(null); // 'анна-волкова' free
        db.user.findUnique.mockResolvedValueOnce({
            name: 'Anna V',
            psychologistSettings: { fullName: 'Анна Волкова' },
        });
        db.psychologistSlug.create.mockImplementationOnce(({ data }: any) => Promise.resolve({
            slug: data.slug,
            slugCyrillic: data.slugCyrillic,
        }));

        const result = await ensurePsychologistSlug('psy-1');

        expect(result).toEqual({ slug: 'anna-volkova', slugCyrillic: 'анна-волкова' });
        expect(db.psychologistSlug.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                psychologistId: 'psy-1',
                slug: 'anna-volkova',
                slugCyrillic: 'анна-волкова',
                isCurrent: true,
            }),
        }));
    });

    it('коллизия: "anna-volkova" занят другим специалистом → вторая Анна Волкова получает "anna-volkova-2"', async () => {
        db.psychologistSlug.findFirst
            .mockResolvedValueOnce(null) // no existing current slug for psy-2
            .mockResolvedValueOnce({ id: 'row-taken' }) // 'anna-volkova' taken
            .mockResolvedValueOnce(null) // 'anna-volkova-2' free
            .mockResolvedValueOnce({ id: 'row-taken-cyr' }) // 'анна-волкова' taken
            .mockResolvedValueOnce(null); // 'анна-волкова-2' free
        db.user.findUnique.mockResolvedValueOnce({
            name: null,
            psychologistSettings: { fullName: 'Анна Волкова' },
        });
        db.psychologistSlug.create.mockImplementationOnce(({ data }: any) => Promise.resolve({
            slug: data.slug,
            slugCyrillic: data.slugCyrillic,
        }));

        const result = await ensurePsychologistSlug('psy-2');

        expect(result.slug).toBe('anna-volkova-2');
        expect(result.slugCyrillic).toBe('анна-волкова-2');
    });

    it('без fullName и name падает на дефолтное имя "Специалист"', async () => {
        db.psychologistSlug.findFirst
            .mockResolvedValueOnce(null) // no existing current slug
            .mockResolvedValueOnce(null) // latin base free
            .mockResolvedValueOnce(null); // cyrillic base free
        db.user.findUnique.mockResolvedValueOnce({ name: null, psychologistSettings: null });
        db.psychologistSlug.create.mockImplementationOnce(({ data }: any) => Promise.resolve({
            slug: data.slug,
            slugCyrillic: data.slugCyrillic,
        }));

        const result = await ensurePsychologistSlug('psy-3');
        expect(result.slug).toBe(slugify('Специалист'));
        expect(result.slugCyrillic).toBe(cyrillicSlugify('Специалист'));
    });
});

describe('resolvePsychologistIdBySlug — текущий и исторический адрес (§5.1)', () => {
    it('резолвит одинаковый psychologistId и по латинскому, и по кириллическому слагу', async () => {
        db.psychologistSlug.findFirst.mockResolvedValue({ psychologistId: 'psy-1' });

        const byLatin = await resolvePsychologistIdBySlug('anna-volkova');
        const byCyrillic = await resolvePsychologistIdBySlug('анна-волкова');

        expect(byLatin).toBe('psy-1');
        expect(byCyrillic).toBe('psy-1');
    });

    it('смена адреса (старую строку isCurrent=false, новую isCurrent=true) не ломает резолвинг по старому слагу', async () => {
        // resolvePsychologistIdBySlug matches on the slug string across ALL
        // rows (no isCurrent filter) — a previously-sent link keeps working.
        const rows = [
            { slug: 'anna-volkova', slugCyrillic: 'анна-волкова', psychologistId: 'psy-1', isCurrent: false },
            { slug: 'anna-ivanova', slugCyrillic: 'анна-иванова', psychologistId: 'psy-1', isCurrent: true },
        ];
        db.psychologistSlug.findFirst.mockImplementation(({ where }: any) => {
            const candidates = where.OR.map((c: any) => c.slug ?? c.slugCyrillic);
            const row = rows.find(r => candidates.includes(r.slug) || candidates.includes(r.slugCyrillic));
            return Promise.resolve(row ? { psychologistId: row.psychologistId } : null);
        });

        const viaOldSlug = await resolvePsychologistIdBySlug('anna-volkova');
        const viaNewSlug = await resolvePsychologistIdBySlug('anna-ivanova');

        expect(viaOldSlug).toBe('psy-1');
        expect(viaNewSlug).toBe('psy-1');
    });

    it('неизвестный слаг → null (не бросает исключение)', async () => {
        db.psychologistSlug.findFirst.mockResolvedValue(null);
        expect(await resolvePsychologistIdBySlug('nobody-here')).toBeNull();
    });

    it('пустая строка → null без обращения к БД', async () => {
        expect(await resolvePsychologistIdBySlug('')).toBeNull();
        expect(db.psychologistSlug.findFirst).not.toHaveBeenCalled();
    });
});

describe('getPsychologistBookingUrl', () => {
    it('возвращает /u/<slug> когда слаг есть/создан', async () => {
        db.psychologistSlug.findFirst.mockResolvedValueOnce({ slug: 'anna-volkova', slugCyrillic: null });
        const url = await getPsychologistBookingUrl('psy-1');
        expect(url).toBe('https://cmpas.ru/u/anna-volkova');
    });

    it('падает обратно на /bot/book/<id>, если резолвинг слага упал', async () => {
        db.psychologistSlug.findFirst.mockRejectedValueOnce(new Error('db down'));
        const url = await getPsychologistBookingUrl('psy-1');
        expect(url).toBe('https://cmpas.ru/bot/book/psy-1');
    });
});
