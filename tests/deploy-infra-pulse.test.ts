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
