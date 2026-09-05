import { db } from '@/lib/db';
import { track } from './track';

/**
 * Десять событий наблюдаемости запуска ПРАКТИКИ (Задача 25).
 *
 * Второго стека аналитики здесь нет: всё уходит через существующий track(),
 * который валидирует событие по analytics/schema/events.yaml и никогда не
 * бросает. Этот модуль — только типизированный фасад над ним, и нужен он
 * ровно за одним: чтобы в props физически нельзя было положить строку,
 * которой там быть не должно.
 *
 * Все строковые props ниже — узкие союзы, а не string. Имя, телефон, почта,
 * заметка, название события календаря, адрес, имя файла, идентификатор
 * клиента или сессии, токен записи или приглашения не пройдут ни как
 * отдельный prop, ни спрятанными внутрь source или error_code: там нет
 * места для произвольного текста ни на уровне типов, ни в реестре.
 *
 * correlation_id сюда не передаётся намеренно (Задача 25 §6): он нужен
 * поддержке в логах и в теле ответа об ошибке, а в поведенческой аналитике
 * уникальный идентификатор запроса — это ниточка к конкретному человеку.
 */

const PRODUCT = 'practice';

export type MigrationSource = 'calendar' | 'spreadsheet';
export type MigrationProvider = 'google' | 'yandex' | 'csv' | 'xlsx' | 'paste';
export type MigrationErrorCode =
    | 'unauthorized'
    | 'attestation_required'
    | 'no_integration'
    | 'provider_unavailable'
    | 'invalid_input'
    | 'commit_in_progress'
    | 'internal_error';

/** Пути записи, которые действительно существуют в ядре бронирования. */
export type BookingSource = 'public_booking' | 'known_client' | 'reschedule';
/**
 * Те же коды, которыми живёт BookingConflictError — не дубль.
 *
 * Кроме INVALID_TOKEN: устаревшая ссылка отсекается до попытки записи, а
 * значит конфликтом попытки не является (см. events.yaml).
 */
export type BookingErrorCode = 'SLOT_UNAVAILABLE' | 'CLIENT_ALREADY_BOOKED' | 'SESSION_NOT_FOUND';

/** Поверхность, с которой поделились постоянной ссылкой записи. */
export type ShareSurface = 'web' | 'android';

/** Вид проблемы «требует внимания», которую действительно закрыли. */
export type AttentionKind = 'session_without_notes' | 'session_unpaid' | 'client_without_consent';

type Account = { accountId: string | null | undefined };

function envelope(account: Account) {
    return { product: PRODUCT, accountId: account.accountId ?? null };
}

/**
 * Убирает props со значением undefined.
 *
 * Не косметика: реестр проверяет ТИП каждого присутствующего prop, а
 * `{ provider: undefined }` для него — присутствующий provider не-строкой.
 * Событие с таким props целиком отвергается, то есть необязательное поле,
 * которое просто нечем заполнить, молча съедало бы всё событие. Отсутствие
 * поля и поле со значением «ничего» — разные вещи, и наружу должно уходить
 * первое.
 */
function clean(props: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (value !== undefined) out[key] = value;
    }
    return out;
}

export function trackMigrationStarted(account: Account, props: { source: MigrationSource; provider?: MigrationProvider }): Promise<void> {
    return track(db, { event: 'practice_migration_started', ...envelope(account), props: clean(props) });
}

export function trackMigrationPreviewed(account: Account, props: {
    source: MigrationSource;
    provider?: MigrationProvider;
    items_count: number;
    ready_count?: number;
    review_count?: number;
    personal_count?: number;
    skipped_count?: number;
    error_count?: number;
}): Promise<void> {
    return track(db, { event: 'practice_migration_previewed', ...envelope(account), props: clean(props) });
}

export function trackMigrationCommitted(account: Account, props: {
    source: MigrationSource;
    provider?: MigrationProvider;
    imported_count: number;
    skipped_count: number;
    failed_count: number;
}): Promise<void> {
    return track(db, { event: 'practice_migration_committed', ...envelope(account), props: clean(props) });
}

export function trackMigrationFailed(account: Account, props: {
    source: MigrationSource;
    provider?: MigrationProvider;
    error_code: MigrationErrorCode;
}): Promise<void> {
    return track(db, { event: 'practice_migration_failed', ...envelope(account), props: clean(props) });
}

export function trackBookingLinkShared(account: Account, props: { source: ShareSurface }): Promise<void> {
    return track(db, { event: 'practice_booking_link_shared', ...envelope(account), props: clean(props) });
}

export function trackBookingAttempted(account: Account, props: { source: BookingSource }): Promise<void> {
    return track(db, { event: 'practice_booking_attempted', ...envelope(account), props: clean(props) });
}

export function trackBookingSucceeded(account: Account, props: { source: BookingSource }): Promise<void> {
    return track(db, { event: 'practice_booking_succeeded', ...envelope(account), props: clean(props) });
}

export function trackBookingConflict(account: Account, props: { source: BookingSource; error_code: BookingErrorCode }): Promise<void> {
    return track(db, { event: 'practice_booking_conflict', ...envelope(account), props: clean(props) });
}

export function trackAttentionActionCompleted(account: Account, props: { source: AttentionKind }): Promise<void> {
    return track(db, { event: 'practice_attention_action_completed', ...envelope(account), props: clean(props) });
}

export function trackOnboardingCompleted(account: Account): Promise<void> {
    return track(db, { event: 'practice_onboarding_completed', ...envelope(account), props: {} });
}
