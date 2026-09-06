// Сторож конфигурации тоннеля для Telegram.
//
// Тот же приём, что со сторожем имён сборки и сторожем конфигурации
// выкладки: правило живёт в скрипте (scripts/render-singbox-config.sh),
// выкладка его зовёт, а этот тест сторожит самого сторожа.
//
// Смысл: тоннель ломается тихо. Опечатка в шаблоне или незакрытая
// подстановка дают файл, на котором sing-box падает при старте, и в
// журнале выкладки это одна строчка WARNING среди сотни. Наружу это
// выглядит не как «тоннель не поднялся», а как «бот молчит»: Telegram
// уходит напрямую (src/lib/telegram-proxy.ts), а напрямую с российского
// VPS до api.telegram.org хода нет. Ровно так мы и потеряли mieru —
// заметили не по журналу, а по неотвеченным сообщениям.

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, statSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const SCRIPT = path.join(process.cwd(), 'scripts/render-singbox-config.sh');
const TEMPLATE = path.join(process.cwd(), 'deploy/singbox-config.template.json');

function render(env: Record<string, string>): { ok: boolean; output: string; out: string } {
    const dir = mkdtempSync(path.join(tmpdir(), 'singbox-'));
    const out = path.join(dir, 'singbox-config.json');
    const result = spawnSync('bash', [SCRIPT, out], {
        encoding: 'utf8',
        // Пустое окружение, чтобы переменные разработчика не подменили проверку.
        env: { PATH: process.env.PATH ?? '', ...env } as unknown as NodeJS.ProcessEnv,
    });
    return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}`, out };
}

const FULL = {
    HYSTERIA_SERVER: '203.0.113.7',
    HYSTERIA_PORT: '36712',
    HYSTERIA_PASSWORD: 'p@ss w|ord&1',
};

describe('сборка конфигурации sing-box', () => {
    it('в шаблоне нет ни адреса, ни пароля — только подстановки', () => {
        const template = readFileSync(TEMPLATE, 'utf8');

        // Шаблон лежит в репозитории. Настоящий пароль в нём означал бы
        // утечку в историю git, откуда его уже не убрать.
        expect(template).toContain('${HYSTERIA_SERVER}');
        expect(template).toContain('${HYSTERIA_PASSWORD}');
        expect(template).not.toMatch(/"password"\s*:\s*"(?!\$\{)/);
        expect(template).not.toMatch(/"server"\s*:\s*"(?!\$\{)/);
    });

    it('даёт валидный JSON без единой незакрытой подстановки', () => {
        const { ok, out } = render(FULL);

        expect(ok).toBe(true);
        const text = readFileSync(out, 'utf8');
        // Незакрытая ${…} — самая тихая из поломок: файл выглядит
        // правдоподобно, а sing-box падает на нём при старте.
        expect(text).not.toMatch(/\$\{/);
        expect(() => JSON.parse(text)).not.toThrow();
    });

    it('исходящее соединение — hysteria2, и весь трафик уходит именно в него', () => {
        const { out } = render(FULL);
        const cfg = JSON.parse(readFileSync(out, 'utf8'));

        const tunnel = cfg.outbounds.find((o: { type: string }) => o.type === 'hysteria2');
        expect(tunnel).toBeTruthy();
        expect(tunnel.server).toBe(FULL.HYSTERIA_SERVER);
        expect(tunnel.server_port).toBe(36712);
        expect(tunnel.password).toBe(FULL.HYSTERIA_PASSWORD);
        // final мимо тоннеля означает, что sidecar поднимется, проверка
        // пройдёт, а трафик пойдёт напрямую — то есть никуда.
        expect(cfg.route.final).toBe(tunnel.tag);
    });

    it('порт остаётся числом, а не строкой', () => {
        const { out } = render(FULL);
        const cfg = JSON.parse(readFileSync(out, 'utf8'));

        // sing-box отвергает server_port строкой; в шаблоне подстановка
        // стоит без кавычек, и кавычки туда легко вернуть правкой «для
        // единообразия».
        expect(typeof cfg.outbounds.find((o: { type: string }) => o.type === 'hysteria2').server_port).toBe('number');
    });

    it('порт для приложения — 1080, тот же, что в TELEGRAM_PROXY', () => {
        const { out } = render(FULL);
        const cfg = JSON.parse(readFileSync(out, 'utf8'));

        // Выкладка пишет TELEGRAM_PROXY=http://singbox:1080. Разъедутся —
        // приложение будет стучаться в закрытый порт и молча уйдёт напрямую.
        const inbound = cfg.inbounds[0];
        expect(inbound.listen_port).toBe(1080);
        const deploy = readFileSync(path.join(process.cwd(), 'scripts/deploy-production-remote.sh'), 'utf8');
        expect(deploy).toContain('http://singbox:1080');
    });

    it('без SNI подставляет адрес сервера', () => {
        const { out } = render(FULL);
        const cfg = JSON.parse(readFileSync(out, 'utf8'));

        expect(cfg.outbounds.find((o: { type: string }) => o.type === 'hysteria2').tls.server_name).toBe(FULL.HYSTERIA_SERVER);
    });

    it('заданный SNI и HYSTERIA_INSECURE=false включают проверку сертификата', () => {
        const { out } = render({ ...FULL, HYSTERIA_SNI: 'tunnel.example.org', HYSTERIA_INSECURE: 'false' });
        const cfg = JSON.parse(readFileSync(out, 'utf8'));
        const tls = cfg.outbounds.find((o: { type: string }) => o.type === 'hysteria2').tls;

        // Появится настоящий сертификат — тоннель должен ужесточаться
        // секретами, без правок кода.
        expect(tls.server_name).toBe('tunnel.example.org');
        expect(tls.insecure).toBe(false);
        expect(tls.enabled).toBe(true);
    });

    it('мусор в HYSTERIA_INSECURE не делает файл невалидным и говорит об этом вслух', () => {
        const { ok, output, out } = render({ ...FULL, HYSTERIA_INSECURE: 'да' });

        expect(ok).toBe(true);
        expect(output).toContain('HYSTERIA_INSECURE');
        // insecure стоит в JSON без кавычек: «да» вместо true сломало бы
        // разбор целиком, а не одно поле.
        const cfg = JSON.parse(readFileSync(out, 'utf8'));
        expect(cfg.outbounds.find((o: { type: string }) => o.type === 'hysteria2').tls.insecure).toBe(true);
    });

    it('нечисловой порт останавливает сборку, а не портит JSON', () => {
        const { ok, output } = render({ ...FULL, HYSTERIA_PORT: '36712;' });

        expect(ok).toBe(false);
        expect(output).toContain('HYSTERIA_PORT');
    });

    it('называет по имени каждую недостающую переменную', () => {
        const { ok, output } = render({ HYSTERIA_SERVER: '203.0.113.7' });

        expect(ok).toBe(false);
        expect(output).toContain('HYSTERIA_PORT');
        expect(output).toContain('HYSTERIA_PASSWORD');
        expect(output).not.toContain(' HYSTERIA_SERVER');
    });

    it('готовый файл с паролем читается только владельцем', () => {
        const { out } = render(FULL);

        expect(statSync(out).mode & 0o077).toBe(0);
    });

    it('в выкладке не осталось mieru', () => {
        const deploy = readFileSync(path.join(process.cwd(), 'scripts/deploy-production-remote.sh'), 'utf8');
        const template = readFileSync(TEMPLATE, 'utf8');

        // Мёртвый транспорт в шаблоне выглядит рабочим — это и есть ловушка.
        expect(deploy).not.toMatch(/MIERU_/);
        expect(template.toLowerCase()).not.toContain('mieru');
    });
});
