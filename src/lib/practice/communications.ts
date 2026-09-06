import { escapeHtml } from '@/lib/client-workflow';
import { extractFirstName } from '@/lib/person-name';

/**
 * A document title a psychologist typed may still be a raw filename
 * (e.g. "agreement_client_v2_final.pdf") — the client must never see
 * that in onboarding/client communication (Task 15, acceptance #2).
 */
export function humanizeDocumentTitle(title: string): string {
    const trimmed = title.trim();
    const withoutExt = trimmed.replace(/\.(pdf|docx?|xlsx?|txt|rtf|odt)$/i, '');
    const spaced = withoutExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return spaced || trimmed;
}

/**
 * Onboarding message for a client with no upcoming session yet — the ONE
 * shared builder for web (src/app/diary/actions/client-onboarding.ts) and
 * mobile (src/app/api/mobile/clients/[id]/onboarding/route.ts), so the two
 * never assemble independently-worded text (Task 15, acceptance #1, #7).
 *
 * Mirrors buildSessionClientMessage's mode:'html'|'plain' pattern in
 * src/lib/client-workflow.ts: html mode hides links behind readable anchor
 * text for channels that render HTML (Telegram); plain mode prints
 * "label: url" for manual share / channels without link markup (MAX).
 */
export function buildClientOnboardingMessage(params: {
    clientName: string;
    psychologistName: string;
    documentLinks?: Array<{ title: string; link: string }>;
    bookingLink: string;
    mode?: 'html' | 'plain';
}) {
    const html = (params.mode ?? 'html') === 'html';
    const esc = (s: string) => (html ? escapeHtml(s) : s);
    const link = (url: string, label: string) => (html ? `<a href="${escapeHtml(url)}">${esc(label)}</a>` : `${label}: ${url}`);

    const name = esc(extractFirstName(params.clientName) || params.clientName.trim());
    const psyName = esc(params.psychologistName);

    const lines: string[] = [
        `${name}, здравствуйте!`,
        '',
        `Специалист: ${psyName}.`,
    ];

    if (params.documentLinks?.length) {
        lines.push('', 'Записываясь на консультацию, вы соглашаетесь с условиями договора:');
        for (const d of params.documentLinks) {
            lines.push(link(d.link, humanizeDocumentTitle(d.title)));
        }
    }

    // Точка ставится только там, где адрес спрятан за текстом ссылки: в
    // plain-режиме точка сразу после URL прилипает к нему и ломает
    // автоопределение ссылки в мессенджере.
    lines.push('', html
        ? `Управлять записями можно <a href="${escapeHtml(params.bookingLink)}">здесь</a>.`
        : `Управлять записями можно здесь: ${params.bookingLink}`);

    return lines.join('\n');
}
