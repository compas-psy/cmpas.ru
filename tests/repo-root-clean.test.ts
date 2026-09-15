import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { join } from 'path';

/**
 * В КОРНЕ РЕПОЗИТОРИЯ НЕ ДОЛЖНО БЫТЬ СЛУЧАЙНЫХ ФАЙЛОВ.
 *
 * Их было четыре, и каждый появился одинаково — от осечки в терминале:
 *
 * · «dkl» — вывод git show, пойманный в файл вместо экрана;
 * · «tyling and client name rendering fixes» — справка пейджера less,
 *   попавшая в файл: обрывок команды с потерянным началом;
 * · «t settings = await db.psychologistSettings.findUnique({ where… });» —
 *   пустой файл, имя которого было строкой кода;
 * · «tmp_migrate.sql» — временный SQL, давно заменённый настоящими
 *   миграциями в prisma/migrations.
 *
 * Сами по себе они безобидны. Вредны они тем, что корень репозитория — это
 * первое, что видит человек, открывший проект: по нему он решает, аккуратно
 * ли здесь всё устроено. Четыре обрывка в списке из тридцати файлов говорят
 * ему обратное ещё до того, как он откроет хоть одну строку кода.
 *
 * Сторож написан на ПРИЗНАК, а не на имена: удалить эти четыре — значит
 * починить один раз, а осечка в терминале случится снова.
 */

const root = join(__dirname, '..');

const trackedRootFiles = (): string[] =>
    execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf-8' })
        .split('\n')
        .filter((line) => line && !line.includes('/'));

/** Файлы без расширения, которые в корне уместны и заведены намеренно. */
const EXTENSIONLESS_ALLOWED = new Set(['Dockerfile', 'LICENSE', 'Makefile', 'Procfile']);

describe('корень репозитория', () => {
    it('в именах файлов нет пробелов', () => {
        // Пробел в имени — почти всегда след того, что оболочка приняла за
        // имя файла кусок команды.
        const withSpaces = trackedRootFiles().filter((name) => /\s/.test(name));
        expect(withSpaces, `в корне лежат файлы с пробелами в имени: ${withSpaces.join(', ')}`).toEqual([]);
    });

    it('нет файлов без расширения, кроме заведомо уместных', () => {
        const odd = trackedRootFiles().filter(
            (name) => !name.includes('.') && !EXTENSIONLESS_ALLOWED.has(name),
        );
        expect(odd, `в корне лежат файлы без расширения: ${odd.join(', ')}`).toEqual([]);
    });

    it('временных миграций рядом с настоящими не лежит', () => {
        // Настоящие живут в prisma/migrations и применяются выкладкой.
        // Файл в корне применяется только руками и расходится с ними молча.
        const temp = trackedRootFiles().filter((name) => /^tmp[-_.]/i.test(name) || /\.tmp\./i.test(name));
        expect(temp, `в корне лежат временные файлы: ${temp.join(', ')}`).toEqual([]);
    });
});
