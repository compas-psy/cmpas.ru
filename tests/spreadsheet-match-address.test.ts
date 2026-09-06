// Task 13 §8/§22: cabinet/address resolution — exact unambiguous match
// auto-resolves; zero or multiple matches go to review, never guessed.
import { describe, it, expect } from 'vitest';
import { matchAddress } from '../src/lib/practice/migration/spreadsheet/match-address';

const addresses = [
    { id: 'addr-1', name: 'Центр', address: 'ул. Ленина, 10' },
    { id: 'addr-2', name: 'Кабинет на Пушкина', address: 'ул. Пушкина, 5' },
];

describe('matchAddress', () => {
    it('resolves an exact case/whitespace-insensitive name match', () => {
        expect(matchAddress('  центр  ', addresses)).toEqual({ ok: true, addressId: 'addr-1' });
    });
    it('resolves an exact address-field match', () => {
        expect(matchAddress('ул. Пушкина, 5', addresses)).toEqual({ ok: true, addressId: 'addr-2' });
    });
    it('returns ADDRESS_NOT_FOUND for zero matches', () => {
        expect(matchAddress('Несуществующий кабинет', addresses)).toEqual({ ok: false, errorCode: 'ADDRESS_NOT_FOUND' });
    });
    it('returns AMBIGUOUS_ADDRESS when the same text matches two different addresses', () => {
        const ambiguous = [...addresses, { id: 'addr-3', name: 'Центр', address: 'ул. Гагарина, 1' }];
        expect(matchAddress('Центр', ambiguous)).toEqual({ ok: false, errorCode: 'AMBIGUOUS_ADDRESS' });
    });
});
