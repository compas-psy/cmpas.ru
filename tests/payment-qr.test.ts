import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { paymentQrSource, paymentQrPng, PAYMENT_QR_CAPTION } from '@/lib/messaging/payment-qr';

/**
 * Код оплаты рисуется ИЗ ССЫЛКИ, которую дал специалист.
 *
 * Раньше код существовал, только если специалист отдельно положил адрес
 * готовой картинки. У большинства заполнена одна ссылка — статическая
 * ссылка СБП, — и клиент получал длинную строку, которую надо скопировать
 * с того же телефона, на котором он её читает.
 */

const SBP_LINK = 'https://qr.nspk.ru/AD10006L5QFVJJQO8P2C9T7A3RDAQF11?type=01&bank=100000000111&sum=500000&cur=RUB';

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
    const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf-8');

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
            expect(source).toContain('PAYMENT_QR_CAPTION');
        }
    });

    it('подпись под кодом ничего не обещает от имени сервиса', () => {
        // ПРАКТИКА оплату не принимает и её поступление не подтверждает.
        expect(PAYMENT_QR_CAPTION).not.toMatch(/оплачен|подтвер|гарант/i);
    });
});
