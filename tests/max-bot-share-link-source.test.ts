import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

// O-260817-10 / O-260818-01: every MAX-bot booking link goes through
// maxBookUrl(), which signs the `c` param with personalClientToken() — never
// a hand-built `?c=${clientId}` with the raw DiaryClient.id, same rule as
// tests/client-share-link-source.test.ts enforces for diary/clients/page.tsx.
describe('max-bot booking links never carry a raw clientId', () => {
    const source = readFileSync(
        path.resolve(import.meta.dirname, '../src/lib/max-bot.ts'),
        'utf8',
    );

    it('signs the client param inside maxBookUrl with personalClientToken', () => {
        const helper = source.match(/function maxBookUrl[\s\S]*?\n}/)?.[0];
        expect(helper).toBeDefined();
        expect(helper).toContain('personalClientToken(clientId)');
    });

    it('contains no hand-built "?c=" query param outside maxBookUrl', () => {
        expect(source).not.toMatch(/\?c=\$\{/);
    });
});
