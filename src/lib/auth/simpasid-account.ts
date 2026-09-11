/**
 * КТО ЭТОТ ЧЕЛОВЕК — ПО КЛЮЧУ ДОСТУПА СИМПАС.
 *
 * В вебе личность приходит обычным OIDC: next-auth сам меняет код на
 * id_token и разбирает его. На телефоне так нельзя — требование СИМПАС
 * (docs/spec/12_NATIVE_AUTH.md) запрещает уводить человека в браузер:
 * приложение, собирающее пароль от чужого сервиса, это готовая схема
 * фишинга, и именно против неё придуман OAuth.
 *
 * Поэтому на мобильном порядок другой: нативный вход отдаёт приложению
 * ключ доступа СИМПАС, приложение приносит его нам, а мы спрашиваем у
 * СИМПАС, чей он. Один вопрос на один вход — дальше живёт своя сессия
 * ПРАКТИКИ, и недоступность единого входа никого не разлогинивает
 * (docs/integration/checklist.md, «Не обращаться к единому входу на
 * каждый запрос»).
 *
 * ПОЧЕМУ ПРОВЕРЯЕМ ПОДТВЕРЖДЁННОСТЬ ПОЧТЫ САМИ. Единый вход
 * неподтверждённую почту не выдаёт, но тот же checklist требует не
 * полагаться на чужую дисциплину: почта — это ключ, по которому мы
 * находим практику человека, и принять её на слово значит отдать чужую
 * практику тому, кто завёл учётную запись на чужой адрес.
 */

/** Незаполненный issuer означает, что вход СИМПАС не настроен вовсе. */
export function simpasIdIssuer(): string | null {
    const raw = process.env.SIMPASID_ISSUER?.trim();
    if (!raw) return null;
    return raw.replace(/\/+$/, '');
}

export interface SimpasIdAccount {
    /** `sub` — постоянный идентификатор человека в СИМПАС. */
    id: string;
    email: string;
    emailVerified: boolean;
    displayName: string | null;
}

export type SimpasIdLookup =
    | { ok: true; account: SimpasIdAccount }
    /** Ключ не признан — отвечаем 401, это не наша поломка. */
    | { ok: false; reason: 'rejected' }
    /** СИМПАС не ответил или ответил непонятным — это уже наша беда. */
    | { ok: false; reason: 'unavailable' };

/**
 * Спрашивает у СИМПАС, кому принадлежит ключ доступа.
 *
 * Ключ в журнал не попадает ни при каком исходе: он равносилен паролю.
 */
export async function fetchSimpasIdAccount(
    accessToken: string,
    fetchImpl: typeof fetch = fetch,
): Promise<SimpasIdLookup> {
    const issuer = simpasIdIssuer();
    if (!issuer) return { ok: false, reason: 'unavailable' };

    let response: Response;
    try {
        response = await fetchImpl(`${issuer}/v1/account`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
            // Ждать дольше нечего: человек стоит перед экраном входа.
            signal: AbortSignal.timeout(10_000),
        });
    } catch {
        return { ok: false, reason: 'unavailable' };
    }

    if (response.status === 401 || response.status === 403) return { ok: false, reason: 'rejected' };
    if (!response.ok) return { ok: false, reason: 'unavailable' };

    let body: unknown;
    try {
        body = await response.json();
    } catch {
        return { ok: false, reason: 'unavailable' };
    }

    const row = body as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id : '';
    const email = typeof row.email === 'string' ? row.email : '';
    if (!id || !email) return { ok: false, reason: 'unavailable' };

    return {
        ok: true,
        account: {
            id,
            email,
            emailVerified: row.email_verified === true,
            displayName: typeof row.display_name === 'string' && row.display_name.trim()
                ? row.display_name.trim()
                : null,
        },
    };
}
