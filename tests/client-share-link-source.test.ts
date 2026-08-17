import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

// O-260817-10: the personal booking link must always come from the signed
// getClientBookingLink() server action — never be assembled by hand as
// `?c=${clientId}` in markup, which would ship the raw DiaryClient.id again.
describe('diary/clients page never builds the client booking link by hand', () => {
    const source = readFileSync(
        path.resolve(import.meta.dirname, '../src/app/diary/clients/page.tsx'),
        'utf8',
    );

    it('contains no hand-built "?c=" query param', () => {
        expect(source).not.toContain('?c=');
    });

    it('sources the share link from getClientBookingLink', () => {
        expect(source).toContain('getClientBookingLink');
    });
});
