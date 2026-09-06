import { db } from '@/lib/db';
import { normalizePhone } from './phone';
import { parseVCard } from './vcard';
import { matchClientIdentity, type ClientIdentity } from './match';
import { createClientRecord } from './create';
import { ATTESTATION_REQUIRED_CODE } from '@/lib/practice/attestation';
import { trackClientIntakeContact, type ContactIntakeResult } from '@/lib/analytics/practice-events';

/**
 * Заведение клиента по контакту, который специалист переслал боту.
 *
 * Общий модуль для Telegram и MAX: мессенджеры отдают контакт по-разному
 * (Telegram — готовыми полями, MAX — строкой vCard), но дальше решения
 * одинаковые, и принимать их дважды нельзя — разойдутся.
 *
 * Чего этот модуль намеренно НЕ делает: не пишет клиенту, не привязывает
 * ему мессенджер и не заводит карточку без нажатия кнопки. Человек, чей
 * контакт переслали, о происходящем не знает и согласия не давал — всё,
 * что можно сделать на этом основании, это записать его в картотеку
 * специалиста, который и так является оператором его данных.
 */

export type ContactSource = 'telegram' | 'max';

/** Контакт из Telegram: message.contact. */
export interface TelegramContact {
    phone_number?: string;
    first_name?: string;
    last_name?: string;
    user_id?: number;
    vcard?: string;
}

/** Вложение contact из MAX: payload вложения message_created. */
export interface MaxContact {
    vcf_info?: string;
    max_info?: { user_id?: number; first_name?: string; last_name?: string; name?: string } | null;
}

export interface NormalizedContact {
    name?: string;
    phone?: string;
}

/** Срок жизни черновика. Короткий: в нём лежат имя и телефон живого человека. */
export const INTAKE_DRAFT_TTL_MS = 60 * 60 * 1000;

function joinName(first?: string | null, last?: string | null): string | undefined {
    const joined = [first, last].map((p) => (p || '').trim()).filter(Boolean).join(' ');
    return joined || undefined;
}

export function normalizeIncomingContact(source: ContactSource, raw: TelegramContact | MaxContact): NormalizedContact {
    const result: NormalizedContact = {};

    if (source === 'telegram') {
        const contact = raw as TelegramContact;
        const name = joinName(contact.first_name, contact.last_name)
            // У контакта без имени Telegram всё же может нести vCard.
            || (contact.vcard ? parseVCard(contact.vcard).fullName : undefined);
        const phone = normalizePhone(contact.phone_number);
        if (name) result.name = name;
        if (phone) result.phone = phone;
        return result;
    }

    const contact = raw as MaxContact;
    const parsed = contact.vcf_info ? parseVCard(contact.vcf_info) : {};
    // vCard — основной источник, max_info — запасной: карточка может быть
    // нечитаемой, но имя пользователя MAX при этом известно.
    const name = parsed.fullName
        || joinName(contact.max_info?.first_name, contact.max_info?.last_name)
        || (contact.max_info?.name || '').trim() || undefined;
    const phone = normalizePhone(parsed.phone);
    if (name) result.name = name;
    if (phone) result.phone = phone;
    return result;
}

export type PreviewKind =
    /** Отправитель не специалист — молча игнорируем. */
    | 'not_a_psychologist'
    /** Нет аттестации оператора ПДн: заводить карточку нельзя. */
    | 'attestation_required'
    /** Не хватает обязательного поля. */
    | 'incomplete'
    /** Совпал по телефону — карточка уже есть. */
    | 'existing'
    /** Совпал только по имени: подсказка, а не решение. */
    | 'suggested'
    /** Несколько карточек претендуют — решать должен человек в вебе. */
    | 'conflict'
    /** Новый клиент, ждём подтверждения. */
    | 'new';

export interface PreviewResult {
    kind: PreviewKind;
    psychologistId?: string;
    contact?: NormalizedContact;
    /** Какие обязательные поля отсутствуют: 'name' | 'phone'. */
    missing?: string[];
    existingClient?: { id: string; name: string };
    /** Какие пустые поля карточки можно дополнить из контакта. */
    fillable?: string[];
    draftId?: string;
}

/** Поля карточки, которые вообще заполняются из контакта. */
const FILLABLE_FIELDS = ['phone'] as const;

function fillableFrom(contact: NormalizedContact, client: { phone?: string | null }): string[] {
    const out: string[] = [];
    if (contact.phone && !client.phone) out.push('phone');
    return out;
}

async function resolvePsychologist(source: ContactSource, senderChatId: string): Promise<{ id: string } | null> {
    const where = source === 'telegram' ? { telegramChatId: senderChatId } : { maxChatId: senderChatId };
    return db.user.findUnique({ where, select: { id: true } });
}

async function hasAttestation(psychologistId: string): Promise<boolean> {
    // Гейт спрашиваем ДО создания черновика: иначе бот покажет кнопку
    // «Завести», а по нажатию откажет — обещание, которое не выполняется.
    const { hasPracticeOperatorAttestation } = await import('@/lib/practice/attestation');
    return hasPracticeOperatorAttestation(psychologistId);
}

export async function previewContactIntake(input: {
    source: ContactSource;
    senderChatId: string;
    contact: TelegramContact | MaxContact;
}): Promise<PreviewResult> {
    const psychologist = await resolvePsychologist(input.source, input.senderChatId);
    if (!psychologist) return { kind: 'not_a_psychologist' };

    if (!(await hasAttestation(psychologist.id))) {
        await report(psychologist.id, input.source, 'blocked_attestation');
        return { kind: 'attestation_required', psychologistId: psychologist.id };
    }

    const contact = normalizeIncomingContact(input.source, input.contact);

    // Обязательны имя и телефон: карточка без телефона не даёт связаться, а
    // без имени не даёт узнать человека в списке. Остальное заполняется в
    // карточке — через пересланный контакт мы это не тянем.
    const missing: string[] = [];
    if (!contact.name) missing.push('name');
    if (!contact.phone) missing.push('phone');
    if (missing.length > 0) {
        await report(psychologist.id, input.source, 'incomplete');
        return { kind: 'incomplete', psychologistId: psychologist.id, contact, missing };
    }

    const known: ClientIdentity[] = await db.diaryClient.findMany({
        where: { psychologistId: psychologist.id },
        select: { id: true, name: true, phone: true, email: true },
    });

    const match = matchClientIdentity({ name: contact.name, phone: contact.phone }, known);

    // «Конфликт» в matchClientIdentity означает две разные вещи. Если
    // подсказки нет — претендуют несколько карточек, и выбирать за
    // человека нельзя, отправляем в веб. Если подсказка есть — совпало
    // одно имя, но телефон карточки другой или отсутствует; это не повод
    // молчать, это повод спросить. Ни в одном из случаев решение
    // автоматически не принимается.
    if (match.matchReason === 'conflict' && !match.suggestedClientId) {
        await report(psychologist.id, input.source, 'conflict');
        return { kind: 'conflict', psychologistId: psychologist.id, contact };
    }

    const candidateId = match.resolvedClientId ?? match.suggestedClientId;
    const candidate = candidateId ? known.find((c) => c.id === candidateId) : undefined;

    if (candidate) {
        const fillable = fillableFrom(contact, candidate);
        const draft = await createDraft({
            psychologistId: psychologist.id,
            source: input.source,
            contact,
            existingClientId: candidate.id,
        });
        return {
            // Совпадение по телефону — решение, по имени — только подсказка.
            kind: match.resolvedClientId ? 'existing' : 'suggested',
            psychologistId: psychologist.id,
            contact,
            existingClient: { id: candidate.id, name: candidate.name },
            fillable,
            draftId: draft.id,
        };
    }

    const draft = await createDraft({
        psychologistId: psychologist.id,
        source: input.source,
        contact,
        existingClientId: null,
    });
    return { kind: 'new', psychologistId: psychologist.id, contact, draftId: draft.id };
}

async function createDraft(input: {
    psychologistId: string;
    source: ContactSource;
    contact: NormalizedContact;
    existingClientId: string | null;
}) {
    return db.clientIntakeDraft.create({
        data: {
            psychologistId: input.psychologistId,
            source: input.source,
            name: input.contact.name as string,
            phone: input.contact.phone ?? null,
            existingClientId: input.existingClientId,
            expiresAt: new Date(Date.now() + INTAKE_DRAFT_TTL_MS),
        },
    });
}

export type CommitAction = 'create' | 'fill' | 'cancel';

export type CommitKind =
    | 'not_found'
    | 'expired'
    | 'already_used'
    | 'attestation_required'
    | 'created'
    | 'filled'
    | 'nothing_to_fill'
    | 'cancelled';

export interface CommitResult {
    kind: CommitKind;
    clientId?: string;
    clientName?: string;
    /** Какие поля дополнили. */
    filled?: string[];
}

export async function commitContactIntake(input: {
    draftId: string;
    psychologistId: string;
    action: CommitAction;
}): Promise<CommitResult> {
    const draft = await db.clientIntakeDraft.findUnique({ where: { id: input.draftId } });

    // Чужой черновик не открывается по id: иначе, зная id, один специалист
    // завёл бы карточку в практике другого.
    if (!draft || draft.psychologistId !== input.psychologistId) return { kind: 'not_found' };
    if (draft.usedAt) return { kind: 'already_used' };
    if (draft.expiresAt.getTime() < Date.now()) return { kind: 'expired' };

    if (input.action === 'cancel') {
        await markUsed(draft.id);
        await report(input.psychologistId, draft.source as ContactSource, 'cancelled');
        return { kind: 'cancelled' };
    }

    if (input.action === 'fill') {
        if (!draft.existingClientId) return { kind: 'not_found' };
        const client = await db.diaryClient.findFirst({
            where: { id: draft.existingClientId, psychologistId: input.psychologistId },
            select: { id: true, name: true, phone: true, email: true },
        });
        if (!client) return { kind: 'not_found' };

        // Только пустые поля. Значение в карточке правил человек — оно
        // старше и достовернее того, что лежит в телефонной книге.
        const data: Record<string, string> = {};
        if (draft.phone && !client.phone) data.phone = draft.phone;

        if (Object.keys(data).length === 0) {
            await markUsed(draft.id);
            await report(input.psychologistId, draft.source as ContactSource, 'duplicate');
            return { kind: 'nothing_to_fill', clientId: client.id, clientName: client.name };
        }

        await db.diaryClient.update({ where: { id: client.id }, data });
        await markUsed(draft.id);
        await report(input.psychologistId, draft.source as ContactSource, 'filled');
        return { kind: 'filled', clientId: client.id, clientName: client.name, filled: Object.keys(data) };
    }

    try {
        const client = await createClientRecord({
            psychologistId: input.psychologistId,
            name: draft.name,
            phone: draft.phone,
        });
        await markUsed(draft.id);
        await report(input.psychologistId, draft.source as ContactSource, 'created');
        return { kind: 'created', clientId: client.id, clientName: client.name };
    } catch (e) {
        // Аттестацию могли отозвать между показом кнопки и нажатием.
        if (e instanceof Error && e.message === ATTESTATION_REQUIRED_CODE) {
            return { kind: 'attestation_required' };
        }
        throw e;
    }
}

/**
 * Отчёт в аналитику: только мессенджер и исход.
 *
 * Ни имени, ни телефона, ни идентификатора клиента — событие о том, ЧТО
 * произошло, а не с кем. Типы в practice-events сужены до перечислений,
 * поэтому произвольный текст сюда не пролезет даже по ошибке.
 */
async function report(psychologistId: string, source: ContactSource, result: ContactIntakeResult): Promise<void> {
    await trackClientIntakeContact({ accountId: psychologistId }, { source, result });
}

async function markUsed(draftId: string): Promise<void> {
    await db.clientIntakeDraft.update({ where: { id: draftId }, data: { usedAt: new Date() } });
}

/**
 * Удалить истёкшие черновики.
 *
 * Не гигиена ради гигиены: в строке лежат имя и телефон человека, который
 * согласия не давал. Черновик нужен ровно на время, пока специалист
 * решает, нажимать ли кнопку.
 */
export async function expireContactIntakeDrafts(now: Date = new Date()): Promise<number> {
    const result = await db.clientIntakeDraft.deleteMany({ where: { expiresAt: { lt: now } } });
    return result.count;
}

export { FILLABLE_FIELDS };
