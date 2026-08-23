// Правило именования сборок — общее для трёх продуктов СИМПАС.
//
// Записанное в CLAUDE.md правило забывается; падающая сборка нет. Поэтому
// правило живёт в scripts/check-release-naming.sh, CI зовёт его на ГОТОВОМ
// артефакте, а этот тест сторожит самого сторожа: проверяет, что он ловит
// именно то, ради чего заведён, и называет, чего не хватает.
//
// Имена до правила расходились у всех троих, и КОМПАС транслитерировался
// одновременно тремя способами: kompas в МОМЕНТАХ, compas в ПРАКТИКЕ,
// cmpas в домене. Плюс в тег подставлялся номер прогона, из-за чего росла
// лестница b19, b20, b23 при неизменной версии продукта.

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';

const SCRIPT = path.join(process.cwd(), 'scripts/check-release-naming.sh');

function check(file: string, tag: string, product = 'praktika'): { ok: boolean; output: string } {
    try {
        const output = execFileSync('bash', [SCRIPT, file, tag, product], { encoding: 'utf8' });
        return { ok: true, output };
    } catch (error) {
        const e = error as { stdout?: string; stderr?: string };
        return { ok: false, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
}

describe('сторож имён сборки', () => {
    it('пропускает имя по правилу', () => {
        const { ok, output } = check('simpas-praktika-1.0.6.apk', 'praktika-v1.0.6');
        expect(ok, output).toBe(true);
        expect(output).toContain('https://cmpas.ru/updates/latest/praktika.apk');
    });

    it('ловит имя, которым собиралось ДО правила', () => {
        // Ровно то, что стояло в workflow: имя с хешем коммита, тег с номером
        // прогона. Если этот случай проходит — сторож не сторожит.
        const { ok, output } = check('compas-1.0.6-a3f9c21.apk', 'android-v1.0.6-b23');
        expect(ok).toBe(false);
        expect(output).toContain('не отвечает шаблону');
    });

    it('ловит номер прогона в теге', () => {
        expect(check('simpas-praktika-1.0.6.apk', 'praktika-v1.0.6-b23').ok).toBe(false);
    });

    it('ловит хеш коммита в имени файла', () => {
        expect(check('simpas-praktika-1.0.6-a3f9c21.apk', 'praktika-v1.0.6').ok).toBe(false);
    });

    it('ловит чужую транслитерацию КОМПАСа', () => {
        for (const wrong of ['kompas', 'compas', 'cmpas', 'practice']) {
            const { ok } = check(`simpas-${wrong}-1.0.6.apk`, `${wrong}-v1.0.6`);
            expect(ok, `«${wrong}» прошёл, хотя допустимы только praktika/zapiski/momenty`).toBe(false);
        }
    });

    it('ловит расхождение версии между именем файла и тегом', () => {
        const { ok, output } = check('simpas-praktika-1.0.6.apk', 'praktika-v1.0.7');
        expect(ok).toBe(false);
        expect(output).toContain('версия');
    });

    it('ловит чужой продукт в этом репозитории', () => {
        const { ok, output } = check('simpas-zapiski-1.0.6.apk', 'zapiski-v1.0.6');
        expect(ok).toBe(false);
        expect(output).toContain('praktika');
    });

    it('принимает имена соседних продуктов, если репозиторий их и выпускает', () => {
        // Скрипт общий для трёх продуктов — в репозитории ЗАПИСОК он обязан
        // принимать zapiski. Проверяется здесь, чтобы копия скрипта у соседей
        // не разошлась с этой.
        expect(check('simpas-zapiski-2.1.0.apk', 'zapiski-v2.1.0', 'zapiski').ok).toBe(true);
        expect(check('simpas-momenty-0.9.3.apk', 'momenty-v0.9.3', 'momenty').ok).toBe(true);
    });

    it('версия в имени совпадает с versionName сборки', () => {
        // Иначе правило соблюдено формально, а файл называется не тем, что внутри.
        const gradle = require('fs').readFileSync('android/app/build.gradle.kts', 'utf8');
        const versionName = /versionName\s*=\s*"([^"]+)"/.exec(gradle)?.[1];
        expect(versionName, 'versionName не найден в build.gradle.kts').toBeTruthy();
        expect(check(`simpas-praktika-${versionName}.apk`, `praktika-v${versionName}`).ok).toBe(true);
    });
});
