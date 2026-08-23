// Постоянная ссылка /updates/latest/<продукт>.apk.
//
// Смысл ссылки — один адрес, который не меняется от сборки к сборке: прямая
// ссылка на релиз меняется с каждой версией, и её приходится рассылать заново,
// а ссылку с номером прогона (b19, b20, b23) невозможно ни запомнить, ни
// объяснить.
//
// Проверяется главное: ссылка не имеет права отдать что попало. Файл из релиза
// берётся только если его имя отвечает тому же правилу, которое сторожит
// сборку — иначе людям раздавался бы файл, про который мы ничего не знаем.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { releases: [] as any[], status: 200 };

vi.stubGlobal('fetch', async () => ({
    ok: state.status === 200,
    status: state.status,
    json: async () => state.releases,
}));

beforeEach(() => {
    state.releases = [];
    state.status = 200;
    vi.resetModules();
});

async function get(file: string) {
    const { GET } = await import('../src/app/updates/latest/[file]/route');
    return GET(new Request(`https://cmpas.ru/updates/latest/${file}`) as any, {
        params: Promise.resolve({ file }),
    } as any);
}

describe('/updates/latest/<продукт>.apk', () => {
    it('ведёт на файл последнего релиза с подходящим тегом', async () => {
        state.releases = [
            {
                tag_name: 'praktika-v1.0.6', draft: false, prerelease: false,
                published_at: '2026-08-23T00:00:00Z',
                assets: [{ name: 'simpas-praktika-1.0.6.apk', browser_download_url: 'https://example/1.0.6.apk' }],
            },
            {
                tag_name: 'praktika-v1.0.5', draft: false, prerelease: false,
                published_at: '2026-07-01T00:00:00Z',
                assets: [{ name: 'simpas-praktika-1.0.5.apk', browser_download_url: 'https://example/1.0.5.apk' }],
            },
        ];
        const res = await get('praktika.apk');
        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe('https://example/1.0.6.apk');
    });

    it('не отдаёт файл, имя которого не по правилу', async () => {
        // Иначе постоянная ссылка раздавала бы людям что угодно, что лежит в
        // релизе, — например, пакет со старым именем или чужой файл.
        state.releases = [{
            tag_name: 'praktika-v1.0.6', draft: false, prerelease: false,
            published_at: '2026-08-23T00:00:00Z',
            assets: [{ name: 'compas-1.0.6-a3f9c21.apk', browser_download_url: 'https://example/старое.apk' }],
        }];
        const res = await get('praktika.apk');
        expect(res.status).toBe(502);
        expect((await res.json()).error).toContain('нет файла по правилу');
    });

    it('не путает продукты: чужой тег не подходит', async () => {
        state.releases = [{
            tag_name: 'zapiski-v2.0.0', draft: false, prerelease: false,
            published_at: '2026-08-23T00:00:00Z',
            assets: [{ name: 'simpas-zapiski-2.0.0.apk', browser_download_url: 'https://example/z.apk' }],
        }];
        const res = await get('praktika.apk');
        expect(res.status).toBe(404);
    });

    it('пропускает черновики и предрелизы', async () => {
        state.releases = [
            {
                tag_name: 'praktika-v9.9.9', draft: true, prerelease: false,
                published_at: '2026-09-01T00:00:00Z',
                assets: [{ name: 'simpas-praktika-9.9.9.apk', browser_download_url: 'https://example/черновик.apk' }],
            },
            {
                tag_name: 'praktika-v1.0.6', draft: false, prerelease: false,
                published_at: '2026-08-23T00:00:00Z',
                assets: [{ name: 'simpas-praktika-1.0.6.apk', browser_download_url: 'https://example/1.0.6.apk' }],
            },
        ];
        const res = await get('praktika.apk');
        expect(res.headers.get('location')).toBe('https://example/1.0.6.apk');
    });

    // Проверка стыка, а не представления о нём.
    //
    // Все проверки выше кормят маршрут заглушками, которые написал автор
    // маршрута. Так и вышло: маршрут пропускал предрелизы, а рабочий процесс
    // сборки ставил prerelease: true на КАЖДЫЙ релиз — то есть постоянная
    // ссылка отвечала бы «релизов ещё нет» всегда, а все пять проверок выше
    // при этом были зелёными. Заглушка проверяла согласие автора с самим
    // собой.
    //
    // Поэтому здесь читается настоящий файл рабочего процесса, а не выдумка
    // про него: если сборка снова начнёт помечать релизы предрелизами, а
    // маршрут — их пропускать, падает вот эта проверка.
    it('рабочий процесс сборки не помечает релизы предрелизами — иначе ссылка вечно пуста', async () => {
        const { readFileSync } = await import('node:fs');
        const workflow = readFileSync('.github/workflows/android-build.yml', 'utf8');

        // Берём только тело шага публикации: слово prerelease встречается и в
        // пояснениях, а искать его по всему файлу значило бы падать от
        // комментария.
        const step = workflow.slice(workflow.indexOf('action-gh-release'));
        const flag = step.match(/^\s*prerelease:\s*(\S+)/m)?.[1];

        expect(
            flag === undefined || flag === 'false',
            `шаг публикации ставит prerelease: ${flag}, а постоянная ссылка предрелизы пропускает — ` +
                'ссылка не отдаст ни одной сборки. Либо снять флаг, либо перестать фильтровать в маршруте.',
        ).toBe(true);
    });

    it('о чужом продукте говорит внятно, а не молча отвечает «не найдено»', async () => {
        const res = await get('momenty.apk');
        expect(res.status).toBe(404);
        expect((await res.json()).hint).toContain('своих репозиториев');
    });
});
