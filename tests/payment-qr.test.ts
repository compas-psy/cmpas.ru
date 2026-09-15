import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { paymentQrSource, paymentQrPng, paymentQrCaption } from '@/lib/messaging/payment-qr';
import { extractLinksForButtons } from '@/lib/messaging/format';

/**
 * Код оплаты рисуется ИЗ ССЫЛКИ, которую дал специалист.
 *
 * Раньше код существовал, только если специалист отдельно положил адрес
 * готовой картинки. У большинства заполнена одна ссылка — статическая
 * ссылка СБП, — и клиент получал длинную строку, которую надо скопировать
 * с того же телефона, на котором он её читает.
 */

const SBP_LINK = 'https://qr.nspk.ru/AD10006L5QFVJJQO8P2C9T7A3RDAQF11?type=01&bank=100000000111&sum=500000&cur=RUB';

/** Часть проверок смотрит на сам исходник: воспроизводить диалог с двумя
 *  мессенджерами дороже, чем стеречь правило в коде отправки. */
const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf-8');

describe('откуда берётся код', () => {
    it('из ссылки оплаты, если готовой картинки нет', () => {
        expect(paymentQrSource({ paymentLink: SBP_LINK, paymentQrUrl: null })).toBe(SBP_LINK);
    });

    it('готовая картинка от банка сильнее: рисовать не нужно', () => {
        // В ней бывает логотип и сумма, которых в голой ссылке нет.
        expect(paymentQrSource({ paymentLink: SBP_LINK, paymentQrUrl: 'https://bank.example/qr.png' })).toBeNull();
    });

    it('нечего рисовать — ничего и не рисуем', () => {
        expect(paymentQrSource({ paymentLink: null, paymentQrUrl: null })).toBeNull();
        expect(paymentQrSource({ paymentLink: '   ', paymentQrUrl: null })).toBeNull();
    });
});

describe('сам код', () => {
    it('получается настоящей картинкой PNG', async () => {
        const png = await paymentQrPng(SBP_LINK);
        // Подпись PNG: 89 50 4E 47 — иначе это не картинка, а что-то,
        // что мессенджер отвергнет молча.
        expect(png.subarray(0, 4).toString('hex')).toBe('89504e47');
        expect(png.length).toBeGreaterThan(500);
    });

    it('длинная ссылка СБП помещается целиком', async () => {
        // Ссылка СБП с суммой и банком длиннее сотни знаков: версия кода
        // должна расти сама, иначе qrcode бросит, а клиент останется без
        // кода и без объяснения.
        await expect(paymentQrPng(SBP_LINK + '&extra=' + 'x'.repeat(200))).resolves.toBeInstanceOf(Buffer);
    });
});

describe('куда он уходит', () => {
    it('картинка отправляется телом запроса, а не публичным адресом', () => {
        // Публичный адрес пришлось бы открыть наружу, чтобы его достал
        // Telegram, — то есть выложить ссылку оплаты конкретного
        // специалиста всем.
        const telegram = read('src/lib/telegram.ts');
        expect(telegram).toContain('sendPhoto');
        expect(telegram).toContain("form.append('photo'");
    });

    it('оба пути заведения клиента шлют код следом за текстом', () => {
        for (const path of [
            'src/app/diary/actions/client-onboarding.ts',
            'src/app/api/mobile/clients/[id]/onboarding/route.ts',
        ]) {
            const source = read(path);
            expect(source, `${path} не шлёт код`).toContain('paymentQrForClient');
            expect(source).toContain('paymentQrCaption');
        }
    });

    it('подпись под кодом ничего не обещает от имени сервиса', () => {
        // ПРАКТИКА оплату не принимает и её поступление не подтверждает.
        expect(paymentQrCaption(SBP_LINK)).not.toMatch(/оплачен|подтвер|гарант/i);
        expect(paymentQrCaption(null)).not.toMatch(/оплачен|подтвер|гарант/i);
    });

    it('Telegram отправляет подпись с разметкой, иначе якорь приедет тегом', () => {
        const telegram = read('src/lib/telegram.ts');
        expect(telegram).toMatch(/form\.append\('parse_mode', 'HTML'\)/);
    });
});

/**
 * ВЫБОР ПОД КОДОМ.
 *
 * Учредитель 15.09.2026: «нужно чтобы у человека был выбор — или
 * отсканировать QR, или перейти по ссылке». Под картинкой выбора не было:
 * камера или ничего.
 */
describe('подпись даёт второй способ заплатить', () => {
    it('ссылка стоит за словом, а не голым адресом', () => {
        const caption = paymentQrCaption(SBP_LINK);
        expect(caption).toContain('Перейти к оплате');
        // Адрес есть только внутри якоря: голым в тексте он не стоит.
        expect(caption.replace(/<a href="[^"]*">/g, '')).not.toContain('qr.nspk.ru');
    });

    it('это ТА ЖЕ ссылка, которая зашита в самом коде', () => {
        // Иначе камера и палец ведут в разные места — и одно из них неверное.
        const source = paymentQrSource({ paymentLink: SBP_LINK, paymentQrUrl: null });
        expect(paymentQrCaption(source)).toContain(SBP_LINK.replace(/&/g, '&amp;'));
    });

    it('в MAX превращается в кнопку под картинкой', () => {
        // У MAX нет разметки, но есть кнопки со ссылкой; отправка картинки
        // обязана вынимать якорь так же, как это делает отправка текста.
        const { text, links } = extractLinksForButtons(paymentQrCaption(SBP_LINK));
        expect(links).toEqual([{ label: 'Перейти к оплате', url: SBP_LINK }]);
        expect(text).toContain('наведите камеру телефона');
        expect(text).not.toContain('<a');

        const maxBot = read('src/lib/max-bot.ts');
        const sendPhoto = maxBot.slice(maxBot.indexOf('export async function sendMaxPhoto'));
        expect(sendPhoto).toContain('extractLinksForButtons');
        expect(sendPhoto).toContain('inline_keyboard');
    });

    it('ссылки нет — подпись остаётся прежней и код всё равно уходит', () => {
        expect(paymentQrCaption(null)).toBe('Код для оплаты — наведите камеру телефона');
        expect(paymentQrCaption('   ')).toBe('Код для оплаты — наведите камеру телефона');
    });

    it('код важнее кнопки: не принял MAX картинку с кнопкой — уходит без неё', () => {
        // Сообщение «картинка + клавиатура» на живом ответе MAX не
        // проверялось. Если он его не примет, человек не должен остаться
        // вовсе без кода.
        const maxBot = read('src/lib/max-bot.ts');
        const sendPhoto = maxBot.slice(maxBot.indexOf('export async function sendMaxPhoto'));
        expect(sendPhoto).toContain('attempt([image])');
    });
});
