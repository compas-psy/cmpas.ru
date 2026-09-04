// Task 13 §8: resolve a spreadsheet's free-text cabinet/address column
// against the psychologist's own PsychologistAddress rows. Only an exact,
// unambiguous normalized match auto-resolves; zero or multiple matches go
// to review — never guessed, never auto-picked.

export interface AddressRow {
    id: string;
    name: string;
    address: string;
}

export type AddressMatchResult =
    | { ok: true; addressId: string }
    | { ok: false; errorCode: 'ADDRESS_NOT_FOUND' | 'AMBIGUOUS_ADDRESS' };

function normalize(s: string): string {
    return s.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

export function matchAddress(raw: string, addresses: AddressRow[]): AddressMatchResult {
    const needle = normalize(raw);
    const matches = addresses.filter((a) => normalize(a.name) === needle || normalize(a.address) === needle);
    const uniqueIds = Array.from(new Set(matches.map((m) => m.id)));
    if (uniqueIds.length === 1) return { ok: true, addressId: uniqueIds[0] };
    if (uniqueIds.length > 1) return { ok: false, errorCode: 'AMBIGUOUS_ADDRESS' };
    return { ok: false, errorCode: 'ADDRESS_NOT_FOUND' };
}
