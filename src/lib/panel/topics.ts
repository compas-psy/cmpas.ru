/**
 * Закрытый словарь тем обращений (ТЗ §8, правило 4).
 *
 * На панель попадает только тема из этого списка и число — никогда текст
 * обращения. Произвольная строка сюда не проходит, и это проверяется тестом
 * `__tests__/privacy.test.ts`, а не соглашением.
 */

export const SUPPORT_TOPICS = [
    'sync',
    'login_recovery',
    'export',
    'payment',
    'notifications',
    'other',
] as const;

export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

const TOPIC_SET: ReadonlySet<string> = new Set(SUPPORT_TOPICS);

export function isSupportTopic(value: unknown): value is SupportTopic {
    return typeof value === 'string' && TOPIC_SET.has(value);
}

/** Человеческие подписи тем. Тексты живут здесь, а не в разметке. */
export const SUPPORT_TOPIC_LABEL: Record<SupportTopic, string> = {
    sync: 'Синхронизация',
    login_recovery: 'Вход и восстановление',
    export: 'Экспорт',
    payment: 'Оплата',
    notifications: 'Уведомления',
    other: 'Прочее',
};
