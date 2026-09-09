// Регрессия O-260817-12: docker-compose.yml объявляет сервис infra-pulse с
// profiles: ["infra-pulse"] (см. комментарий там же — "тот же приём, что у
// singbox"), а скрипт выкладки singbox поднимает явным вызовом с профилем,
// когда условия выполнены, но для infra-pulse такого вызова никогда не было.
// Итог в проде: коллектор ни разу не запускался деплоем, восемь карточек
// панели «Техника»/«Каналы» молчали, хотя весь код коллектора написан и
// протестирован (tests/infra-pulse.test.ts). Тест читает сам текст скрипта
// деплоя — не поднимает docker — и проверяет ровно то, что сломалось: любой
// `docker compose ... up ...`, который поднимает сервис app, обязан
// сопровождаться (где-то в том же скрипте) явным подъёмом infra-pulse через
// его профиль.

import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const scriptPath = path.resolve(import.meta.dirname, '../scripts/deploy-production-remote.sh');
const source = readFileSync(scriptPath, 'utf8');

/** Строки, где скрипт реально поднимает контейнеры — `docker compose ... up ...`. */
function composeUpInvocations(src: string): string[] {
    return src
        .split('\n')
        .filter((line) => !line.trim().startsWith('#'))
        .filter((line) => /docker compose\b/.test(line) && /\bup\b/.test(line));
}

describe('деплой поднимает infra-pulse вместе с app (O-260817-12)', () => {
    it('скрипт вообще содержит вызов, поднимающий сервис infra-pulse', () => {
        const invocations = composeUpInvocations(source);
        expect(invocations.some((line) => /\binfra-pulse\b/.test(line))).toBe(true);
    });

    it('подъём infra-pulse включает его профиль явно (--profile infra-pulse), а не бытовой `up` без сервисов', () => {
        const invocations = composeUpInvocations(source);
        const infraPulseLine = invocations.find((line) => /\binfra-pulse\b/.test(line));
        expect(infraPulseLine, 'нет строки, поднимающей infra-pulse').toBeDefined();
        expect(infraPulseLine).toMatch(/--profile\s+infra-pulse/);
    });

    it('каждый вызов `docker compose up`, поднимающий app, — деплой, в котором коллектор тоже поднимается', () => {
        const invocations = composeUpInvocations(source);
        const appInvocations = invocations.filter((line) => /\bapp\b/.test(line));
        // Если это условие не выполняется — тест ничего не проверяет, сам себя обманывает.
        expect(appInvocations.length).toBeGreaterThan(0);

        const infraPulseIsStartedSomewhere = invocations.some((line) => /\binfra-pulse\b/.test(line));
        for (const line of appInvocations) {
            expect(
                infraPulseIsStartedSomewhere,
                `команда "${line.trim()}" поднимает app, но нигде в скрипте деплоя не поднимается infra-pulse`,
            ).toBe(true);
        }
    });

    it('образ infra-pulse-collector собирается вместе с app, а не остаётся отсутствующим на первом деплое', () => {
        expect(source).toMatch(/docker compose[^\n]*\bbuild\b[^\n]*\binfra-pulse\b/);
    });
});

/**
 * Выкладка не должна ходить в интернет за инструментом, которым запускает
 * собственные скрипты.
 *
 * И скрипт выкладки, и сам сборщик infra-pulse запускаются через `npx tsx`.
 * Пакета tsx в зависимостях проекта НЕ БЫЛО, поэтому npx тянул его из
 * реестра при каждой выкладке и при каждом старте контейнера сборщика —
 * в журнале это видно строкой «npm warn exec The following package was not
 * found and will be installed: tsx».
 *
 * 09.09.2026 эта загрузка повисла: у сервера исходящая связь ненадёжна, а
 * срока у скачивания не было. Выкладка простояла 42 минуты и была убита
 * пределом SSH-шага, хотя приложение к тому моменту было выложено и здорово.
 *
 * Комментарий в самом скрипте выкладки при этом утверждал, что tsx лежит в
 * devDependencies образа. Он был неверен — и потому не спас.
 */
describe('tsx берётся из образа, а не из сети', () => {
    const pkg = JSON.parse(
        readFileSync(path.resolve(import.meta.dirname, '../package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const dockerfile = readFileSync(path.resolve(import.meta.dirname, '../Dockerfile'), 'utf8');

    it('tsx объявлен зависимостью проекта — иначе npx полезет в реестр', () => {
        const declared = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        expect(Object.keys(declared)).toContain('tsx');
    });

    it('каждый вызов npx tsx запрещает доустановку', () => {
        // Без --no-install пропажа пакета оборачивается молчаливым походом в
        // сеть; с ним — мгновенным отказом, который называет себя.
        const calls = [...source.matchAll(/npx[^\n|;]*\btsx\b/g)].map((m) => m[0]);
        const inDockerfile = [...dockerfile.matchAll(/"npx"[^\]]*"tsx"/g)].map((m) => m[0]);
        expect(calls.length + inDockerfile.length).toBeGreaterThan(0);
        for (const call of calls) expect(call).toMatch(/--no-install/);
        for (const call of inDockerfile) expect(call).toMatch(/"--no-install"/);
    });
});
