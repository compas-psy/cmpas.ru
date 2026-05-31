export function normalizePhone(raw?: string | null): string | null {
    if (!raw) return null;

    const trimmed = raw.trim();
    if (!trimmed) return null;

    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return null;

    if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
        return `+7${digits.slice(1)}`;
    }

    if (digits.length === 10) {
        return `+7${digits}`;
    }

    return `+${digits}`;
}

export function phoneLookupVariants(raw?: string | null): string[] {
    const normalized = normalizePhone(raw);
    if (!raw && !normalized) return [];

    const digits = (raw || normalized || '').replace(/\D/g, '');
    const variants = new Set<string>();

    if (normalized) variants.add(normalized);
    if (raw?.trim()) variants.add(raw.trim());
    if (digits) {
        variants.add(digits);
        variants.add(`+${digits}`);
        if (digits.length === 11 && digits.startsWith('8')) variants.add(`+7${digits.slice(1)}`);
        if (digits.length === 11 && digits.startsWith('7')) variants.add(`8${digits.slice(1)}`);
        if (digits.length === 10) {
            variants.add(`+7${digits}`);
            variants.add(`8${digits}`);
            variants.add(`7${digits}`);
        }
    }

    return Array.from(variants).filter(Boolean);
}

export function phonesMatch(a?: string | null, b?: string | null): boolean {
    const na = normalizePhone(a);
    const nb = normalizePhone(b);
    return !!na && !!nb && na === nb;
}
