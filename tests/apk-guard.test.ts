// Сторож готового пакета (scripts/check-apk.sh) — проверка самого сторожа.
//
// Настоящий APK здесь не собрать: Android SDK в этой среде нет. Раньше отсюда
// делался вывод «значит, разбор вывода инструментов проверить нельзя», и оба
// разборщика не проверялись ничем. Оба и сломались на первом же настоящем
// пакете (прогон 277, оба отказа — в сторожe, не в пакете):
//
//   * отпечаток подписи не прочитался: сторож искал строку
//     «Signer #1 certificate SHA-256 digest», а apksigner из build-tools 37
//     печатает метку иначе;
//   * разрешения не разобрались бы следующим шагом: разбор использовал
//     match($0, /../, arr) — это GNU-расширение, а awk на раннере GitHub —
//     mawk 1.3.4, где та же строка даёт синтаксическую ошибку и ноль строк.
//
// Вывод неверен: пакет нужен для ЗАПУСКА инструментов, но не для разбора их
// вывода. Разборщики вынесены в функции с точками входа --parse-signers и
// --parse-permissions и проверяются здесь на образцах настоящих форматов.
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

function parse(mode: '--parse-signers' | '--parse-permissions', input: string): string[] {
    const out = execFileSync('bash', [SCRIPT, mode], { encoding: 'utf8', input });
    return out.split('\n').filter(Boolean);
}

const EXPECTED = '0ddbf9d5407bb076e159e9e06d88a0ccb9029e6bb65ff4e9a49bf26f9d086fb8';

describe('разбор вывода apksigner', () => {
    it('классическая метка: Signer #1 certificate SHA-256 digest', () => {
        expect(parse('--parse-signers', [
            'Verified using v2 scheme (APK Signature Scheme v2): true',
            'Signer #1 certificate DN: CN=KOMPAS, OU=Mobile, O=cmpas.ru',
            `Signer #1 certificate SHA-256 digest: ${EXPECTED}`,
            'Signer #1 certificate SHA-1 digest: aabbccdd',
        ].join('\n'))).toEqual([EXPECTED]);
    });

    it('метка с диапазоном SDK — та форма, на которой сторож упал в прогоне 277', () => {
        const line = 'Signer (minSdkVersion=24, maxSdkVersion=2147483647) #1 certificate SHA-256 digest';
        expect(parse('--parse-signers', `${line}: ${EXPECTED.toUpperCase()}`)).toEqual([EXPECTED]);
    });

    it('отпечаток с двоеточиями между байтами', () => {
        const spaced = EXPECTED.match(/../g)!.join(':');
        expect(parse('--parse-signers', `Signer #1 certificate SHA-256 digest: ${spaced}`)).toEqual([EXPECTED]);
    });

    it('без отпечатка возвращает пусто, а не выдумывает значение', () => {
        expect(parse('--parse-signers', 'Verified using v2 scheme: true\nDOES NOT VERIFY')).toEqual([]);
    });

    it('не принимает за отпечаток строку неверной длины', () => {
        expect(parse('--parse-signers', 'Signer #1 certificate SHA-256 digest: deadbeef')).toEqual([]);
    });
});

describe('разбор разрешений из вывода aapt2', () => {
    it('одинарные кавычки — формат dump permissions', () => {
        expect(parse('--parse-permissions', [
            'package: ru.cmpas.app',
            "uses-permission: name='android.permission.INTERNET'",
            "uses-permission: name='android.permission.RECORD_AUDIO'",
        ].join('\n'))).toEqual([
            'android.permission.INTERNET',
            'android.permission.RECORD_AUDIO',
        ]);
    });

    it('двойные кавычки, отступ и uses-permission-sdk-23 — тоже разрешения', () => {
        expect(parse('--parse-permissions', [
            '  uses-permission: name="android.permission.INTERNET"',
            'uses-permission-sdk-23: name="android.permission.POST_NOTIFICATIONS"',
        ].join('\n'))).toEqual([
            'android.permission.INTERNET',
            'android.permission.POST_NOTIFICATIONS',
        ]);
    });

    it('не путает разрешения с прочими строками badging', () => {
        expect(parse('--parse-permissions', [
            "package: name='ru.cmpas.app' versionCode='7'",
            "application-label:'КОМПАС'",
            "uses-permission: name='android.permission.INTERNET'",
            "feature-group: label=''",
        ].join('\n'))).toEqual(['android.permission.INTERNET']);
    });

    it('на выводе без разрешений возвращает пусто — сторож на это отвечает отказом', () => {
        expect(parse('--parse-permissions', 'package: ru.cmpas.app\nno permissions here')).toEqual([]);
    });

    it('разбор не зависит от диалекта awk: mawk на раннере ломал прежнюю версию', () => {
        // Прежний разбор звал match($0, //, arr) — GNU-расширение. Проверяем,
        // что нынешний работает и там, где awk подменён на заведомо сломанный.
        const out = execFileSync('bash', [SCRIPT, '--parse-permissions'], {
            encoding: 'utf8',
            input: "uses-permission: name='android.permission.INTERNET'",
            env: { ...process.env, AWK: '/несуществующий/awk' },
        });
        expect(out.trim()).toBe('android.permission.INTERNET');
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

    // Разрешения бывают двух происхождений, и путать их нельзя.
    //
    // Одни пишем мы — они есть в шаблоне манифеста приложения. Другие
    // вписывает библиотека при слиянии манифестов, и в шаблоне их нет вовсе:
    // увидеть такое можно только в готовом пакете. Прежняя версия этой
    // проверки знала лишь про первые и требовала полного совпадения списка с
    // шаблоном — то есть честно внести библиотечное разрешение было нельзя, а
    // не внести значило уронить сборку на стороже. Измерено на настоящем
    // пакете: androidx.core вписывает
    // ru.cmpas.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION.
    //
    // Пометка «# ИЗ БИБЛИОТЕКИ» в списке разделяет эти два случая, и проверка
    // сверяет обе стороны: помеченного не должно быть в шаблоне, непомеченное
    // обязано в нём быть.
    function allowedEntries(): Array<{ name: string; fromLibrary: boolean }> {
        return fs.readFileSync(FILE, 'utf8')
            .split('\n')
            .map((line) => ({
                name: line.replace(/#.*/, '').trim(),
                fromLibrary: /#.*ИЗ БИБЛИОТЕКИ/.test(line),
            }))
            .filter((e) => e.name);
    }

    function manifestPermissions(): string[] {
        const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
        return [...manifest.matchAll(/uses-permission[^>]*android:name="([^"]+)"/g)].map((m) => m[1]);
    }

    it('всё, что объявлено в манифесте приложения, названо в списке', () => {
        const allowed = new Set(allowedEntries().map((e) => e.name));
        const declared = manifestPermissions();
        expect(declared.length).toBeGreaterThan(0);
        for (const p of declared) {
            expect(allowed.has(p), `${p} есть в манифесте, но не объявлено в ${FILE}`).toBe(true);
        }
    });

    it('непомеченное в списке обязано быть в манифесте — иначе список стал пожеланием', () => {
        const declared = manifestPermissions();
        for (const e of allowedEntries().filter((x) => !x.fromLibrary)) {
            expect(
                declared.includes(e.name),
                `${e.name} объявлено в ${FILE}, но в манифесте его нет. ` +
                    'Если его вписывает библиотека — пометьте строку «# ИЗ БИБЛИОТЕКИ».',
            ).toBe(true);
        }
    });

    it('помеченное «из библиотеки» не должно стоять в манифесте — иначе пометка врёт', () => {
        const declared = manifestPermissions();
        const fromLibrary = allowedEntries().filter((x) => x.fromLibrary);
        expect(fromLibrary.length, 'пометка «ИЗ БИБЛИОТЕКИ» не встретилась ни разу — проверка ничего не проверяет').toBeGreaterThan(0);
        for (const e of fromLibrary) {
            expect(
                declared.includes(e.name),
                `${e.name} помечено как приходящее из библиотеки, но объявлено и в манифесте приложения`,
            ).toBe(false);
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
