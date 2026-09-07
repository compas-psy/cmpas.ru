// Ссылка, которой бот отвечает на пересланный контакт, должна вести туда,
// где просьбу можно выполнить.
//
// Как это сломалось в первый раз: бот отвечал «подтвердите, что вы
// оператор персональных данных» и давал ссылку на /diary/clients. А окно
// подтверждения существовало ТОЛЬКО как реакция на неудачную попытку
// завести клиента — по ссылке открывался обычный список, где не
// спрашивают ничего. Человек приходил выполнить просьбу и не находил,
// чем её выполнить; виноватым в таком месте люди считают себя.
//
// Разъехаться этим двум местам легко: они в разных файлах и меняются по
// разным поводам. Поэтому сторож держит их вместе.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { previewMessage, commitMessage } from '../src/lib/clients/contact-intake-messages';

const APP = 'https://cmpas.ru';
const PAGE = readFileSync(path.join(process.cwd(), 'src/app/diary/clients/page.tsx'), 'utf8');

describe('ссылка на подтверждение из бота', () => {
    it('на пересланный контакт без аттестации бот даёт ссылку, открывающую подтверждение', () => {
        const reply = previewMessage({ kind: 'attestation_required', psychologistId: 'psy_1' }, APP);

        expect(reply).not.toBeNull();
        expect(reply!.text).toContain('/diary/clients?attest=1');
    });

    it('то же самое при нажатии кнопки, когда аттестации всё ещё нет', () => {
        const text = commitMessage({ kind: 'attestation_required' }, APP);

        expect(text).toContain('/diary/clients?attest=1');
    });

    it('страница клиентов этот параметр читает и открывает окно', () => {
        // Без этой ветки ссылка снова стала бы вести в никуда — молча,
        // потому что страница по такому адресу открывается штатно.
        expect(PAGE).toContain("get('attest') !== '1'");
        expect(PAGE).toContain('openAttestation');
    });

    it('уже подтвердившему окно не показывают', () => {
        // «Прежде чем добавить первого клиента» тому, кто это давно сделал,
        // — неправда, пусть и безобидная.
        expect(PAGE).toContain('checkPracticeOperatorAttestation');
    });

    it('сообщения не про аттестацию ведут на обычный список', () => {
        // Параметр — не украшение: он открывает юридическое окно. В ответе
        // «готово, клиент заведён» ему делать нечего.
        const done = commitMessage({ kind: 'created', clientId: 'c1', clientName: 'Андрей С.' }, APP);
        const incomplete = previewMessage(
            { kind: 'incomplete', psychologistId: 'psy_1', contact: { name: 'Андрей' }, missing: ['phone'] },
            APP,
        );

        expect(done).toContain('/diary/clients');
        expect(done).not.toContain('attest=1');
        expect(incomplete!.text).not.toContain('attest=1');
    });
});
