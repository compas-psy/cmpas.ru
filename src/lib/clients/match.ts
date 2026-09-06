// Task 11 (founder correction): a name is not an identity. The previous
// classify.ts matched purely on a case-insensitive name string and treated
// that as a resolved client — but two different clients can share a first
// name, and a psychologist manually renaming/correcting a card would
// silently re-link future imports to the wrong person. The only signal
// strong enough to auto-resolve without a human looking at it is an exact
// phone or email match. A name match is always a *suggestion*, never a
// decision — the psychologist must explicitly confirm it (see classify.ts,
// import-calendar/page.tsx) or it stays in 'review'.
import { phonesMatch } from './phone';

export interface ClientIdentity {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
}

export interface MatchInput {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
}

export type MatchReason = 'phone' | 'email' | 'name_only' | 'conflict' | 'none';
export type MatchConfidence = 'high' | 'medium' | 'low';

export interface MatchResult {
    /** Set ONLY for a strong (phone/email) exact, unambiguous match — the only case safe to auto-select. */
    resolvedClientId: string | null;
    /** A candidate worth showing the psychologist, but never pre-selected on their behalf. */
    suggestedClientId: string | null;
    matchReason: MatchReason;
    confidence: MatchConfidence;
}

function normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function dedupeById(clients: ClientIdentity[]): ClientIdentity[] {
    const seen = new Map<string, ClientIdentity>();
    for (const c of clients) seen.set(c.id, c);
    return Array.from(seen.values());
}

export function matchClientIdentity(input: MatchInput, existingClients: ClientIdentity[]): MatchResult {
    const phoneMatches = input.phone
        ? existingClients.filter((c) => c.phone && phonesMatch(c.phone, input.phone))
        : [];
    const emailMatches = input.email
        ? existingClients.filter((c) => c.email && normalizeEmail(c.email) === normalizeEmail(input.email!))
        : [];
    const strongMatches = dedupeById([...phoneMatches, ...emailMatches]);

    if (strongMatches.length === 1) {
        const client = strongMatches[0];
        return {
            resolvedClientId: client.id,
            suggestedClientId: client.id,
            matchReason: phoneMatches.some((c) => c.id === client.id) ? 'phone' : 'email',
            confidence: 'high',
        };
    }
    if (strongMatches.length > 1) {
        // Two different existing clients both match a strong identifier we
        // were given (e.g. a shared office landline) — never auto-resolve.
        return { resolvedClientId: null, suggestedClientId: null, matchReason: 'conflict', confidence: 'low' };
    }

    const nameMatches = input.name
        ? existingClients.filter((c) => normalizeName(c.name) === normalizeName(input.name!))
        : [];

    if (nameMatches.length === 1) {
        // Same name found, but we were given a phone/email that did NOT
        // match this client (or matched nobody) — the identifiers
        // disagree, so this is a conflict to review, not a plain suggestion.
        if (input.phone || input.email) {
            return { resolvedClientId: null, suggestedClientId: nameMatches[0].id, matchReason: 'conflict', confidence: 'low' };
        }
        return { resolvedClientId: null, suggestedClientId: nameMatches[0].id, matchReason: 'name_only', confidence: 'medium' };
    }
    if (nameMatches.length > 1) {
        // Ambiguous — more than one existing client shares this name.
        return { resolvedClientId: null, suggestedClientId: null, matchReason: 'conflict', confidence: 'low' };
    }

    return { resolvedClientId: null, suggestedClientId: null, matchReason: 'none', confidence: 'low' };
}
