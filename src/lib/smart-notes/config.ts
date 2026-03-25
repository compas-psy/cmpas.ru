/**
 * Smart Notes — block definitions and templates
 * 
 * Each tag is not just a label — it's an "action" that inserts
 * a structured block with guided fields into the session note.
 */

export type SmartBlockField = {
    key: string;
    label: string;
    placeholder: string;
    type: 'text' | 'textarea' | 'select' | 'rating';
    options?: string[]; // for select type
    required?: boolean;
};

export type SmartBlockDefinition = {
    id: string;
    label: string;
    emoji: string;
    color: string; // tailwind color class
    description: string;
    fields: SmartBlockField[];
    category: 'basic' | 'context' | 'process' | 'safety' | 'org';
};

export type SmartBlock = {
    id: string; // unique instance id
    definitionId: string;
    values: Record<string, string>;
    createdAt: string;
};

export type NoteVisibility = 'private' | 'shared';

// ============================================================
// 8 Core Quick Tags (always visible as chips)
// ============================================================

export const SMART_BLOCK_DEFINITIONS: SmartBlockDefinition[] = [
    {
        id: 'request',
        label: 'Запрос',
        emoji: '🎯',
        color: 'bg-blue-500/10 text-blue-700 border-blue-200',
        description: 'Как клиент формулирует запрос',
        category: 'basic',
        fields: [
            { key: 'formulation', label: 'Формулировка запроса', placeholder: 'Как клиент формулирует свой запрос...', type: 'textarea', required: true },
            { key: 'desired_result', label: 'Желаемый результат', placeholder: 'Что хочет получить в итоге...', type: 'textarea' },
            { key: 'success_criteria', label: 'Критерии «что станет лучше»', placeholder: 'По каким признакам поймёт, что стало лучше...', type: 'textarea' },
            { key: 'changes', label: 'Как менялась формулировка', placeholder: 'Динамика формулировки запроса...', type: 'textarea' },
        ],
    },
    {
        id: 'anamnesis',
        label: 'Анамнез',
        emoji: '📋',
        color: 'bg-purple-500/10 text-purple-700 border-purple-200',
        description: 'Семейный контекст и история',
        category: 'basic',
        fields: [
            { key: 'family', label: 'Семейный контекст', placeholder: 'Состав семьи, значимые отношения...', type: 'textarea' },
            { key: 'significant_events', label: 'Значимые события', placeholder: 'Ключевые жизненные события...', type: 'textarea' },
            { key: 'prev_therapy', label: 'Предыдущий опыт терапии', placeholder: 'Был ли опыт, у кого, как давно...', type: 'textarea' },
            { key: 'medical', label: 'Медицинский контекст', placeholder: 'Заболевания, лекарства...', type: 'textarea' },
            { key: 'trauma', label: 'Потери / травматический опыт', placeholder: 'Если клиент готов поделиться...', type: 'textarea' },
            { key: 'open_questions', label: 'Открытые вопросы', placeholder: 'Что ещё нужно прояснить...', type: 'textarea' },
        ],
    },
    {
        id: 'observation',
        label: 'Наблюдение',
        emoji: '👁',
        color: 'bg-amber-500/10 text-amber-700 border-amber-200',
        description: 'Что заметил в ходе сессии',
        category: 'basic',
        fields: [
            { key: 'emotional_state', label: 'Эмоциональный фон', placeholder: 'Настроение, аффект...', type: 'textarea', required: true },
            { key: 'speech', label: 'Темп речи', placeholder: 'Быстрый, замедленный, прерывистый...', type: 'text' },
            { key: 'body', label: 'Телесные проявления', placeholder: 'Поза, жесты, напряжение...', type: 'textarea' },
            { key: 'contact', label: 'Особенности контакта', placeholder: 'Открытость, избегание, зрительный контакт...', type: 'textarea' },
            { key: 'patterns', label: 'Повторяющиеся паттерны', placeholder: 'Что повторяется из сессии в сессию...', type: 'textarea' },
            { key: 'incongruence', label: 'Несоответствия', placeholder: 'Слова vs невербалика...', type: 'textarea' },
        ],
    },
    {
        id: 'intervention',
        label: 'Интервенция',
        emoji: '🛠',
        color: 'bg-teal-500/10 text-teal-700 border-teal-200',
        description: 'Что использовали в работе',
        category: 'basic',
        fields: [
            { key: 'technique', label: 'Техника / ход', placeholder: 'Какая техника или подход использован...', type: 'textarea', required: true },
            { key: 'purpose', label: 'Цель', placeholder: 'Зачем это было сделано...', type: 'textarea' },
            { key: 'reaction', label: 'Реакция клиента', placeholder: 'Как отреагировал клиент...', type: 'textarea' },
            { key: 'effectiveness', label: 'Субъективная эффективность', placeholder: 'Насколько сработало...', type: 'text' },
        ],
    },
    {
        id: 'resources',
        label: 'Ресурсы',
        emoji: '💪',
        color: 'bg-green-500/10 text-green-700 border-green-200',
        description: 'Опоры и ресурсы клиента',
        category: 'basic',
        fields: [
            { key: 'internal', label: 'Внутренние опоры', placeholder: 'Качества, навыки, сильные стороны...', type: 'textarea' },
            { key: 'external', label: 'Внешние опоры', placeholder: 'Люди, места, активности...', type: 'textarea' },
            { key: 'people', label: 'Поддерживающие люди', placeholder: 'С кем может поговорить, кто рядом...', type: 'textarea' },
            { key: 'coping', label: 'Рабочие способы саморегуляции', placeholder: 'Что реально помогает...', type: 'textarea' },
            { key: 'rituals', label: 'Безопасные ритуалы / привычки', placeholder: 'Рутины, которые стабилизируют...', type: 'textarea' },
        ],
    },
    {
        id: 'dynamics',
        label: 'Динамика',
        emoji: '📈',
        color: 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
        description: 'Изменения с прошлой сессии',
        category: 'basic',
        fields: [
            { key: 'changes', label: 'Что изменилось', placeholder: 'С прошлой сессии...', type: 'textarea', required: true },
            { key: 'improved', label: 'Что улучшилось', placeholder: 'Позитивные сдвиги...', type: 'textarea' },
            { key: 'regressed', label: 'Что откатилось', placeholder: 'Если есть ухудшение...', type: 'textarea' },
            { key: 'factors', label: 'Что повлияло', placeholder: 'Причины изменений...', type: 'textarea' },
            { key: 'progress', label: 'Оценка прогресса', placeholder: 'Краткая оценка...', type: 'text' },
        ],
    },
    {
        id: 'homework',
        label: 'Домашнее задание',
        emoji: '📝',
        color: 'bg-orange-500/10 text-orange-700 border-orange-200',
        description: 'Задание между сессиями',
        category: 'basic',
        fields: [
            { key: 'task', label: 'Формулировка задания', placeholder: 'Что именно нужно сделать...', type: 'textarea', required: true },
            { key: 'purpose', label: 'Зачем', placeholder: 'Какую цель преследует задание...', type: 'textarea' },
            { key: 'format', label: 'Формат выполнения', placeholder: 'Как именно выполнять...', type: 'text' },
            { key: 'deadline', label: 'Срок', placeholder: 'До когда...', type: 'text' },
            { key: 'obstacles', label: 'Возможные препятствия', placeholder: 'Что может помешать...', type: 'textarea' },
        ],
    },
    {
        id: 'next_step',
        label: 'Следующий шаг',
        emoji: '➡️',
        color: 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
        description: 'План на следующую встречу',
        category: 'basic',
        fields: [
            { key: 'focus', label: 'Фокус следующей сессии', placeholder: 'На чём сосредоточиться...', type: 'textarea', required: true },
            { key: 'check', label: 'Что проверить', placeholder: 'Что нужно узнать / уточнить...', type: 'textarea' },
            { key: 'send_to_client', label: 'Что прислать клиенту', placeholder: 'Материалы, ссылки...', type: 'textarea' },
            { key: 'needs_questionnaire', label: 'Нужен ли опросник до встречи?', placeholder: '', type: 'select', options: ['Нет', 'Да'] },
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
    blockIds: string[]; // Which blocks to pre-insert
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
    return SMART_BLOCK_DEFINITIONS.filter(d => d.category === 'basic').map(d => d.id);
}
