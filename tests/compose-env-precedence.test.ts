import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Сторож против ловушки, которая 07.09.2026 на сутки погасила подсказки
 * адресов при живом ключе на сервере.
 *
 * В docker-compose.yml у приложения есть и `env_file: .env`, и явный список
 * `environment:`. Строка вида `KEY=${KEY:-}` в `environment:` ПЕРЕБИВАЕТ
 * env_file — а подставляется она из оболочки, в которой выкладка зовёт
 * docker compose. Выкладка приезжает по ssh с экспортом секретов
 * репозитория (deploy-docker.yml, `envs:`), и если секрета там ещё нет,
 * переменная приезжает ПУСТОЙ. Пустая строка — это значение, а не
 * отсутствие: контейнер получает KEY="" поверх настоящего ключа в .env.
 *
 * Снаружи это выглядит необъяснимо: в /var/www/cmpas.ru/.env ключ лежит,
 * а приложение отвечает «ключа нет».
 *
 * Поэтому правило: ключ, который выкладка везёт секретом, не должен
 * повторяться в `environment:` подстановкой. Его место — .env, откуда его
 * берёт env_file.
 */
const root = join(__dirname, '..');
const compose = readFileSync(join(root, 'docker-compose.yml'), 'utf-8');
const workflow = readFileSync(join(root, '.github/workflows/deploy-docker.yml'), 'utf-8');

/** Имена, которые выкладка экспортирует в оболочку сервера. */
function deployedSecretNames(): string[] {
    const line = workflow.split('\n').find(l => l.trim().startsWith('envs:'));
    if (!line) return [];
    return line
        .slice(line.indexOf(':') + 1)
        .split(',')
        .map(name => name.trim())
        .filter(Boolean);
}

/** Имена, подставляемые в `environment:` сервиса app. */
function interpolatedInAppEnvironment(): string[] {
    const lines = compose.split('\n');
    const start = lines.findIndex(l => l.trim() === 'environment:');
    expect(start).toBeGreaterThan(-1);
    const names: string[] = [];
    for (const line of lines.slice(start + 1)) {
        if (!line.startsWith('      ')) break; // вышли из блока
        const match = line.match(/^\s*-\s*([A-Z0-9_]+)=\$\{([A-Z0-9_]+)/);
        if (match) names.push(match[1]);
    }
    return names;
}

describe('docker-compose: подстановка не перебивает env_file', () => {
    it('ни один секрет выкладки не подставляется в environment сервиса app', () => {
        const shipped = new Set(deployedSecretNames());
        const collisions = interpolatedInAppEnvironment().filter(name => shipped.has(name));
        expect(collisions).toEqual([]);
    });

    it('список секретов выкладки прочитан, а не пуст (иначе проверка ничего не стережёт)', () => {
        expect(deployedSecretNames()).toContain('DADATA_API_KEY');
    });

    it('DADATA_API_KEY приходит из .env, а не подстановкой', () => {
        expect(compose).toContain('env_file');
        expect(compose).not.toMatch(/DADATA_API_KEY=\$\{/);
    });
});
