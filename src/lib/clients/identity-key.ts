// A strong-identity key: normalized phone, else normalized email, else
// normalized name. Used wherever two records need to be recognized as "the
// same client" without a database id yet — e.g. two rows in one Task 13
// spreadsheet/paste submission that both create "a new client" but share a
// phone number must collapse into ONE created client, not two (see
// commit.ts's per-batch running-new-client map and spreadsheet/fingerprint.ts).
// A bare name alone is intentionally the weakest fallback — matchClientIdentity
// never treats a name-only match as a decision, only this narrower same-
// batch collapsing does, and only when nothing stronger was given.
import { normalizePhone } from './phone';

export interface ClientKeyInput {
    phone?: string | null;
    email?: string | null;
    name: string;
}

export function computeClientKey(input: ClientKeyInput): string {
    const phone = normalizePhone(input.phone);
    if (phone) return `phone:${phone}`;
    const email = (input.email ?? '').trim().toLowerCase();
    if (email) return `email:${email}`;
    return `name:${input.name.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}
