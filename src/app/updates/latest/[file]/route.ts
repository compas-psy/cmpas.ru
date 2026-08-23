import { NextRequest, NextResponse } from 'next/server';

/**
 * Постоянная ссылка на свежую сборку: `/updates/latest/<продукт>.apk`.
 *
 * Правило именования — общее для трёх продуктов СИМПАС (см. CLAUDE.md):
 *   имя файла  simpas-<продукт>-<версия>.apk
 *   тег релиза <продукт>-v<версия>
 *   ссылка     https://cmpas.ru/updates/latest/<продукт>.apk
 *
 * Зачем ссылка отдельная. Человеку нужен один адрес, который не меняется от
 * сборки к сборке. Прямая ссылка на релиз меняется с каждой версией, и её
 * приходится рассылать заново; ссылку с номером прогона (b19, b20, b23)
 * невозможно ни запомнить, ни объяснить.
 *
 * Как устроено: перенаправление на файл последнего релиза с подходящим тегом.
 * Репозиторий публичный, поэтому файл релиза скачивается без ключа, и сервер
 * не хранит APK у себя — значит нечему разъехаться с тем, что выпущено.
 */

const PRODUCTS_SERVED_HERE = ['praktika'] as const;
const REPO = 'compas-psy/cmpas.ru';

/** Через сколько перепроверять, какой релиз последний. */
const CACHE_SECONDS = 300;

interface GithubRelease {
    tag_name: string;
    draft: boolean;
    prerelease: boolean;
    published_at: string | null;
    assets: Array<{ name: string; browser_download_url: string }>;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
    const { file } = await params;
    const product = file.replace(/\.apk$/i, '');

    if (!(PRODUCTS_SERVED_HERE as readonly string[]).includes(product)) {
        // Соседние продукты выпускаются из своих репозиториев и раздаются со
        // своих адресов. Отвечать «не найдено» без объяснения — значит
        // отправить человека гадать.
        return NextResponse.json(
            {
                error: `этот адрес раздаёт только: ${PRODUCTS_SERVED_HERE.join(', ')}`,
                hint: 'ЗАПИСКИ и МОМЕНТЫ выпускаются из своих репозиториев',
            },
            { status: 404 },
        );
    }

    try {
        const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, {
            headers: { Accept: 'application/vnd.github+json' },
            next: { revalidate: CACHE_SECONDS },
        });
        if (!response.ok) {
            return NextResponse.json({ error: 'список релизов недоступен' }, { status: 502 });
        }

        const releases = (await response.json()) as GithubRelease[];
        const latest = releases
            .filter((r) => !r.draft && !r.prerelease && r.tag_name.startsWith(`${product}-v`))
            .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))[0];

        if (!latest) {
            return NextResponse.json(
                { error: `релизов с тегом ${product}-v… ещё нет` },
                { status: 404 },
            );
        }

        // Имя файла обязано отвечать правилу — тому же, что сторожит сборку
        // (scripts/check-release-naming.sh). Отдать что попало из релиза
        // означало бы раздавать людям файл, про который мы ничего не знаем.
        const expected = new RegExp(`^simpas-${product}-\\d+\\.\\d+\\.\\d+\\.apk$`);
        const asset = latest.assets.find((a) => expected.test(a.name));
        if (!asset) {
            return NextResponse.json(
                {
                    error: `в релизе ${latest.tag_name} нет файла по правилу simpas-${product}-<версия>.apk`,
                    found: latest.assets.map((a) => a.name),
                },
                { status: 502 },
            );
        }

        return NextResponse.redirect(asset.browser_download_url, 302);
    } catch (error) {
        console.error('[updates/latest]', error);
        return NextResponse.json({ error: 'не удалось определить последнюю сборку' }, { status: 502 });
    }
}
