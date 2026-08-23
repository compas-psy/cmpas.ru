// Остаток минут GitHub Actions (InfraPulse.buildMinutesLeft, карточка
// «Выкладки»). Без токена GitHub с правом читать биллинг Actions — не
// выдумываем доступа, которого нет: поле остаётся null, и сетевой запрос
// не делается вовсе (см. тест "без токена — сеть не трогаем").

export interface BuildMinutesConfig {
    /** GitHub PAT/App-токен с правом читать billing организации. */
    token: string | null;
    /** Организация/аккаунт, под которым считается биллинг Actions. */
    org: string | null;
}

interface GithubActionsBilling {
    included_minutes?: unknown;
    total_minutes_used?: unknown;
}

/**
 * GET /orgs/{org}/settings/billing/actions — стандартный эндпойнт биллинга
 * GitHub Actions. `fetchImpl` параметризован ради теста: сеть не трогаем в
 * unit-тестах, а в бою это глобальный `fetch`.
 */
export async function readBuildMinutesLeft(
    config: BuildMinutesConfig,
    fetchImpl: typeof fetch = fetch,
): Promise<number | null> {
    if (!config.token || !config.org) return null;
    try {
        const res = await fetchImpl(`https://api.github.com/orgs/${config.org}/settings/billing/actions`, {
            headers: {
                Authorization: `Bearer ${config.token}`,
                Accept: 'application/vnd.github+json',
            },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as GithubActionsBilling;
        if (typeof data.included_minutes !== 'number' || typeof data.total_minutes_used !== 'number') return null;
        return Math.max(0, Math.round(data.included_minutes - data.total_minutes_used));
    } catch (error) {
        console.error('[infra-pulse] GitHub Actions billing read failed:', error);
        return null;
    }
}
