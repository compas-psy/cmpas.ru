// Задача G: убрать из выкладки ПРАКТИКИ ручную работу учредителя на сервере
// (секрет приёмника аналитики, мост к ЗАПИСКАМ, включение аналитических
// флагов, обратное заполнение подписок). Тест читает сам текст скрипта
// деплоя — не поднимает docker, по образцу tests/deploy-infra-pulse.test.ts —
// и проверяет ровно то, что было ручной работой человека на сервере.

import { readFileSync } from 'fs';
import path from 'path';
import { load as loadYaml } from 'js-yaml';
import { describe, it, expect } from 'vitest';

const scriptPath = path.resolve(import.meta.dirname, '../scripts/deploy-production-remote.sh');
const source = readFileSync(scriptPath, 'utf8');

/** Символьный индекс первого совпадения — для проверки порядка блоков друг относительно друга. */
function indexOf(pattern: RegExp): number {
    const m = source.match(pattern);
    if (!m || m.index === undefined) return -1;
    return m.index;
}

describe('G1: ANALYTICS_INGEST_SECRET рождается сам, если его не задали человеком', () => {
    it('перенос значения из окружения раннера по-прежнему на месте (существующее поведение не сломано)', () => {
        // Строка-элемент цикла `for key in ...`, ровно как у остальных секретов.
        expect(source).toMatch(/^\s*ANALYTICS_INGEST_SECRET\s*\\\s*$/m);
    });

    it('если секрета нет ни в окружении, ни в .env — генерируем его тем же приёмом, что TELEGRAM_WEBHOOK_SECRET', () => {
        expect(source).toMatch(/analytics_ingest_secret=\$\(grep ['"]?\^ANALYTICS_INGEST_SECRET=/);
        expect(source).toMatch(/if \[ -z "\$analytics_ingest_secret" \]/);
        expect(source).toMatch(/openssl rand -hex 32/);
    });

    it('генерация идёт ПОСЛЕ цикла переноса из окружения — иначе она затирает заданное человеком значение', () => {
        const forLoopIdx = indexOf(/^\s*ANALYTICS_INGEST_SECRET\s*\\\s*$/m);
        const generationIdx = indexOf(/if \[ -z "\$analytics_ingest_secret" \]/);
        expect(forLoopIdx).toBeGreaterThan(-1);
        expect(generationIdx).toBeGreaterThan(-1);
        expect(generationIdx).toBeGreaterThan(forLoopIdx);
    });
});

describe('Task 2 (PRAKTIKA MVP): MAX_WEBHOOK_SECRET самозаводится и доезжает до MAX', () => {
    it('если секрета нет ни в окружении, ни в .env — генерируем его тем же приёмом, что TELEGRAM_WEBHOOK_SECRET', () => {
        expect(source).toMatch(/max_webhook_secret=\$\(grep ['"]?\^MAX_WEBHOOK_SECRET=/);
        expect(source).toMatch(/if \[ -z "\$max_webhook_secret" \]/);
    });

    it('генерация идёт ПОСЛЕ блока TELEGRAM_WEBHOOK_SECRET (тот же самозаводящийся паттерн)', () => {
        const tgIdx = indexOf(/upsert_env TELEGRAM_WEBHOOK_SECRET/);
        const maxIdx = indexOf(/upsert_env MAX_WEBHOOK_SECRET/);
        expect(tgIdx).toBeGreaterThan(-1);
        expect(maxIdx).toBeGreaterThan(-1);
        expect(maxIdx).toBeGreaterThan(tgIdx);
    });

    it('секрет передаётся MAX в теле POST /subscriptions как "secret" — иначе MAX никогда не пришлёт его назад в заголовке', () => {
        expect(source).toMatch(/\\"secret\\":\\"\$\{max_webhook_secret\}\\"/);
    });

    it('регистрация подписки идёт на platform-api2.max.ru (миграция MAX 19.07.2026), а не на устаревший домен', () => {
        expect(source).toMatch(/platform-api2\.max\.ru\/subscriptions/);
        expect(source).not.toMatch(/botapi\.max\.ru/);
    });

    it('DELETE /subscriptions передаёт ?url= удаляемой подписки — обязательный параметр по текущему контракту MAX', () => {
        const deleteIdx = indexOf(/-X DELETE 'https:\/\/platform-api2\.max\.ru\/subscriptions/);
        expect(deleteIdx).toBeGreaterThan(-1);
        const deleteLine = source.slice(deleteIdx, source.indexOf('\n', deleteIdx));
        expect(deleteLine).toMatch(/\?url=/);
    });
});

describe('G2: секрет доезжает до ЗАПИСОК через общий файл /etc/simpas/ingest-secret', () => {
    it('каталог создаётся', () => {
        expect(source).toMatch(/mkdir\s+-p[^\n]*\/etc\/simpas(\s|$)/m);
    });

    it('файл получает права строго 600 и владельца root', () => {
        expect(source).toMatch(/^chmod\s+600\s+\/etc\/simpas\/ingest-secret\s*$/m);
        expect(source).toMatch(/^chown\s+root(:root)?\s+\/etc\/simpas\/ingest-secret\s*$/m);
    });

    it('в файл пишется то же значение секрета, что использует сам приёмник (не отдельно сгенерированное)', () => {
        expect(source).toMatch(/"\$analytics_ingest_secret"\s*>\s*\/etc\/simpas\/ingest-secret/);
    });

    it('запись в общий файл ничем не обусловлена — происходит на каждой выкладке, а не только при первой генерации', () => {
        // Строки chmod/chown лежат вне if-блока генерации (в этом скрипте тело if
        // всегда с отступом в 2 пробела) — иначе смена секрета человеком никогда
        // не доедет до соседа при повторных выкладках.
        expect(source).toMatch(/^chmod\s+600\s+\/etc\/simpas\/ingest-secret\s*$/m);
        expect(source).not.toMatch(/^\s{2,}chmod\s+600\s+\/etc\/simpas\/ingest-secret/m);
    });

    it('рядом есть комментарий про межпродуктовую границу: кто пишет, кто читает, почему не через env', () => {
        const commentWindow = source.slice(Math.max(0, indexOf(/\/etc\/simpas/) - 1200), indexOf(/\/etc\/simpas/) + 50);
        expect(commentWindow).toMatch(/ЗАПИСК/);
        expect(commentWindow.toLowerCase()).toMatch(/env|переменн/);
    });
});

describe('G3: аналитические флаги включены по прямому распоряжению учредителя', () => {
    it('ANALYTICS_INGEST_ENABLED выставлен в true', () => {
        expect(source).toMatch(/ensure_env\s+ANALYTICS_INGEST_ENABLED\s+'true'/);
    });

    it('ANALYTICS_TRACKING_ENABLED выставлен в true', () => {
        expect(source).toMatch(/ensure_env\s+ANALYTICS_TRACKING_ENABLED\s+'true'/);
    });

    it('оба флага — через ensure_env, а не upsert_env: ручное значение человека не перебивается', () => {
        expect(source).not.toMatch(/upsert_env\s+ANALYTICS_INGEST_ENABLED/);
        expect(source).not.toMatch(/upsert_env\s+ANALYTICS_TRACKING_ENABLED/);
    });
});

describe('G4: обратное заполнение подписок выполняется само', () => {
    it('скрипт вызывает scripts/backfill-subscriptions.ts', () => {
        expect(source).toMatch(/backfill-subscriptions\.ts/);
    });

    it('вызов идёт после миграций', () => {
        const migrateIdx = indexOf(/migrate deploy/);
        const backfillIdx = indexOf(/backfill-subscriptions\.ts/);
        expect(migrateIdx).toBeGreaterThan(-1);
        expect(backfillIdx).toBeGreaterThan(migrateIdx);
    });

    it('вызов идёт после того, как приложение поднято и здорово', () => {
        const healthyIdx = indexOf(/New application is healthy\./);
        const backfillIdx = indexOf(/backfill-subscriptions\.ts/);
        expect(healthyIdx).toBeGreaterThan(-1);
        expect(backfillIdx).toBeGreaterThan(healthyIdx);
    });

    it('ошибка обратного заполнения не валит выкладку: рядом WARNING, а не exit', () => {
        // Ищем именно строку запуска, а не первое упоминание файла в комментарии
        // (комментарий длинный и намеренно поясняет, почему запуск устроен так).
        const invocationIdx = indexOf(/npx tsx scripts\/backfill-subscriptions\.ts/);
        expect(invocationIdx).toBeGreaterThan(-1);
        const nearby = source.slice(invocationIdx, invocationIdx + 400);
        expect(nearby).toMatch(/WARNING/);
        expect(nearby).not.toMatch(/exit\s+1/);
    });
});

describe('G5: стоимость инфраструктуры задаётся переменной окружения, а не SQL руками', () => {
    it('скрипт умеет сеять SystemConfig.infra_cost_rub из INFRA_COST_RUB', () => {
        expect(source).toMatch(/INFRA_COST_RUB/);
        expect(source).toMatch(/infra_cost_rub/);
    });

    it('если переменная не задана — блок обёрнут в проверку и ничего не делает', () => {
        expect(source).toMatch(/if\s+\[\s+-n\s+"\$\{?INFRA_COST_RUB/);
    });

    it('GitHub Actions действительно доносит INFRA_COST_RUB до раннера и до самого деплой-скрипта', () => {
        // Без этого секрет, даже заведённый в GitHub, никогда не попадёт в
        // окружение SSH-сессии appleboy/ssh-action, которая запускает
        // deploy-production-remote.sh — код в скрипте был бы мёртвым.
        const workflowPath = path.resolve(import.meta.dirname, '../.github/workflows/deploy-docker.yml');
        const workflow = loadYaml(readFileSync(workflowPath, 'utf8')) as {
            jobs: { deploy: { env?: Record<string, string>; steps: Array<{ with?: { envs?: string } }> } };
        };
        const deployEnv = workflow.jobs.deploy.env ?? {};
        expect(deployEnv.INFRA_COST_RUB).toBe('${{ secrets.INFRA_COST_RUB }}');

        const sshStep = workflow.jobs.deploy.steps.find((s) => s.with?.envs);
        expect(sshStep, 'нет шага SSH-деплоя с envs:').toBeDefined();
        const forwardedNames = (sshStep!.with!.envs as string).split(',');
        expect(forwardedNames).toContain('INFRA_COST_RUB');
    });
});

/**
 * Секрет приёмника должен доезжать из GitHub до сервера — иначе три продукта
 * не сойдутся.
 *
 * Выкладка умеет родить секрет сама, и для ПРАКТИКИ с ЗАПИСКАМИ этого хватает:
 * сосед читает значение из общего файла на той же машине. Но МОМЕНТЫ —
 * приложение: их секрет зашивается в сборку на раннере GitHub, до сервера ему
 * не дотянуться. Если человек заведёт секрет организации ради МОМЕНТОВ, а до
 * сервера этот секрет не доедет, сервер родит СВОЙ — и сборка МОМЕНТОВ будет
 * получать 401 вечно, при том что «секрет же задан». Ровно тот отказ, который
 * ищут месяцами.
 */
describe('ANALYTICS_INGEST_SECRET доезжает из GitHub до деплой-скрипта', () => {
    const workflow = readFileSync(
        path.join(process.cwd(), '.github/workflows/deploy-docker.yml'),
        'utf8',
    );

    it('объявлен в env: job-а выкладки', () => {
        expect(workflow).toMatch(/ANALYTICS_INGEST_SECRET:\s*\$\{\{\s*secrets\.ANALYTICS_INGEST_SECRET\s*\}\}/);
    });

    it('перечислен в envs: ssh-action — без этого до скрипта он не доедет', () => {
        const envsLine = workflow.split('\n').find((line) => line.trim().startsWith('envs:'));
        expect(envsLine, 'строка envs: обязана существовать').toBeDefined();
        expect(envsLine!.split(',').map((s) => s.trim())).toContain('ANALYTICS_INGEST_SECRET');
    });
});
