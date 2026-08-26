/**
 * Экран 7 — «Качество данных». Экран, который отвечает на вопрос
 * «чему из показанного вообще можно верить».
 */

import { db } from '@/lib/db';
import { noData, ok, type PanelBlock } from '../types';
import { severityFor } from '../thresholds';
import { readEventRegistry, registryPairs } from './registry';
import { latestPulse, parseRowCounts } from './infra';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface KnownRejectionIssue {
    reason: string;
    count: number;
    /** Что случилось и что с этим делать — а не только что случилось. */
    summary: string;
}

export interface RejectedEvents {
    accepted: number;
    rejected: number;
    ratePercent: number;
    reasons: { reason: string; count: number }[];
    windowDays: number;
    /**
     * Причины отказа, у которых известны И источник, И лекарство — не
     * общий словарь на любую причину: домысливать лекарство там, где мы
     * его не знаем, — то же выдумывание данных, которое здесь запрещено
     * (ТЗ §5). Рендерится наверху экрана строкой действия, а не прячется
     * в таблицу (решение учредителя от 26.08): это самое полезное, что
     * может сказать экран, если применимо.
     */
    knownIssues: KnownRejectionIssue[];
}

/**
 * Секрет не из своего слота — единственная сегодня причина отказа, у
 * которой известны и источник, и лекарство. Изолированный секрет есть
 * только у МОМЕНТОВ (`ANALYTICS_INGEST_SECRET_MOMENTS`,
 * src/lib/analytics/secrets.ts) — ПРАКТИКА и ЗАПИСКИ делят один секрет
 * между собой, и для них эта причина означала бы нечто иное (не «секрет
 * ещё не завели», а «кто-то шлёт не тем ключом»), поэтому лекарство
 * называем только для МОМЕНТОВ, а не для любого продукта в этой причине.
 */
function knownRejectionIssues(reasons: { reason: string; count: number }[]): KnownRejectionIssue[] {
    const issues: KnownRejectionIssue[] = [];
    for (const r of reasons) {
        const match = /^secret not allowed for product (\w+)$/.exec(r.reason);
        if (match?.[1] === 'moments') {
            issues.push({
                reason: r.reason,
                count: r.count,
                summary:
                    'МОМЕНТЫ шлют события, но не своим секретом — принят общий секрет ПРАКТИКИ/ЗАПИСОК. ' +
                    'Нужно завести ANALYTICS_INGEST_SECRET_MOMENTS в CI и выпустить сборку, которая его использует — тогда отказ уйдёт сам.',
            });
        }
    }
    return issues;
}

/** `q_rejected_events` — отвергнуто при приёме, с разбивкой по причине. */
export async function qRejectedEvents(): Promise<PanelBlock<RejectedEvents>> {
    const windowDays = 28;
    const since = new Date(Date.now() - windowDays * DAY_MS);

    const [accepted, rejectedRows] = await Promise.all([
        db.analyticsEvent.count({ where: { createdAt: { gte: since } } }),
        db.analyticsEventRejected.groupBy({
            by: ['reason'],
            where: { createdAt: { gte: since } },
            _count: { _all: true },
        }),
    ]);

    const rejected = rejectedRows.reduce((acc, r) => acc + r._count._all, 0);
    const total = accepted + rejected;

    if (total === 0) {
        return noData('q_rejected_events', `за ${windowDays} дней приёмник не получил ни одного события`);
    }

    const reasons = rejectedRows
        .map((r) => ({ reason: r.reason, count: r._count._all }))
        .sort((a, b) => b.count - a.count);

    return ok('q_rejected_events', {
        accepted,
        rejected,
        ratePercent: (rejected / total) * 100,
        reasons,
        windowDays,
        knownIssues: knownRejectionIssues(reasons),
    });
}

export interface SilenceRow {
    event: string;
    product: string;
    /** Часы с последнего поступления. null — поток не начинался ни разу. */
    silentHours: number | null;
    severity: 'ok' | 'warning' | 'serious' | 'never';
}

/** Заголовки продуктов для строк тишины — по значению `product` из реестра/событий, не по ключу экрана (там `momenty`, здесь `moments`). */
export const PRODUCT_TITLES: Record<string, string> = {
    practice: 'ПРАКТИКА',
    zapiski: 'ЗАПИСКИ',
    moments: 'МОМЕНТЫ',
};

export interface EventSilenceData {
    /**
     * Потоки, которые хоть раз начинались, — живые и замолчавшие вместе.
     * Замолчавший поток здесь — авария: разметку почти наверняка сломали,
     * а не поведение изменилось.
     */
    outages: SilenceRow[];
    /**
     * Потоки, которые не начинались НИ РАЗУ, — план работ, а не авария.
     * Разделены решением учредителя от 26.08: раньше обе категории лежали
     * в одном списке, и десятки строк плана (события, которые ещё не
     * подключили) топили одну-две строки настоящей аварии (поток шёл и
     * замолчал) — просмотреть список и заметить разницу было почти
     * невозможно.
     */
    notStarted: SilenceRow[];
}

/**
 * `q_event_silence` — тишина данных.
 * Прекратившийся поток события почти всегда означает сломанную разметку,
 * а не изменившееся поведение, поэтому события из реестра проверяются все,
 * включая те, что не приходили ни разу.
 *
 * F4: группировка идёт по паре (событие, продукт), а не только по имени
 * события. `consent_updated`/`identity_linked` (E1) разрешены всем трём
 * продуктам сразу — группировка по одному имени события смешала бы их
 * потоки в одну строку, и живой поток ПРАКТИКИ маскировал бы тишину
 * ЗАПИСОК и МОМЕНТОВ под тем же именем события. `registryPairs`
 * разворачивает такие события в три отдельные строки — по одной на
 * продукт, каждая со своей собственной свежестью.
 */
export async function qEventSilence(): Promise<PanelBlock<EventSilenceData>> {
    const registry = readEventRegistry();
    if (registry.size === 0) {
        return noData(
            'q_event_silence',
            'analytics/schema/events.yaml не читается процессом — проверить, что файл есть в собранном образе (рабочая директория контейнера), и посмотреть лог "[panel] реестр событий не прочитан"',
        );
    }

    const pairs = registryPairs(registry);

    const rows = await db.analyticsEvent.groupBy({
        by: ['event', 'product'],
        _max: { ts: true },
    });

    const lastSeen = new Map<string, Date | null>();
    for (const row of rows as { event: string; product: string; _max: { ts: Date | null } }[]) {
        lastSeen.set(`${row.event} ${row.product}`, row._max.ts);
    }
    const now = Date.now();

    const result: SilenceRow[] = pairs.map(({ event, product }) => {
        const seen = lastSeen.get(`${event} ${product}`) ?? null;
        if (!seen) {
            return { event, product, silentHours: null, severity: 'never' as const };
        }
        const silentHours = (now - seen.getTime()) / (60 * 60 * 1000);
        return {
            event,
            product,
            silentHours,
            severity: severityFor('eventSilenceHours', silentHours) ?? 'ok',
        };
    });

    const outages = result.filter((r) => r.severity !== 'never');
    const outageOrder = { serious: 0, warning: 1, ok: 2 } as const;
    outages.sort(
        (a, b) =>
            outageOrder[a.severity as 'serious' | 'warning' | 'ok'] - outageOrder[b.severity as 'serious' | 'warning' | 'ok']
            || a.event.localeCompare(b.event)
            || a.product.localeCompare(b.product),
    );

    const notStarted = result.filter((r) => r.severity === 'never');
    notStarted.sort((a, b) => a.event.localeCompare(b.event) || a.product.localeCompare(b.product));

    return ok('q_event_silence', { outages, notStarted });
}

export interface SourceDiffRow {
    label: string;
    sourceA: { name: string; value: number | null };
    sourceB: { name: string; value: number | null };
    diffPercent: number | null;
    /** Причина, если сверить нечем. */
    reason: string | null;
}

/**
 * `q_source_diff` — расхождение независимых источников.
 * Сверяются только те величины, у которых действительно есть два независимых
 * счётчика. Там, где второго источника нет, строка честно помечена причиной,
 * а не выровнена сама с собой (это давало бы 0 % и ложное спокойствие).
 */
export async function qSourceDiff(): Promise<PanelBlock<SourceDiffRow[]>> {
    const since = new Date(Date.now() - 28 * DAY_MS);
    const weekAgo = new Date(Date.now() - 7 * DAY_MS);

    const [paymentsDb, sessionsDb, pulse] = await Promise.all([
        db.payment.count({ where: { status: 'paid', createdAt: { gte: since } } }),
        db.diarySession.count({ where: { status: 'completed', date: { gte: weekAgo } } }),
        latestPulse(),
    ]);

    const counts = pulse ? parseRowCounts(pulse.row.dbRowCounts) : null;

    const rows: SourceDiffRow[] = [
        {
            label: 'Сессии за неделю',
            sourceA: { name: 'запрос панели', value: sessionsDb },
            sourceB: { name: 'счётчик коллектора', value: counts?.DiarySession ?? null },
            // Коллектор считает все строки таблицы, панель — завершённые за
            // неделю: сравнивать их напрямую нельзя, поэтому расхождение
            // считается только когда обе величины про одно и то же.
            diffPercent: null,
            reason: counts?.DiarySession === undefined
                ? 'коллектор не присылал счётчиков строк'
                : 'коллектор считает всю таблицу, панель — завершённые за неделю: величины разного охвата',
        },
        {
            label: 'Платежи за 28 дней',
            sourceA: { name: 'база', value: paymentsDb },
            sourceB: { name: 'выписка банка', value: null },
            diffPercent: null,
            reason: 'выписка эквайринга в базу не импортируется — сверять не с чем',
        },
        {
            label: 'Установки МОМЕНТОВ',
            sourceA: { name: 'магазин', value: null },
            sourceB: { name: 'события приложения', value: null },
            diffPercent: null,
            reason: 'у МОМЕНТОВ нет сервера, а магазин не опрашивается — ни одного источника',
        },
    ];

    return ok('q_source_diff', rows);
}

export interface FreshnessRow {
    screen: string;
    title: string;
    generatedAt: string | null;
    severity: 'ok' | 'warning' | 'serious' | 'unknown';
}

/** `q_screen_freshness` — когда какой экран считался в последний раз. */
export async function qScreenFreshness(freshness: { screen: string; title: string; generatedAt: string | null }[]): Promise<PanelBlock<FreshnessRow[]>> {
    const now = Date.now();
    return ok(
        'q_screen_freshness',
        freshness.map((row) => {
            if (!row.generatedAt) return { ...row, severity: 'unknown' as const };
            const hours = (now - new Date(row.generatedAt).getTime()) / (60 * 60 * 1000);
            return { ...row, severity: severityFor('screenFreshnessHours', hours) ?? 'ok' };
        }),
    );
}
