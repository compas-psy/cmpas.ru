import { describe, expect, it } from 'vitest';
import { buildTelegramShareUrl, buildWhatsAppShareUrl, humanizeUrl } from './buildShareUrls';

describe('buildTelegramShareUrl', () => {
    it('encodes the url and text as query params', () => {
        const result = buildTelegramShareUrl('https://cmpas.ru/bot/book/abc', 'Запишитесь на сессию');
        expect(result).toBe(
            'https://t.me/share/url?url=https%3A%2F%2Fcmpas.ru%2Fbot%2Fbook%2Fabc&text=%D0%97%D0%B0%D0%BF%D0%B8%D1%88%D0%B8%D1%82%D0%B5%D1%81%D1%8C%20%D0%BD%D0%B0%20%D1%81%D0%B5%D1%81%D1%81%D0%B8%D1%8E',
        );
    });

    it('is safe against ampersands and special characters in the text', () => {
        const result = buildTelegramShareUrl('https://cmpas.ru/u/anna', 'Записи & встречи?');
        expect(result).toContain('text=%D0%97%D0%B0%D0%BF%D0%B8%D1%81%D0%B8%20%26%20%D0%B2%D1%81%D1%82%D1%80%D0%B5%D1%87%D0%B8%3F');
        expect(result.match(/url=/g)?.length).toBe(1);
    });
});

describe('buildWhatsAppShareUrl', () => {
    it('puts the text before the url, space-separated, both encoded together', () => {
        const result = buildWhatsAppShareUrl('https://cmpas.ru/bot/book/abc', 'Запишитесь');
        expect(result).toBe('https://wa.me/?text=%D0%97%D0%B0%D0%BF%D0%B8%D1%88%D0%B8%D1%82%D0%B5%D1%81%D1%8C%20https%3A%2F%2Fcmpas.ru%2Fbot%2Fbook%2Fabc');
    });
});

describe('humanizeUrl', () => {
    it('strips the https protocol', () => {
        expect(humanizeUrl('https://cmpas.ru/bot/book/abc')).toBe('cmpas.ru/bot/book/abc');
    });

    it('strips the http protocol', () => {
        expect(humanizeUrl('http://cmpas.ru/u/anna')).toBe('cmpas.ru/u/anna');
    });

    it('leaves a url without protocol untouched', () => {
        expect(humanizeUrl('cmpas.ru/u/anna')).toBe('cmpas.ru/u/anna');
    });
});
