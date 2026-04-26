/**
 * Smart Notes — block definitions and templates
 *
 * Each block is a structured section with guided fields.
 * Fields marked `advanced: true` are hidden under "дополнительно".
 * Max 1-3 primary fields visible by default.
 */

export type SmartBlockField = {
    key: string;
    label: string;
    placeholder: string;
    type: 'text' | 'textarea' | 'select' | 'rating';
    options?: string[];
    required?: boolean;
    advanced?: boolean; // hidden under "дополнительно"
};

export type SmartBlockDefinition = {
    id: string;
    label: string;
    emoji: string; // kept for backward compat, use icon component instead
    iconId: string; // key into NOTE_BLOCK_ICONS
    description: string;
    fields: SmartBlockField[];
    category: 'basic' | 'context' | 'process' | 'safety' | 'org';
    priority: 1 | 2; // 1 = always visible, 2 = via "+ Добавить блок"
};

export type SmartBlock = {
    id: string;
    definitionId: string;
    values: Record<string, string>;
    createdAt: string;
};

export type NoteVisibility = 'private' | 'shared';

// ============================================================
// Block Definitions
// ============================================================

export const SMART_BLOCK_DEFINITIONS: SmartBlockDefinition[] = [
    {
        id: 'request',
        label: 'Запрос',
        emoji: '🎯',
        iconId: 'request',
        description: 'Как клиент формулирует запрос',
        category: 'basic',
        priority: 1,
        fields: [
            { key: 'formulation', label: 'Формулировка запроса', placeholder: 'Как клиент формулирует свой запрос...', type: 'textarea', required: true },
            { key: 'desired_result', label: 'Желаемый результат', placeholder: 'Что хочет получить в итоге...', type: 'textarea' },
            { key: 'success_criteria', label: 'Критерии «что станет лучше»', placeholder: 'По каким признакам поймёт, что стало лучше...', type: 'textarea', advanced: true },
            { key: 'changes', label: 'Как менялась формулировка', placeholder: 'Динамика формулировки запроса...', type: 'textarea', advanced: true },
        ],
    },
    {
        id: 'observation',
        label: 'Наблюдение',
        emoji: '👁',
        iconId: 'observation',
        description: 'Что заметил в ходе сессии',
        category: 'basic',
        priority: 1,
        fields: [
            { key: 'emotional_state', label: 'Эмоциональный фон', placeholder: 'Настроение, аффект...', type: 'textarea', required: true },
            { key: 'body', label: 'Телесные проявления', placeholder: 'Поза, жесты, напряжение...', type: 'textarea' },
            { key: 'contact', label: 'Особенности контакта', placeholder: 'Открытость, избегание, зрительный контакт...', type: 'textarea' },
            { key: 'speech', label: 'Темп речи', placeholder: 'Быстрый, замедленный, прерывистый...', type: 'text', advanced: true },
            { key: 'patterns', label: 'Повторяющиеся паттерны', placeholder: 'Что повторяется из сессии в сессию...', type: 'textarea', advanced: true },
            { key: 'incongruence', label: 'Несоответствия', placeholder: 'Слова vs невербалика...', type: 'textarea', advanced: true },
        ],
    },
    {
        id: 'intervention',
        label: 'Интервенция',
        emoji: '🛠',
        iconId: 'intervention',
        description: 'Что использовали в работе',
        category: 'basic',
        priority: 1,
        fields: [
            { key: 'technique', label: 'Техника / ход', placeholder: 'Какая техника или подход использован...', type: 'textarea', required: true },
            { key: 'reaction', label: 'Реакция клиента', placeholder: 'Как отреагировал клиент...', type: 'textarea' },
            { key: 'purpose', label: 'Цель', placeholder: 'Зачем это было сделано...', type: 'textarea', advanced: true },
            { key: 'effectiveness', label: 'Субъективная эффективность', placeholder: 'Насколько сработало...', type: 'text', advanced: true },
        ],
    },
    {
        id: 'dynamics',
        label: 'Динамика',
        emoji: '📈',
        iconId: 'dynamics',
        description: 'Изменения с прошлой сессии',
        category: 'basic',
        priority: 1,
        fields: [
            { key: 'changes', label: 'Что улучшилось', placeholder: 'Позитивные сдвиги...', type: 'textarea', required: true },
            { key: 'regressed', label: 'Что осталось сложным', placeholder: 'Если есть ухудшение или стагнация...', type: 'textarea' },
            { key: 'factors', label: 'Что появилось нового', placeholder: 'Новые темы, инсайты...', type: 'textarea' },
            { key: 'progress', label: 'Оценка прогресса', placeholder: 'Краткая оценка...', type: 'text', advanced: true },
        ],
    },
    {
        id: 'homework',
        label: 'Домашнее задание',
        emoji: '📝',
        iconId: 'homework',
        description: 'Задание между сессиями',
        category: 'basic',
        priority: 1,
        fields: [
            { key: 'task', label: 'Формулировка задания', placeholder: 'Что именно нужно сделать...', type: 'textarea', required: true },
            { key: 'purpose', label: 'Зачем', placeholder: 'Какую цель преследует задание...', type: 'textarea' },
            { key: 'format', label: 'Формат выполнения', placeholder: 'Как именно выполнять...', type: 'text', advanced: true },
            { key: 'deadline', label: 'Срок', placeholder: 'До когда...', type: 'text', advanced: true },
            { key: 'obstacles', label: 'Возможные препятствия', placeholder: 'Что может помешать...', type: 'textarea', advanced: true },
        ],
    },
    {
        id: 'next_step',
        label: 'Следующий шаг',
        emoji: '➡️',
        iconId: 'next_step',
        description: 'План на следующую встречу',
        category: 'basic',
        priority: 1,
        fields: [
            { key: 'focus', label: 'Договорённость', placeholder: 'На чём сосредоточиться...', type: 'textarea', required: true },
            { key: 'check', label: 'Домашнее задание', placeholder: 'Что нужно узнать / уточнить...', type: 'textarea' },
            { key: 'send_to_client', label: 'На что обратить внимание', placeholder: 'Материалы, ссылки...', type: 'textarea', advanced: true },
            { key: 'needs_questionnaire', label: 'Нужен ли опросник до встречи?', placeholder: '', type: 'select', options: ['Нет', 'Да'], advanced: true },
        ],
    },
    // ── Priority 2 blocks (via "+ Добавить блок") ──
    {
        id: 'resources',
        label: 'Ресурсы',
        emoji: '💪',
        iconId: 'resources',
        description: 'Опоры и ресурсы клиента',
        category: 'basic',
        priority: 2,
        fields: [
            { key: 'internal', label: 'Что помогает', placeholder: 'Качества, навыки, люди, активности...', type: 'textarea' },
            { key: 'coping', label: 'Рабочие способы саморегуляции', placeholder: 'Что реально помогает...', type: 'textarea' },
            { key: 'people', label: 'Поддерживающие люди', placeholder: 'С кем может поговорить...', type: 'textarea', advanced: true },
            { key: 'rituals', label: 'Безопасные ритуалы', placeholder: 'Рутины, которые стабилизируют...', type: 'textarea', advanced: true },
        ],
    },
    {
        id: 'anamnesis',
        label: 'Анамнез',
        emoji: '📋',
        iconId: 'anamnesis',
        description: 'Семейный контекст и история',
        category: 'context',
        priority: 2,
        fields: [
            { key: 'family', label: 'Семейный контекст', placeholder: 'Состав семьи, значимые отношения...', type: 'textarea' },
            { key: 'significant_events', label: 'Значимые события', placeholder: 'Ключевые жизненные события...', type: 'textarea' },
            { key: 'prev_therapy', label: 'Предыдущий опыт терапии', placeholder: 'Был ли опыт, у кого, как давно...', type: 'textarea', advanced: true },
            { key: 'medical', label: 'Медицинский контекст', placeholder: 'Заболевания, лекарства...', type: 'textarea', advanced: true },
            { key: 'open_questions', label: 'Открытые вопросы', placeholder: 'Что ещё нужно прояснить...', type: 'textarea', advanced: true },
        ],
    },
    {
        id: 'quote',
        label: 'Цитата',
        emoji: '💬',
        iconId: 'quote',
        description: 'Дословная цитата клиента',
        category: 'context',
        priority: 2,
        fields: [
            { key: 'text', label: 'Цитата', placeholder: '«...»', type: 'textarea', required: true },
            { key: 'context', label: 'Контекст', placeholder: 'В какой момент это было сказано...', type: 'textarea' },
        ],
    },
    {
        id: 'hypothesis',
        label: 'Гипотеза',
        emoji: '💡',
        iconId: 'hypothesis',
        description: 'Рабочая гипотеза терапевта',
        category: 'process',
        priority: 2,
        fields: [
            { key: 'text', label: 'Гипотеза', placeholder: 'Предположение о динамике / паттернах...', type: 'textarea', required: true },
            { key: 'evidence', label: 'На чём основана', placeholder: 'Наблюдения, факты...', type: 'textarea' },
        ],
    },
];

// ============================================================
// Session Templates
// ============================================================

export type SessionTemplate = {
    id: string;
    label: string;
    description: string;
    blockIds: string[];
};

export const SESSION_TEMPLATES: SessionTemplate[] = [
    {
        id: 'first_session',
        label: 'Первая встреча',
        description: 'Знакомство, запрос, анамнез, ресурсы',
        blockIds: ['request', 'anamnesis', 'observation', 'resources', 'next_step'],
    },
    {
        id: 'regular_session',
        label: 'Регулярная сессия',
        description: 'Динамика, наблюдение, интервенция, ДЗ',
        blockIds: ['dynamics', 'observation', 'intervention', 'homework', 'next_step'],
    },
    {
        id: 'crisis_session',
        label: 'Кризисная сессия',
        description: 'Наблюдение, ресурсы, следующий шаг',
        blockIds: ['observation', 'resources', 'next_step'],
    },
];

// ============================================================
// Helpers
// ============================================================

export function getDefinitionById(id: string): SmartBlockDefinition | undefined {
    return SMART_BLOCK_DEFINITIONS.find(d => d.id === id);
}

export function createBlockInstance(definitionId: string): SmartBlock {
    return {
        id: `${definitionId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        definitionId,
        values: {},
        createdAt: new Date().toISOString(),
    };
}

export function getCoreBlockIds(): string[] {
    return SMART_BLOCK_DEFINITIONS.filter(d => d.priority === 1).map(d => d.id);
}

export function getSecondaryBlockIds(): string[] {
    return SMART_BLOCK_DEFINITIONS.filter(d => d.priority === 2).map(d => d.id);
}
