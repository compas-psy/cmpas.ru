// Сторож готового пакета (scripts/check-apk.sh) — проверка самого сторожа.
//
// Настоящий APK здесь не собрать: Android SDK в этой среде нет. Но у сторожа
// есть часть, которую можно проверить без пакета и в которой он молча
// провалился бы: разбор входа и отказы ДО того, как дело дошло до aapt2.
//
// Зачем это существует: сторож, который при любой неожиданности отвечает
// «всё хорошо», опаснее отсутствия сторожа — он выглядит как проверка.

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const SCRIPT = path.join(process.cwd(), 'scripts/check-apk.sh');

function run(args: string[], env: Record<string, string> = {}): { ok: boolean; output: string } {
    try {
        const output = execFileSync('bash', [SCRIPT, ...args], {
            encoding: 'utf8',
            env: { ...process.env, ...env },
        });
        return { ok: true, output };
    } catch (error) {
        const e = error as { stdout?: string; stderr?: string };
        return { ok: false, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
}

describe('сторож готового пакета', () => {
    it('отказывает без аргументов, а не проходит молча', () => {
        const { ok, output } = run([]);
        expect(ok).toBe(false);
        expect(output).toContain('три аргумента');
    });

    it('отказывает, если пакета нет', () => {
        const { ok, output } = run(['/несуществующий.apk', 'deadbeef', 'android/allowed-permissions.txt']);
        expect(ok).toBe(false);
        expect(output).toContain('пакет не найден');
    });

    it('отказывает, если списка разрешений нет', () => {
        const apk = path.join(os.tmpdir(), 'guard-probe.apk');
        fs.writeFileSync(apk, 'не настоящий пакет');
        try {
            const { ok, output } = run([apk, 'deadbeef', '/несуществующий-список.txt']);
            expect(ok).toBe(false);
            expect(output).toContain('список разрешений не найден');
        } finally {
            fs.unlinkSync(apk);
        }
    });

    it('отказывает, если не задан ANDROID_HOME — а не решает, что проверять нечем', () => {
        const apk = path.join(os.tmpdir(), 'guard-probe2.apk');
        fs.writeFileSync(apk, 'не настоящий пакет');
        try {
            const { ok, output } = run([apk, 'deadbeef', 'android/allowed-permissions.txt'], {
                ANDROID_HOME: '',
                ANDROID_SDK_ROOT: '',
            });
            expect(ok).toBe(false);
            expect(output).toContain('нечем разбирать пакет');
        } finally {
            fs.unlinkSync(apk);
        }
    });
});

describe('список разрешений', () => {
    const FILE = 'android/allowed-permissions.txt';

    it('существует и разбирается', () => {
        const parsed = fs.readFileSync(FILE, 'utf8')
            .split('\n')
            .map((l) => l.replace(/#.*/, '').trim())
            .filter(Boolean);
        expect(parsed.length).toBeGreaterThan(0);
    });

    it('совпадает с манифестом: список, разошедшийся с манифестом, — пожелание, а не описание', () => {
        const allowed = new Set(
            fs.readFileSync(FILE, 'utf8')
                .split('\n')
                .map((l) => l.replace(/#.*/, '').trim())
                .filter(Boolean),
        );
        const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
        const declared = [...manifest.matchAll(/uses-permission[^>]*android:name="([^"]+)"/g)].map((m) => m[1]);

        expect(declared.length).toBeGreaterThan(0);
        for (const p of declared) {
            expect(allowed.has(p), `${p} есть в манифесте, но не объявлено в ${FILE}`).toBe(true);
        }
        for (const p of allowed) {
            expect(declared.includes(p), `${p} объявлено в ${FILE}, но в манифесте его нет`).toBe(true);
        }
    });

    it('у каждого разрешения есть обоснование в комментарии над ним', () => {
        // Список без обоснований превращается в место, куда дописывают.
        const lines = fs.readFileSync(FILE, 'utf8').split('\n');
        for (let i = 0; i < lines.length; i += 1) {
            const value = lines[i].replace(/#.*/, '').trim();
            if (!value) continue;
            const above = lines.slice(Math.max(0, i - 8), i).filter((l) => l.trim().startsWith('#'));
            expect(above.length, `у ${value} нет обоснования выше по файлу`).toBeGreaterThan(0);
        }
    });
});
