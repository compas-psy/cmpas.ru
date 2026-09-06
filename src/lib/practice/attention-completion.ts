import { hasSessionNotes } from '@/lib/session-maintenance';
import { trackAttentionActionCompleted } from '@/lib/analytics/practice-events';

/**
 * Когда проблема из «Требует внимания» действительно закрыта (Задача 25 §8).
 *
 * Смысл события — не «человек нажал», а «проблемы больше нет». Открытая
 * карточка сессии, открытый документ и открытая шторка оплаты не закрывают
 * ничего: заметку можно не написать, документ не подписать, оплату не
 * отметить. Поэтому решение принимается не по клику, а по переходу: было
 * плохо — стало хорошо.
 *
 * Правила перехода живут здесь одни на всех, чтобы веб и приложение не
 * разошлись в том, что считать закрытием. Наружу не уходит ничего, кроме
 * вида проблемы: ни sessionId, ни clientId, ни текста заметки.
 */

type NoteFields = { notes?: string | null; clientSummary?: string | null; structuredNotes?: unknown };

/**
 * Заметка появилась там, где её не было.
 *
 * Пустое сохранение (человек открыл форму и закрыл) переходом не является,
 * как и повторное редактирование уже написанной заметки: проблема была
 * закрыта раньше. Признак «заметка есть» — тот же hasSessionNotes, которым
 * список внимания и считает эти сессии, иначе события и список разошлись бы.
 */
export async function observeNotesFilled(
    psychologistId: string,
    before: NoteFields,
    after: NoteFields,
): Promise<void> {
    if (hasSessionNotes(before) || !hasSessionNotes(after)) return;
    await trackAttentionActionCompleted({ accountId: psychologistId }, { source: 'session_without_notes' });
}

/**
 * Оплата действительно перестала быть неотмеченной.
 *
 * В списке внимания стоят только сессии с paymentStatus = 'unpaid', поэтому
 * закрытием считается уход именно из этого состояния — в 'paid' или в
 * 'not_required'. Повторная отметка «оплачено» у уже оплаченной сессии
 * ничего не закрывает.
 */
export async function observePaymentSettled(
    psychologistId: string,
    before: string | null | undefined,
    after: string,
): Promise<void> {
    if (before !== 'unpaid' || after === 'unpaid') return;
    await trackAttentionActionCompleted({ accountId: psychologistId }, { source: 'session_unpaid' });
}

/**
 * Согласие записано у клиента, у которого его не было.
 *
 * Повторное подтверждение согласия (новая версия документа у клиента,
 * который уже соглашался) проблему «нет согласия» не закрывает — её не было.
 */
export async function observeConsentRecorded(
    psychologistId: string,
    before: Date | null | undefined,
): Promise<void> {
    if (before) return;
    await trackAttentionActionCompleted({ accountId: psychologistId }, { source: 'client_without_consent' });
}
