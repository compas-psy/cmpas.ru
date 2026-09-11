// Адреса документов берутся у консент-центра, а не хранятся копией.
//
// Проверяется не разбор JSON, а поведение на отказе. Экран входа — то место,
// где «сторонний сервис не ответил» не имеет права превратиться в «страница
// не открылась» или в «ссылок больше нет». И обратное: выдуманного адреса
// у документа, которого в реестре нет, быть не должно.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ISSUER = 'https://auth.cmpas.ru';

function ok(documents: unknown[]) {
    return vi.fn(async () => ({ ok: true, json: async () => ({ documents }) }) as never);
}

describe('fetchSimpasIdLegalLinks', () => {
    beforeEach(() => {
        vi.resetModules();
        process.env.SIMPASID_ISSUER = ISSUER;
    });
    afterEach(() => {
        delete process.env.SIMPASID_ISSUER;
    });

    it('берёт действующую редакцию из реестра, а не из константы', async () => {
        const { fetchSimpasIdLegalLinks } = await import('../src/lib/auth/simpasid-legal');
        const links = await fetchSimpasIdLegalLinks(ok([
            { document_code: 'cmpas_terms', url: '/legal/terms/0.9' },
            { document_code: 'cmpas_privacy', url: '/legal/privacy/0.9' },
            { document_code: 'cmpas_practice_terms', url: '/legal/practice-terms/0.9' },
        ]));

        expect(links.terms).toBe(`${ISSUER}/legal/terms/0.9`);
        expect(links.privacy).toBe(`${ISSUER}/legal/privacy/0.9`);
        expect(links.practiceTerms).toBe(`${ISSUER}/legal/practice-terms/0.9`);
    });

    it('абсолютный адрес не ломает — разворачивается сам в себя', async () => {
        const { fetchSimpasIdLegalLinks } = await import('../src/lib/auth/simpasid-legal');
        const links = await fetchSimpasIdLegalLinks(ok([
            { document_code: 'cmpas_terms', url: 'https://auth.cmpas.ru/legal/terms/1.0' },
        ]));
        expect(links.terms).toBe('https://auth.cmpas.ru/legal/terms/1.0');
    });

    // ГЛАВНОЕ ЗДЕСЬ.
    it('консент-центр не ответил — ссылки остаются, ведут на наши страницы', async () => {
        const { fetchSimpasIdLegalLinks, FALLBACK_LEGAL_LINKS } = await import('../src/lib/auth/simpasid-legal');
        const dead = vi.fn(async () => { throw new Error('ECONNREFUSED'); });

        await expect(fetchSimpasIdLegalLinks(dead as never)).resolves.toEqual(FALLBACK_LEGAL_LINKS);
    });

    it('ответил отказом — то же самое, без исключения наружу', async () => {
        const { fetchSimpasIdLegalLinks, FALLBACK_LEGAL_LINKS } = await import('../src/lib/auth/simpasid-legal');
        const refused = vi.fn(async () => ({ ok: false, json: async () => ({}) }) as never);

        await expect(fetchSimpasIdLegalLinks(refused)).resolves.toEqual(FALLBACK_LEGAL_LINKS);
    });

    // Особые условия и центральные тексты публикуются в разные дни: отсутствие
    // одного не должно уносить остальные.
    it('Особых условий в реестре нет — null, но соглашение и политика на месте', async () => {
        const { fetchSimpasIdLegalLinks } = await import('../src/lib/auth/simpasid-legal');
        const links = await fetchSimpasIdLegalLinks(ok([
            { document_code: 'cmpas_terms', url: '/legal/terms/0.9' },
            { document_code: 'cmpas_privacy', url: '/legal/privacy/0.9' },
        ]));

        expect(links.practiceTerms).toBeNull();
        expect(links.terms).toBe(`${ISSUER}/legal/terms/0.9`);
    });

    it('единый вход не настроен — в сеть не ходим вовсе', async () => {
        delete process.env.SIMPASID_ISSUER;
        const { fetchSimpasIdLegalLinks, FALLBACK_LEGAL_LINKS } = await import('../src/lib/auth/simpasid-legal');
        const spy = vi.fn();

        await expect(fetchSimpasIdLegalLinks(spy as never)).resolves.toEqual(FALLBACK_LEGAL_LINKS);
        expect(spy).not.toHaveBeenCalled();
    });
});
