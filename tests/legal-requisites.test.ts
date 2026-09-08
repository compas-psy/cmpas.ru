import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
    OPERATOR_EMAIL,
    OPERATOR_INN,
    OPERATOR_OGRNIP,
    SERVICE_NAME,
} from '@/lib/legal/operator';

/**
 * Документ, который не называет оператора, не выполняет своей работы.
 *
 * Как было до этой проверки: реквизиты переписаны в каждом документе
 * отдельно — и разошлись. В согласии на рекламу стояли ПЛЕЙСХОЛДЕРЫ
 * «{{ОГРНИП}}» и «{{ИНН}}»: человек подписывал согласие, в котором оператор
 * назван двумя фигурными скобками. В оферте и политике адресом оператора
 * стояла личная почта учредителя на gmail. Сервис назывался то CMPAS, то
 * Compas — латиницей, при том что система называется СИМПАС.
 *
 * По 152-ФЗ субъект должен знать, кому он даёт согласие и куда обращаться за
 * отзывом. Поэтому проверка не косметическая и живёт отдельно от глаз.
 */

const LEGAL_DIR = join(__dirname, '..', 'src', 'app', 'legal');

function legalPages(dir = LEGAL_DIR): string[] {
    return readdirSync(dir).flatMap(entry => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            return entry === '__tests__' ? [] : legalPages(full);
        }
        return entry === 'page.tsx' ? [full] : [];
    });
}

const pages = legalPages();
const shortPath = (p: string) => p.slice(p.indexOf('src/app/legal'));

describe('реквизиты оператора в юридических документах', () => {
    it('страницы документов вообще найдены', () => {
        // Без этого пустой список сделал бы все проверки ниже зелёными и
        // бессмысленными.
        expect(pages.length).toBeGreaterThanOrEqual(5);
    });

    it.each(pages.map(p => [shortPath(p), p]))('%s: без личной почты учредителя', (_name, file) => {
        expect(readFileSync(file, 'utf-8')).not.toContain('eliah.n.martynov@gmail.com');
    });

    it.each(pages.map(p => [shortPath(p), p]))('%s: без незаполненных плейсхолдеров', (_name, file) => {
        // Ловит и «{{ОГРНИП}}», и любой другой оставленный шаблон.
        expect(readFileSync(file, 'utf-8')).not.toMatch(/\{\{[^}]+\}\}/);
    });

    it.each(pages.map(p => [shortPath(p), p]))('%s: сервис назван СИМПАС, а не латиницей', (_name, file) => {
        const text = readFileSync(file, 'utf-8');
        // Домен cmpas.ru — это адрес, а не имя сервиса; он остаётся.
        const withoutDomain = text.replace(/cmpas\.ru/g, '');
        expect(withoutDomain).not.toMatch(/\bCMPAS\b/i);
        expect(withoutDomain).not.toMatch(/\bCompas\b/);
    });

    it('оферта, политика и согласие называют ОГРНИП и ИНН', () => {
        const required = ['terms', 'privacy', 'consent/marketing'];
        for (const doc of required) {
            const file = pages.find(p => p.includes(join('legal', ...doc.split('/'))));
            expect(file, `нет страницы ${doc}`).toBeTruthy();
            const text = readFileSync(file!, 'utf-8');
            expect(text, `${doc} без ОГРНИП`).toContain('OPERATOR_OGRNIP');
            expect(text, `${doc} без ИНН`).toContain('OPERATOR_INN');
        }
    });
});

describe('значения реквизитов', () => {
    it('ОГРНИП индивидуального предпринимателя — 15 цифр', () => {
        expect(OPERATOR_OGRNIP).toMatch(/^\d{15}$/);
    });

    it('ИНН физического лица — 12 цифр', () => {
        expect(OPERATOR_INN).toMatch(/^\d{12}$/);
    });

    it('адрес обращений — на домене сервиса, а не личный', () => {
        // Личный ящик не переживает смену человека, который его читает, и
        // раскрывает частный контакт каждому, кто открыл политику.
        expect(OPERATOR_EMAIL).toMatch(/@cmpas\.ru$/);
    });

    it('название сервиса — кириллицей', () => {
        expect(SERVICE_NAME).toBe('СИМПАС');
    });
});
