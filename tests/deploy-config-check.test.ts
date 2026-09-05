// Задача 19: сторож конфигурации выкладки.
//
// Тот же приём, что со сторожем имён сборки: правило живёт в скрипте, CI его
// зовёт, а этот тест сторожит самого сторожа — проверяет, что он ловит именно
// то, ради чего заведён, и называет, чего не хватает и чем это обернётся.
//
// Смысл: интеграция без ключа ломается тихо. Подсказки адресов просто
// перестают появляться, и по экрану не отличить ненастроенный ключ от редкого
// адреса. Приложение теперь отвечает честным 503 NOT_CONFIGURED, но узнавать
// об этом от специалиста — поздно.

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';

const SCRIPT = path.join(process.cwd(), 'scripts/check-deploy-config.sh');

function run(env: Record<string, string>, strict = false): { ok: boolean; output: string } {
    const args = strict ? [SCRIPT, '--strict'] : [SCRIPT];
    // Диагностика ненастроенного ключа уходит в stderr и при коде возврата 0
    // тоже — поэтому нужны оба потока, а не только stdout.
    const result = spawnSync('bash', args, {
        encoding: 'utf8',
        // Пустое окружение, чтобы ключ разработчика не подменил проверку.
        env: { PATH: process.env.PATH ?? '', ...env } as unknown as NodeJS.ProcessEnv,
    });
    return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

describe('сторож конфигурации выкладки', () => {
    it('называет отсутствующий DADATA_API_KEY по имени', () => {
        const { output } = run({});

        expect(output).toContain('DADATA_API_KEY');
        expect(output).toContain('НЕ НАСТРОЕН');
    });

    it('объясняет последствие, а не просто ругается', () => {
        const { output } = run({});

        expect(output).toContain('503 NOT_CONFIGURED');
        expect(output).toContain('вручную');
    });

    it('подсказывает, где заводить значение, и запрещает класть его в репозиторий', () => {
        const { output } = run({});

        expect(output).toContain('секреты окружения выкладки');
        expect(output).toContain('не коммитить');
    });

    it('в обычном режиме выкладку не роняет — подсказки адресов не критичны', () => {
        expect(run({}).ok).toBe(true);
    });

    it('в строгом режиме отсутствие ключа роняет прогон', () => {
        const strict = run({}, true);

        expect(strict.ok).toBe(false);
        expect(strict.output).toContain('DADATA_API_KEY');
    });

    it('с настроенным ключом проходит и в строгом режиме', () => {
        const strict = run({ DADATA_API_KEY: 'секрет-из-окружения' }, true);

        expect(strict.ok).toBe(true);
        expect(strict.output).toContain('DADATA_API_KEY настроен');
    });

    it('пустая строка — это не настроенный ключ', () => {
        const { output } = run({ DADATA_API_KEY: '' });

        expect(output).toContain('НЕ НАСТРОЕН');
    });

    it('само значение ключа не печатается никогда', () => {
        const { output } = run({ DADATA_API_KEY: 'очень-секретное-значение' });

        expect(output).not.toContain('очень-секретное-значение');
    });
});
