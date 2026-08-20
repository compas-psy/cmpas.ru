/**
 * Экран 3 — «Продукты».
 *
 * ПРАКТИКА считается целиком по бизнес-таблицам. У ЗАПИСОК свой сервер и
 * своя база, у МОМЕНТОВ сервера нет вовсе — их блоки реализованы в `no_data`
 * с настоящей причиной, а не заполнены правдоподобными числами (ТЗ §5, §11).
 */

import { db } from '@/lib/db';
import { noData, ok, type PanelBlock } from '../types';
import { deltaAbs, deltaPoints, deltaPercent, type Delta } from '../format';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PracticeNsm {
    /** Сессий на активного специалиста в неделю. */
    value: number;
    previous: number;
    delta: Delta;
    sessions: number;
    activeSpecialists: number;
}

export async function qPracticeNsm(): Promise<PanelBlock<PracticeNsm>> {
    const now = Date.now();
    const measure = async (fromDays: number, toDays: number) => {
        const rows = await db.diarySession.findMany({
            where: {
                status: 'completed',
                date: { gte: new Date(now - fromDays * DAY_MS), lt: new Date(now - toDays * DAY_MS) },
            },
            select: { psychologistId: true },
        });
        const specialists = new Set(rows.map((r) => r.psychologistId));
        return { sessions: rows.length, specialists: specialists.size };
    };

    const [current, previous] = await Promise.all([measure(7, 0), measure(14, 7)]);

    if (current.specialists === 0) {
        return noData('q_practice_nsm', 'за неделю ни один специалист не провёл сессию — делить не на кого');
    }

    const value = current.sessions / current.specialists;
    const prev = previous.specialists > 0 ? previous.sessions / previous.specialists : 0;

    return ok('q_practice_nsm', {
        value,
        previous: prev,
        delta: deltaPercent(value, prev, true),
        sessions: current.sessions,
        activeSpecialists: current.specialists,
    });
}

export interface PracticeActive {
    wau: number;
    mau: number;
    /** Липкость WAU/MAU. */
    stickiness: number;
    delta: Delta;
}

export async function qPracticeActive(): Promise<PanelBlock<PracticeActive>> {
    const now = Date.now();
    const activeIn = async (days: number) => {
        const rows = await db.diarySession.findMany({
            where: { date: { gte: new Date(now - days * DAY_MS) } },
            select: { psychologistId: true },
            distinct: ['psychologistId'],
        });
        return rows.length;
    };

    const [wau, mau, wauPrev] = await Promise.all([
        activeIn(7),
        activeIn(30),
        db.diarySession
            .findMany({
                where: { date: { gte: new Date(now - 14 * DAY_MS), lt: new Date(now - 7 * DAY_MS) } },
                select: { psychologistId: true },
                distinct: ['psychologistId'],
            })
            .then((r) => r.length),
    ]);

    if (mau === 0) {
        return noData('q_practice_active', 'за 30 дней ни один специалист не завёл сессию');
    }

    return ok('q_practice_active', {
        wau,
        mau,
        stickiness: (wau / mau) * 100,
        delta: deltaAbs(wau, wauPrev, true),
    });
}

export interface PracticeActivation {
    rate: number;
    previous: number;
    delta: Delta;
    activated: number;
    cohort: number;
}

/**
 * `q_practice_activation` — доля новых специалистов, заведших первую сессию
 * за 7 дней после регистрации. Когорта берётся с запасом в 7 дней, чтобы
 * у всех в ней срок уже истёк.
 */
export async function qPracticeActivation(): Promise<PanelBlock<PracticeActivation>> {
    const now = Date.now();
    const measure = async (fromDays: number, toDays: number) => {
        const users = await db.user.findMany({
            where: { createdAt: { gte: new Date(now - fromDays * DAY_MS), lt: new Date(now - toDays * DAY_MS) } },
            select: { id: true, createdAt: true },
        });
        if (users.length === 0) return { cohort: 0, activated: 0 };

        const sessions = await db.diarySession.findMany({
            where: { psychologistId: { in: users.map((u) => u.id) } },
            select: { psychologistId: true, createdAt: true },
        });

        const firstByUser = new Map<string, Date>();
        for (const s of sessions) {
            const seen = firstByUser.get(s.psychologistId);
            if (!seen || s.createdAt < seen) firstByUser.set(s.psychologistId, s.createdAt);
        }

        const activated = users.filter((u) => {
            const first = firstByUser.get(u.id);
            return first !== undefined && first.getTime() - u.createdAt.getTime() <= 7 * DAY_MS;
        }).length;

        return { cohort: users.length, activated };
    };

    const [current, previous] = await Promise.all([measure(37, 7), measure(67, 37)]);

    if (current.cohort === 0) {
        return noData('q_practice_activation', 'за прошлый месяц не зарегистрировался ни один специалист');
    }

    const rate = (current.activated / current.cohort) * 100;
    const prev = previous.cohort > 0 ? (previous.activated / previous.cohort) * 100 : 0;

    return ok('q_practice_activation', {
        rate,
        previous: prev,
        delta: deltaPoints(rate, prev, true),
        activated: current.activated,
        cohort: current.cohort,
    });
}

export interface PracticeReschedule {
    rate: number;
    cancelled: number;
    total: number;
}

export async function qPracticeReschedule(): Promise<PanelBlock<PracticeReschedule>> {
    const since = new Date(Date.now() - 28 * DAY_MS);
    const rows = await db.diarySession.groupBy({
        by: ['status'],
        where: { date: { gte: since } },
        _count: { _all: true },
    });

    const total = rows.reduce((acc, r) => acc + r._count._all, 0);
    if (total === 0) {
        return noData('q_practice_reschedule', 'за 28 дней нет ни одной записи — доли считать не из чего');
    }

    const cancelled = rows.find((r) => r.status === 'cancelled')?._count._all ?? 0;
    return ok('q_practice_reschedule', { rate: (cancelled / total) * 100, cancelled, total });
}

/**
 * `q_practice_booking_author` — кто завёл запись: клиент сам или специалист
 * руками. Признака автора записи в `DiarySession` нет, а восстанавливать его
 * догадкой (например «раз есть telegramChatId, значит записался сам») —
 * ровно то выдумывание данных, которое ТЗ §5 запрещает.
 */
export async function qPracticeBookingAuthor(): Promise<PanelBlock<never>> {
    return noData('q_practice_booking_author', 'признак автора записи не собирается: поля «кто создал запись» в схеме нет');
}

/** `q_practice_reminders` — зависит от `ReminderOutbox`, которого в схеме нет. */
export async function qPracticeReminders(): Promise<PanelBlock<never>> {
    return noData('q_practice_reminders', 'журнал отправок не заведён — сверять «должны были уйти» не с чем');
}

/**
 * ЗАПИСКИ: данных нет ни по одному блоку. У продукта свой сервер и своя база,
 * кросс-продуктового приёмника не существует.
 */
const ZAPISKI_REASON = 'у ЗАПИСОК отдельный сервер, общего приёмника ещё нет';

export function zapiskiBlocks(): Record<string, PanelBlock<never>> {
    return {
        zapiskiNsm: noData('q_zapiski_nsm', ZAPISKI_REASON),
        zapiskiWriters: noData('q_zapiski_writers', ZAPISKI_REASON),
        zapiskiNotesPerSession: noData('q_zapiski_notes_per_session', ZAPISKI_REASON),
        zapiskiSyncs: noData('q_zapiski_syncs', ZAPISKI_REASON),
        zapiskiConflicts: noData('q_zapiski_conflicts', ZAPISKI_REASON),
        zapiskiSupport: noData('q_zapiski_support', ZAPISKI_REASON),
    };
}

/**
 * МОМЕНТЫ: данных нет и не появится без сервера — события копятся на устройстве.
 */
const MOMENTY_REASON = 'у МОМЕНТОВ нет сервера, события копятся на устройстве';

export function momentyBlocks(): Record<string, PanelBlock<never>> {
    return {
        momentyNsm: noData('q_momenty_nsm', MOMENTY_REASON),
        momentyInstalls: noData('q_momenty_installs', MOMENTY_REASON),
        momentyD1: noData('q_momenty_d1', MOMENTY_REASON),
        momentyD7: noData('q_momenty_d7', MOMENTY_REASON),
        momentyD30: noData('q_momenty_d30', MOMENTY_REASON),
    };
}

/**
 * Переходы между продуктами — «честный ноль»: событие `crossed_to_product`
 * в реестре есть, но точек его отправки в коде нет ни у одного продукта.
 * Ноль здесь измерен и означает «механики не существует», поэтому он
 * рисуется пунктиром с объяснением, а не как обычный ноль.
 */
export async function qCrossProduct(): Promise<PanelBlock<{ count: number; honestZero: true }>> {
    const count = await db.analyticsEvent.count({ where: { event: 'crossed_to_product' } });
    if (count > 0) {
        return ok('q_cross_product', { count, honestZero: true });
    }
    return ok('q_cross_product', { count: 0, honestZero: true });
}
