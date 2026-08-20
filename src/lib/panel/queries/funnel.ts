/**
 * Экран 4 — «Путь и активация».
 *
 * Воронка ПРАКТИКИ считается по бизнес-таблицам и от событий не зависит —
 * поэтому она работает даже при выключённом приёмнике. Воронка записи и
 * источники привлечения зависят от событий, которых в реестре нет.
 */

import { db } from '@/lib/db';
import { noData, ok, type PanelBlock } from '../types';
import { readEventRegistry } from './registry';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface FunnelStep {
    key: string;
    label: string;
    value: number;
    /** Доля от предыдущей ступени, %. У первой ступени 100. */
    ofPrevious: number;
    /** Самый большой отвал — подсвечивается как «главный отвал». */
    biggestDrop: boolean;
}

export interface FunnelData {
    steps: FunnelStep[];
    windowDays: number;
}

/**
 * `q_funnel_practice` — от регистрации до оплаты за 28 дней.
 * Каждая ступень — подмножество предыдущей, поэтому считаем по одному
 * набору идентификаторов, а не пятью независимыми count'ами: иначе доли
 * могут перевалить за 100 %.
 */
export async function qFunnelPractice(): Promise<PanelBlock<FunnelData>> {
    const windowDays = 28;
    const since = new Date(Date.now() - windowDays * DAY_MS);

    const users = await db.user.findMany({
        where: { createdAt: { gte: since } },
        select: { id: true },
    });
    const ids = users.map((u) => u.id);

    if (ids.length === 0) {
        return noData('q_funnel_practice', `за ${windowDays} дней не зарегистрировался ни один специалист`);
    }

    const [withProfile, withSession, withCompleted, withPayment] = await Promise.all([
        db.psychologistSettings.findMany({ where: { psychologistId: { in: ids } }, select: { psychologistId: true } }),
        db.diarySession.findMany({ where: { psychologistId: { in: ids } }, select: { psychologistId: true }, distinct: ['psychologistId'] }),
        db.diarySession.findMany({
            where: { psychologistId: { in: ids }, status: 'completed' },
            select: { psychologistId: true },
            distinct: ['psychologistId'],
        }),
        db.payment.findMany({ where: { userId: { in: ids }, status: 'paid' }, select: { userId: true }, distinct: ['userId'] }),
    ]);

    const profileSet = new Set(withProfile.map((r) => r.psychologistId));
    const sessionSet = new Set(withSession.map((r) => r.psychologistId).filter((id) => profileSet.has(id)));
    const completedSet = new Set(withCompleted.map((r) => r.psychologistId).filter((id) => sessionSet.has(id)));
    const paidSet = new Set(withPayment.map((r) => r.userId).filter((id) => completedSet.has(id)));

    const raw = [
        { key: 'registered', label: 'Регистрация', value: ids.length },
        { key: 'profile', label: 'Заполнил профиль', value: profileSet.size },
        { key: 'first_booking', label: 'Создал первую запись', value: sessionSet.size },
        { key: 'session_done', label: 'Провёл сессию', value: completedSet.size },
        { key: 'paid', label: 'Оплатил', value: paidSet.size },
    ];

    return ok('q_funnel_practice', { steps: withDrops(raw), windowDays });
}

function withDrops(raw: { key: string; label: string; value: number }[]): FunnelStep[] {
    const steps = raw.map((step, i) => ({
        ...step,
        ofPrevious: i === 0 ? 100 : raw[i - 1].value > 0 ? (step.value / raw[i - 1].value) * 100 : 0,
        biggestDrop: false,
    }));
    let worstIndex = -1;
    let worstShare = 101;
    steps.forEach((s, i) => {
        if (i > 0 && s.ofPrevious < worstShare) {
            worstShare = s.ofPrevious;
            worstIndex = i;
        }
    });
    if (worstIndex >= 0) steps[worstIndex].biggestDrop = true;
    return steps;
}

/** Пять ступеней воронки записи, которых ждёт панель. */
export const BOOKING_FUNNEL_EVENTS = [
    { event: 'booking_link_opened', label: 'Открыл ссылку' },
    { event: 'booking_time_selected', label: 'Выбрал время' },
    { event: 'booking_form_started', label: 'Заполнил данные' },
    { event: 'booking_consent_shown', label: 'Подтвердил согласие' },
    { event: 'booking_completed', label: 'Записался' },
] as const;

/**
 * `q_funnel_booking` — ядро продукта. Считается по `AnalyticsEvent`, но
 * только если события воронки записи вообще есть в реестре: иначе приёмник
 * их отвергает и в таблицу они не попадают в принципе.
 */
export async function qFunnelBooking(): Promise<PanelBlock<FunnelData>> {
    const registry = readEventRegistry();
    const missing = BOOKING_FUNNEL_EVENTS.filter((s) => !registry.has(s.event)).map((s) => s.event);

    if (missing.length === BOOKING_FUNNEL_EVENTS.length) {
        return noData('q_funnel_booking', 'события воронки записи не поступают: их нет в реестре analytics/schema/events.yaml');
    }
    if (missing.length > 0) {
        return noData('q_funnel_booking', `в реестре событий не хватает ступеней: ${missing.join(', ')}`);
    }

    const windowDays = 28;
    const since = new Date(Date.now() - windowDays * DAY_MS);

    const rows = await db.analyticsEvent.groupBy({
        by: ['event'],
        where: { event: { in: BOOKING_FUNNEL_EVENTS.map((s) => s.event) }, ts: { gte: since } },
        _count: { _all: true },
    });

    const total = rows.reduce((acc, r) => acc + r._count._all, 0);
    if (total === 0) {
        return noData('q_funnel_booking', `события воронки записи не поступали за ${windowDays} дней`);
    }

    const raw = BOOKING_FUNNEL_EVENTS.map((step) => ({
        key: step.event,
        label: step.label,
        value: rows.find((r) => r.event === step.event)?._count._all ?? 0,
    }));

    return ok('q_funnel_booking', { steps: withDrops(raw), windowDays });
}

/**
 * `q_sources` — источники привлечения.
 *
 * Разметка источника есть только в `VisitorAnalytics` (utm по отпечатку
 * устройства) и ни в одном событии реестра. Связать отпечаток с аккаунтом
 * нечем, поэтому «регистраций / активаций / оплат по источнику» получить
 * неоткуда — а выдать utm-визиты за регистрации значило бы соврать.
 */
export async function qSources(): Promise<PanelBlock<never>> {
    return noData(
        'q_sources',
        'метка источника не связана с аккаунтом: utm лежит в VisitorAnalytics по отпечатку устройства, в реестре событий метки источника нет',
    );
}
