import { describe, it, expect } from 'vitest';
import { matchClientIdentity } from '../match';

const IVAN = { id: 'client-1', name: 'Иван Иванов', phone: '+79001234567', email: 'ivan@example.com' };

describe('matchClientIdentity (Task 11 correction)', () => {
    it('exact phone match resolves automatically — the only case allowed to auto-select', () => {
        const result = matchClientIdentity({ name: 'Иван Иванов', phone: '89001234567' }, [IVAN]);
        expect(result.resolvedClientId).toBe('client-1');
        expect(result.matchReason).toBe('phone');
        expect(result.confidence).toBe('high');
    });

    it('exact email match resolves automatically', () => {
        const result = matchClientIdentity({ name: 'Кто-то другой', email: 'IVAN@example.com' }, [IVAN]);
        expect(result.resolvedClientId).toBe('client-1');
        expect(result.matchReason).toBe('email');
    });

    it('name-only match is NEVER auto-resolved — only suggested for review', () => {
        const result = matchClientIdentity({ name: 'Иван Иванов' }, [IVAN]);
        expect(result.resolvedClientId).toBeNull();
        expect(result.suggestedClientId).toBe('client-1');
        expect(result.matchReason).toBe('name_only');
        expect(result.confidence).toBe('medium');
    });

    it('same name but a phone that does NOT match the existing client is a conflict, not a match', () => {
        const result = matchClientIdentity({ name: 'Иван Иванов', phone: '+79009999999' }, [IVAN]);
        expect(result.resolvedClientId).toBeNull();
        expect(result.matchReason).toBe('conflict');
        // Still surfaced so the psychologist can look at it — just never auto-selected.
        expect(result.suggestedClientId).toBe('client-1');
    });

    it('no name, no identifier, no existing clients — review with nothing to suggest', () => {
        const result = matchClientIdentity({}, [IVAN]);
        expect(result.resolvedClientId).toBeNull();
        expect(result.suggestedClientId).toBeNull();
        expect(result.matchReason).toBe('none');
    });

    it('name matches two different existing clients — ambiguous, never auto-resolved, no single suggestion', () => {
        const IVAN2 = { id: 'client-2', name: 'Иван Иванов', phone: '+79005554433' };
        const result = matchClientIdentity({ name: 'Иван Иванов' }, [IVAN, IVAN2]);
        expect(result.resolvedClientId).toBeNull();
        expect(result.suggestedClientId).toBeNull();
        expect(result.matchReason).toBe('conflict');
    });

    it('no match at all for an unknown name', () => {
        const result = matchClientIdentity({ name: 'Совсем Другой' }, [IVAN]);
        expect(result.resolvedClientId).toBeNull();
        expect(result.suggestedClientId).toBeNull();
        expect(result.matchReason).toBe('none');
    });
});
