import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Секрет заполнен, сборка зелёная, кнопки нет.
 *
 * Сборка читала имя, которое выдумала сама — YANDEX_NATIVE_CLIENT_ID, —
 * тогда как в репозитории секрет назван YANDEX_CLIENT_ID. Идентификатор
 * приезжал пустым, манифест собирался с заглушкой «unset», сверка с
 * сервером честно не находила совпадения и прятала кнопку. Каждое звено
 * отработало правильно, и поэтому никто ничего не заметил: ни одна
 * проверка не спрашивала, читаем ли мы то имя, под которым значение
 * лежит.
 *
 * Это цена не строчки кода, а суток переписки с СИМПАС о значении,
 * которое всё это время было на месте. Проверка ниже стоит здесь, чтобы
 * такого второго раза не было.
 */

const root = join(__dirname, '..');
const buildGradle = readFileSync(join(root, 'android/app/build.gradle.kts'), 'utf-8');

/** Прогоны, которые собирают приложение и потому обязаны знать секрет. */
const WORKFLOWS = [
    '.github/workflows/android-build.yml',
    '.github/workflows/release-verification.yml',
    '.github/workflows/channel-binding-ci.yml',
];

describe('идентификатор приложения Яндекса доезжает от секрета до сборки', () => {
    it('сборка читает имя, под которым секрет лежит в репозитории', () => {
        expect(buildGradle).toContain('System.getenv("YANDEX_CLIENT_ID")');
    });

    it('прежнее имя остаётся запасным, а не единственным', () => {
        // Убирать его незачем: заполненное под любым из двух имён значение
        // должно доезжать. Опасно обратное — читать ТОЛЬКО запасное.
        const primary = buildGradle.indexOf('System.getenv("YANDEX_CLIENT_ID")');
        const legacy = buildGradle.indexOf('System.getenv("YANDEX_NATIVE_CLIENT_ID")');
        expect(primary).toBeGreaterThan(-1);
        expect(legacy).toBeGreaterThan(primary);
    });

    it('каждый собирающий прогон передаёт секрет в окружение', () => {
        for (const path of WORKFLOWS) {
            const workflow = readFileSync(join(root, path), 'utf-8');
            expect(workflow, `${path} не передаёт YANDEX_CLIENT_ID`)
                .toContain('YANDEX_CLIENT_ID: ${{ secrets.YANDEX_CLIENT_ID }}');
        }
    });

    it('релиз не собирается молча без идентификатора', () => {
        // Пустое значение — это релиз без нативного входа. Он имеет право
        // на существование, но не имеет права быть незаметным.
        const build = readFileSync(join(root, '.github/workflows/android-build.yml'), 'utf-8');
        expect(build).toContain('Идентификатор Яндекса на месте');
        expect(build).toContain('::error::Секрет YANDEX_CLIENT_ID пуст');
    });

    it('значение идентификатора нигде не печатается', () => {
        // Секретом оно не является (уезжает в APK), но в журнале прогона ему
        // делать нечего: журналы читают шире, чем репозиторий.
        const build = readFileSync(join(root, '.github/workflows/android-build.yml'), 'utf-8');
        expect(build).not.toMatch(/echo\s+"?\$\{?YANDEX_(NATIVE_)?CLIENT_ID/);
    });
});
