/**
 * Pure URL builders for the unified "Поделиться" sheet. No side effects,
 * no DOM access — kept separate from ShareSheet.tsx so the link-building
 * logic is testable without mocking navigator/clipboard/window.
 */

export function buildTelegramShareUrl(url: string, text: string): string {
    return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export function buildWhatsAppShareUrl(url: string, text: string): string {
    return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
}

/** Human-readable form for display — strips protocol, keeps host+path. */
export function humanizeUrl(url: string): string {
    return url.replace(/^https?:\/\//, '');
}
