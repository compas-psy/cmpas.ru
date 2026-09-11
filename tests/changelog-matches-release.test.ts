import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * «Что нового» отстала на четыре месяца и молчала об этом.
 *
 * Страница жила собственной нумерацией (2.4–2.6) и собственным календарём
 * (последняя запись — 3 мая), пока продукт выпускался версиями 1.x и
 * менялся каждый день. Человек открывал раздел в левом меню и читал про
 * обновления, которых не было, не видя ни одного, которое было.
 *
 * Память это не стережёт — стережёт сборка. Правило: ВЕРХНЯЯ запись
 * страницы называет ту линию версий, которая сейчас выпущена. Подняли
 * версию продукта — либо появилась строка о том, что изменилось, либо
 * проверка красная.
 *
 * Правило намеренно про линию, а не про точную версию: 1.3.1 и 1.3.2
 * рассказывают одну историю, и дробить её на карточки ради проверки
 * незачем. А вот 1.4 или 2.0 — уже другая история, и запись обязана быть.
 */

const root = join(__dirname, '..');
const changelogSource = readFileSync(join(root, 'src/app/diary/changelog/page.tsx'), 'utf-8');
const buildGradle = readFileSync(join(root, 'android/app/build.gradle.kts'), 'utf-8');

/** Версия продукта в том виде, в каком её видит телефон. */
function releaseVersion(): string {
    const match = buildGradle.match(/versionName\s*=\s*"([^"]+)"/);
    expect(match, 'versionName не найден в android/app/build.gradle.kts').toBeTruthy();
    return match![1];
}

/** Версии записей страницы, сверху вниз. */
function changelogVersions(): string[] {
    return [...changelogSource.matchAll(/^\s*version:\s*'([^']+)',/gm)].map(m => m[1]);
}

describe('«Что нового» не отстаёт от выпущенной версии', () => {
    it('верхняя запись называет текущую линию версий', () => {
        const released = releaseVersion();
        const top = changelogVersions()[0];

        expect(top, 'на странице нет ни одной записи').toBeTruthy();
        expect(
            released === top || released.startsWith(`${top}.`),
            `Выпущена ${released}, а верхняя запись «Что нового» — про ${top}. ` +
            'Допишите строку о том, что изменилось для человека, или расширьте верхнюю запись.',
        ).toBe(true);
    });

    it('записи идут от новой к старой', () => {
        // Порядок держится руками: перепутанный — это страница, где
        // свежее прячется под прошлогодним.
        const parts = changelogVersions().map(v => v.split('.').map(Number));
        for (let i = 1; i < parts.length; i++) {
            const [prevMajor, prevMinor = 0] = parts[i - 1];
            const [major, minor = 0] = parts[i];
            expect(
                major < prevMajor || (major === prevMajor && minor < prevMinor),
                `Запись ${changelogVersions()[i]} стоит ниже ${changelogVersions()[i - 1]}, но не старше её`,
            ).toBe(true);
        }
    });

    it('страница не рассказывает про устройство сервиса', () => {
        // Прежняя редакция объясняла психологу про DNS в Docker и таймауты
        // на вызовы API. Это не «мелкая небрежность»: раздел «Что нового»
        // читают, чтобы понять, что изменилось в РАБОТЕ, и техническая
        // строка занимает там место строки по делу.
        const forbidden = ['Docker', 'DNS', 'endpoint', 'API', 'timeout', 'Timeout', 'webhook'];
        const shown = changelogSource.match(/text: '[^']+'/g) ?? [];
        for (const word of forbidden) {
            const guilty = shown.filter(line => line.includes(word));
            expect(guilty, `Строка про «${word}» человеку ничего не говорит`).toEqual([]);
        }
    });
});
