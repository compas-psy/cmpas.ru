import { db } from '@/lib/db';
import { resolveWallClockParts } from '@/lib/calendar/normalized-event';
import { calendarDateToUtcMidnight } from '@/lib/practice/migration/date-utils';
import { CALENDAR_IMPORT_ORIGIN, SPREADSHEET_IMPORT_ORIGIN } from '@/lib/practice/session-origin';

/**
 * Состояние онбординга практики — одно на веб и приложение (Задача 24).
 *
 * До этого «онбординг» был тремя разными вещами сразу: веб считал шаги сам в
 * /api/onboarding/progress и прятал полосу через localStorage, приложение
 * получало один булев needsOnboarding и ссылку на веб-визард, а в базе лежал
 * грубый PsychologistSettings.onboardingCompleted. Три источника расходились:
 * «скрыть» в браузере ничего не значило для телефона, а переустановка
 * приложения возвращала подсказку человеку, который её уже закрыл.
 *
 * Здесь один ответ на вопрос «что осталось сделать», и оба клиента берут его
 * отсюда.
 *
 * Главное правило: три из четырёх шагов ВЫЧИСЛЯЮТСЯ из настоящих данных
 * практики и не хранятся отдельными флагами — их нельзя «отметить», их можно
 * только сделать. Четвёртый, «поделиться», данными не виден: ссылка
 * существует у всех с первого дня, поэтому у него есть своя отметка времени,
 * которую ставит ТОЛЬКО состоявшееся действие человека.
 */

export type OnboardingStepKey = 'client' | 'schedule' | 'session' | 'share';

export type PracticeOnboardingState = {
    /** Человек закрыл подсказку — на сервере, значит на всех устройствах. */
    dismissed: boolean;
    /** Все четыре шага сделаны. Производное, в базе не хранится. */
    completed: boolean;
    /**
     * Практика совсем пустая: ни клиентов, ни расписания, ни записей. Только
     * такому аккаунту предлагают выбор «перенести практику» или «начать с
     * нуля»; у того, кто уже что-то завёл, этот выбор давно сделан.
     */
    empty: boolean;
    steps: Record<OnboardingStepKey, boolean>;
};

const IMPORT_ORIGINS = [CALENDAR_IMPORT_ORIGIN, SPREADSHEET_IMPORT_ORIGIN];

/** Начало сегодняшнего дня по часам практики — как в src/lib/practice/addresses.ts. */
async function todayStart(psychologistId: string, now: Date): Promise<Date> {
    const settings = await db.psychologistSettings.findUnique({
        where: { psychologistId },
        select: { timezone: true },
    });
    const { date } = resolveWallClockParts(now, settings?.timezone || 'Europe/Moscow');
    return calendarDateToUtcMidnight(date);
}

/**
 * Что осталось сделать.
 *
 * Шаги:
 *
 *  • клиенты — хотя бы один действующий. Перенесённые импортом ничем не
 *    отличаются от заведённых руками: заставлять мигрировавшего специалиста
 *    «завести первого клиента» заново было бы издевательством. Архивные не
 *    считаются: практика, где всех архивировали, не настроена;
 *  • расписание — хотя бы одно ДЕЙСТВУЮЩЕЕ окно или правило (Задача 18:
 *    выключенное правило никого никуда не ведёт);
 *  • запись — либо будущая встреча, либо перенесённая импортом. Отменённая
 *    встреча настройку не доказывает: она как раз не состоялась;
 *  • поделиться — только по отметке bookingLinkSharedAt. Ни существование
 *    ссылки, ни открытие шторки, ни аналитика шагом не являются.
 */
export async function getPracticeOnboarding(
    psychologistId: string,
    now: Date = new Date(),
): Promise<PracticeOnboardingState> {
    const dayStart = await todayStart(psychologistId, now);

    const [clients, slots, rules, futureSessions, importedSessions, settings] = await Promise.all([
        db.diaryClient.count({ where: { psychologistId, status: { not: 'archived' } } }),
        db.availabilitySlot.count({ where: { psychologistId, isActive: true } }),
        db.scheduleRule.count({ where: { psychologistId, isActive: true } }).catch(() => 0),
        db.diarySession.count({
            where: {
                psychologistId,
                date: { gte: dayStart },
                status: { notIn: ['cancelled', 'no_show'] },
            },
        }),
        db.diarySession.count({
            where: { psychologistId, origin: { in: IMPORT_ORIGINS }, status: { not: 'cancelled' } },
        }).catch(() => 0),
        db.psychologistSettings.findUnique({
            where: { psychologistId },
            select: { bookingLinkSharedAt: true, onboardingDismissedAt: true },
        }),
    ]);

    const steps: Record<OnboardingStepKey, boolean> = {
        client: clients > 0,
        schedule: slots + rules > 0,
        session: futureSessions > 0 || importedSessions > 0,
        share: settings?.bookingLinkSharedAt != null,
    };

    return {
        dismissed: settings?.onboardingDismissedAt != null,
        completed: Object.values(steps).every(Boolean),
        empty: !steps.client && !steps.schedule && !steps.session,
        steps,
    };
}

/**
 * Отметить, что ссылкой действительно поделились.
 *
 * Ставится один раз: первое состоявшееся действие и есть тот момент, когда
 * шаг перестал быть невыполненным. Переписывать отметку при каждом следующем
 * «поделиться» незачем — это не журнал действий, а один признак.
 *
 * Звать её можно ТОЛЬКО после успеха: скопировали, система приняла share,
 * показали QR. Открытие шторки — не действие.
 */
export async function markBookingLinkShared(
    psychologistId: string,
    now: Date = new Date(),
): Promise<void> {
    const existing = await db.psychologistSettings.findUnique({
        where: { psychologistId },
        select: { bookingLinkSharedAt: true },
    });
    if (existing?.bookingLinkSharedAt) return;

    await db.psychologistSettings.upsert({
        where: { psychologistId },
        create: { psychologistId, bookingLinkSharedAt: now },
        update: { bookingLinkSharedAt: now },
    });
}

/**
 * «Скрыть» — решение человека, а не состояние браузера.
 *
 * Раньше оно жило в localStorage: другой браузер, режим инкогнито или
 * переустановка приложения возвращали подсказку тому, кто её уже убрал.
 */
export async function dismissPracticeOnboarding(
    psychologistId: string,
    now: Date = new Date(),
): Promise<void> {
    await db.psychologistSettings.upsert({
        where: { psychologistId },
        create: { psychologistId, onboardingDismissedAt: now },
        update: { onboardingDismissedAt: now },
    });
}
