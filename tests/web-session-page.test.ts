// Под настоящим адресом не должно лежать выдуманного человека.
//
// До 10.09.2026 по /diary/session/<id> открывалась раскладка-заглушка:
// «Алексей Смирнов», таймер 42:15, анамнез «32 года, работает в IT»,
// домашнее задание «Дневник СМЭР». Ничего этого не существовало — а адрес
// был настоящий: пункт «оплата не отмечена» из «требует внимания» ведёт
// ровно сюда (attentionHref, src/app/diary/page.tsx). Специалист нажимал на
// свою неоплаченную встречу и попадал в чужую придуманную жизнь.
//
// Проверка держит две вещи: выдуманных данных на этих страницах больше нет,
// и правило «что можно сделать с этой встречей» на вебе то же самое, что в
// приложении, — а не написано заново рядом.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const SESSION_PAGE = path.join(process.cwd(), 'src/app/(bot)/diary/session/[id]/page.tsx');
const CLIENT_PAGE = path.join(process.cwd(), 'src/app/(bot)/diary/client/[id]/page.tsx');

/** Текст без строк комментариев: объяснение «здесь было X» — не показ X. */
function code(file: string): string {
    return readFileSync(file, 'utf8')
        .split('\n')
        .filter(line => {
            const trimmed = line.trimStart();
            return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
        })
        .join('\n');
}

describe('страница встречи в вебе', () => {
    it('не содержит выдуманного клиента и его анамнеза', () => {
        const body = code(SESSION_PAGE);
        for (const invented of ['Алексей Смирнов', '42:15', 'работает в IT', 'Дневник СМЭР', 'Снижение тревоги']) {
            expect(body).not.toContain(invented);
        }
    });

    it('читает настоящую встречу настоящего специалиста', () => {
        expect(code(SESSION_PAGE)).toContain('session-view');
    });

    it('пользуется общим с приложением правилом, а не своим', () => {
        // Расхождение здесь тем и опасно, что не падает: просто в вебе кнопка
        // есть, а в телефоне нет.
        const body = code(SESSION_PAGE);
        expect(body).toContain('sessionActions');
        expect(body).toContain('paymentActionLabel');
    });
});

describe('карточка клиента по старому адресу', () => {
    it('не показывает выдуманного клиента', () => {
        expect(code(CLIENT_PAGE)).not.toContain('Алексей Смирнов');
    });

    it('ведёт туда, где карточка действительно есть', () => {
        const body = code(CLIENT_PAGE);
        expect(body).toContain('redirect');
        expect(body).toContain('/diary/clients?clientId=');
    });
});
