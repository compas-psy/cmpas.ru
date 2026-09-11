/**
 * Адреса юридических документов — у их владельца, а не у нас.
 *
 * Экран входа показывает три ссылки: Пользовательское соглашение, Политику
 * обработки персональных данных и Особые условия ПРАКТИКИ. Все три живут в
 * консент-центре СИМПАС, и у каждой редакции свой неизменяемый адрес вида
 * `…/legal/terms/0.9`.
 *
 * ПОЧЕМУ НЕ КОНСТАНТЫ. Номер редакции в коде означает, что выход 1.0
 * потребует правки продукта — а до этой правки человек будет читать
 * устаревший текст, ничем не отличимый на вид от действующего. Адрес
 * спрашивается у `GET /v1/legal/documents`, который и знает, какая редакция
 * действует сегодня.
 *
 * ПОЧЕМУ ЕСТЬ ЗАПАСНОЙ ВАРИАНТ. Экран входа не имеет права не открыться
 * из-за недоступности стороннего сервиса. Не ответили за три секунды —
 * ведём на наши прежние страницы: текст там тот же по смыслу, и прочитать
 * документ человек всё равно сможет. Молчаливого исчезновения ссылок не
 * происходит ни в одном случае.
 */

import { simpasIdIssuer } from './simpasid-account';

/** Коды документов в реестре СИМПАС. */
export const LEGAL_TERMS = 'cmpas_terms';
export const LEGAL_PRIVACY = 'cmpas_privacy';
export const LEGAL_PRACTICE_TERMS = 'cmpas_practice_terms';

export type LegalLinks = {
    terms: string;
    privacy: string;
    /** Особые условия ПРАКТИКИ. null — документа в реестре ещё нет. */
    practiceTerms: string | null;
};

/** Наши собственные страницы — пока и если консент-центр недоступен. */
export const FALLBACK_LEGAL_LINKS: LegalLinks = {
    terms: '/legal/terms',
    privacy: '/legal/privacy',
    practiceTerms: null,
};

type RawDocument = {
    document_code?: unknown;
    url?: unknown;
};

/** Адрес редакции приходит относительным — разворачиваем от issuer. */
function absolute(url: string, issuer: string): string {
    try {
        return new URL(url, issuer).toString();
    } catch {
        return url;
    }
}

export async function fetchSimpasIdLegalLinks(
    fetchImpl: typeof fetch = fetch,
): Promise<LegalLinks> {
    const issuer = simpasIdIssuer();
    if (!issuer) return FALLBACK_LEGAL_LINKS;

    try {
        const res = await fetchImpl(new URL('/v1/legal/documents', issuer).toString(), {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(3000),
            cache: 'no-store',
        });
        if (!res.ok) return FALLBACK_LEGAL_LINKS;

        const body = await res.json() as { documents?: RawDocument[] };
        const byCode = new Map<string, string>();
        for (const doc of body.documents ?? []) {
            if (typeof doc.document_code === 'string' && typeof doc.url === 'string' && doc.url) {
                byCode.set(doc.document_code, absolute(doc.url, issuer));
            }
        }

        return {
            // Каждая ссылка падает на свой запасной вариант отдельно: у
            // центральных текстов и у Особых условий разные сроки публикации,
            // и отсутствие одного не должно уносить остальные.
            terms: byCode.get(LEGAL_TERMS) ?? FALLBACK_LEGAL_LINKS.terms,
            privacy: byCode.get(LEGAL_PRIVACY) ?? FALLBACK_LEGAL_LINKS.privacy,
            practiceTerms: byCode.get(LEGAL_PRACTICE_TERMS) ?? null,
        };
    } catch {
        // Молчим намеренно: недоступность консент-центра — это не ошибка
        // входа, и в журнал она попадёт со стороны того, кто её вызвал.
        return FALLBACK_LEGAL_LINKS;
    }
}
