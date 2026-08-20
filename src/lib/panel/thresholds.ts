/**
 * Пороги панели (ТЗ §7). Ни одного магического числа в компонентах.
 *
 * Все восемь порогов подтверждены владельцем 20.08.2026. Значение считается
 * временным, пока рядом нет отметки `// подтверждено владельцем DD.MM`.
 */

export interface Threshold {
    /** Порог «внимание». */
    warning: number;
    /** Порог «серьёзно». */
    serious: number;
    /** 'below' — плохо, когда значение ниже порога; 'above' — когда выше. */
    direction: 'below' | 'above';
    /** Подпись порога под счётчиком. */
    unit: string;
}

export const THRESHOLDS = {
    /** Успешность списаний, %. */
    // подтверждено владельцем 20.08
    paymentSuccess: { warning: 92, serious: 85, direction: 'below', unit: '%' },
    /** Свободно на диске, %. */
    // подтверждено владельцем 20.08
    diskFree: { warning: 20, serious: 10, direction: 'below', unit: '%' },
    /** Возраст последней резервной копии, часы. */
    // подтверждено владельцем 20.08
    backupAgeHours: { warning: 26, serious: 48, direction: 'above', unit: 'ч' },
    /** Остаток минут сборок GitHub Actions. */
    // подтверждено владельцем 20.08
    buildMinutes: { warning: 400, serious: 150, direction: 'below', unit: 'мин' },
    /** Тишина события, часы. */
    // подтверждено владельцем 20.08
    eventSilenceHours: { warning: 24, serious: 72, direction: 'above', unit: 'ч' },
    /** Расхождение независимых источников, %. */
    // подтверждено владельцем 20.08
    sourceDiff: { warning: 2, serious: 10, direction: 'above', unit: '%' },
    /**
     * Напоминания вовремя, %. Цель ровно 100 % — зафиксировано ТЗ §7,
     * поэтому «внимание» начинается при любом значении ниже 100.
     */
    // подтверждено владельцем 20.08
    remindersOnTime: { warning: 100, serious: 95, direction: 'below', unit: '%' },
    /** Ошибки вебхуков мессенджеров, %. */
    // подтверждено владельцем 20.08
    webhookErrorRate: { warning: 1, serious: 5, direction: 'above', unit: '%' },
    /** Отвергнуто при приёме событий, %. */
    // подтверждено владельцем 20.08
    rejectedEvents: { warning: 2, serious: 5, direction: 'above', unit: '%' },
    /** Дней до истечения сертификата. */
    // подтверждено владельцем 20.08
    certDaysLeft: { warning: 21, serious: 7, direction: 'below', unit: 'дн' },
    /** Свежесть экрана, часы с последнего расчёта. */
    // подтверждено владельцем 20.08
    screenFreshnessHours: { warning: 12, serious: 36, direction: 'above', unit: 'ч' },
    /**
     * Возраст ручного ввода стоимости инфраструктуры, дни.
     * Регламент владельца: обновлять раз в две недели.
     */
    // подтверждено владельцем 20.08
    infraCostAgeDays: { warning: 14, serious: 28, direction: 'above', unit: 'дн' },
} satisfies Record<string, Threshold>;

export type ThresholdKey = keyof typeof THRESHOLDS;

/**
 * Расхождение миграций: любое расхождение — «серьёзно».
 * Зафиксировано ТЗ §7, порога «внимание» у него нет вовсе.
 */
// подтверждено владельцем 20.08
export const MIGRATION_DRIFT_IS_ALWAYS_SERIOUS = true;

/**
 * Пороги, которые владелец ещё не подтвердил. Панель их применяет, но
 * помечает подписью «порог не подтверждён» — врать про согласованность хуже,
 * чем показать временное значение.
 *
 * Сейчас список пуст: все пороги подтверждены владельцем 20.08.2026.
 * Механизм оставлен — новый порог заводится сюда, пока его не согласовали.
 */
export const UNCONFIRMED_THRESHOLDS: ReadonlySet<ThresholdKey> = new Set([]);

export type Severity = 'ok' | 'warning' | 'serious';

/** Кладёт измеренное значение на шкалу порога. */
export function severityFor(key: ThresholdKey, value: number | null | undefined): Severity | null {
    if (value === null || value === undefined || Number.isNaN(value)) return null;
    const t = THRESHOLDS[key];
    if (t.direction === 'below') {
        if (value < t.serious) return 'serious';
        if (value < t.warning) return 'warning';
        return 'ok';
    }
    if (value > t.serious) return 'serious';
    if (value > t.warning) return 'warning';
    return 'ok';
}

/** Худшее из нескольких состояний — для точки экрана в боковом меню. */
export function worstSeverity(values: (Severity | null)[]): Severity | null {
    if (values.includes('serious')) return 'serious';
    if (values.includes('warning')) return 'warning';
    return values.some((v) => v === 'ok') ? 'ok' : null;
}
