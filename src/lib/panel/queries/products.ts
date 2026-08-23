/**
 * Экран 3 — «Продукты».
 *
 * ПРАКТИКА считается целиком по бизнес-таблицам. ЗАПИСКИ и МОМЕНТЫ (после
 * потока F) считаются по `AnalyticsEvent` через общий приёмник `POST
 * /ingest` — там, где для показателя нашлось определение, которое можно
 * вычислить; там, где нет (или пока не набралось истории), блок остаётся в
 * `no_data` с настоящей причиной, а не заполнен правдоподобными числами
 * (ТЗ §5, §11). Подробности — в комментарии перед блоками ЗАПИСОК/МОМЕНТОВ
 * ниже.
 */

import { db } from '@/lib/db';
import { noData, ok, stale, type PanelBlock } from '../types';
import { deltaAbs, deltaPoints, deltaPercent, type Delta } from '../format';
import { latestPulse, NO_PULSE_REASON, staleReason } from './infra';

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

export interface PracticeReminders {
    due: number;
    sent: number;
    sentTwice: number;
    /** % от due, что реально ушло. null — due=0, делить не на что. */
    sentRate: number | null;
}

/**
 * `q_practice_reminders` — журнал `ReminderOutbox` (O-260817-16) заведён и
 * заполняется из `processReminders()` (src/lib/cron/reminders.ts); коллектор
 * InfraPulse уже снимает с него due/sent/sentTwice
 * (src/lib/infra-pulse/reminders-counters.ts) — та же тройка полей, что уже
 * показывает q_tech_channels на экране «Техника» (tech.ts). Здесь та же
 * InfraPulse читается ещё раз (панель только читает готовый снимок, ТЗ §1,
 * §11 — второй коллектор не заводим), под продуктовым углом: доля
 * долетевших напоминаний, а не техническое здоровье канала.
 */
export async function qPracticeReminders(): Promise<PanelBlock<PracticeReminders>> {
    const pulse = await latestPulse();
    if (!pulse) return noData('q_practice_reminders', NO_PULSE_REASON);
    const { row } = pulse;

    if (row.remindersDue === null) {
        return noData(
            'q_practice_reminders',
            'коллектор ещё не снимал показания журнала отправок (ReminderOutbox)',
            pulse.collectedAt.toISOString(),
        );
    }

    const due = row.remindersDue;
    const sent = row.remindersSent ?? 0;
    const sentTwice = row.remindersSentTwice ?? 0;
    const data: PracticeReminders = { due, sent, sentTwice, sentRate: due > 0 ? (sent / due) * 100 : null };
    const at = pulse.collectedAt.toISOString();

    return pulse.isStale ? stale('q_practice_reminders', data, staleReason(pulse.ageMinutes), at) : ok('q_practice_reminders', data, at);
}

/**
 * ЗАПИСКИ и МОМЕНТЫ (поток F, после E1–E5).
 *
 * До этого потока все одиннадцать блоков ниже были безусловным `no_data` с
 * причинами «у ЗАПИСОК отдельный сервер, общего приёмника ещё нет» и «у
 * МОМЕНТОВ нет сервера, события копятся на устройстве». Пять потоков (A/B/E)
 * закрыли это ровно: общий `POST /ingest` аутентифицирован, идемпотентен,
 * гейтит по субъекту и принимает оба продукта
 * (`src/lib/analytics/ingest.ts`); `consent_updated`/`identity_linked`
 * разрешены всем трём продуктам (`analytics/schema/events.yaml`); сервер
 * ЗАПИСОК пересылает свои события пачками, а МОМЕНТЫ шлют их с включённым
 * транспортом — оба доказаны настоящим кодом обеих сторон
 * (`tests/cross-repo-contract.test.ts`, `tests/cross-repo-wire.test.ts`).
 * Прежние причины стали неправдой: события обоих продуктов физически
 * попадают в `AnalyticsEvent` (`product: 'zapiski' | 'moments'`).
 *
 * Это НЕ значит, что все одиннадцать блоков ожили — только те, для которых
 * нашлось определение показателя, которое можно вычислить по тому, что
 * реально отправляется (05_METRICS §2.2/§2.3, реестр событий). Три блока
 * остаются `no_data` не из-за отсутствия приёмника, а из-за отсутствия
 * определения:
 *
 *  - `zapiskiNsm` — North Star ЗАПИСОК (`05_METRICS §2.2`) — это доля
 *    сессий ПРАКТИКИ, закрытых заметкой за 72 часа. Требует `session_id` в
 *    событии заметки — его нет ни в `note_saved` (единственное реально
 *    отправляемое событие о заметке), ни где-либо в реестре (черновое
 *    `note_linked_to_session` из `13_TRACKING_PLAN.md` в
 *    `events.yaml` не попало). Восстановить связь через `accountId` тоже
 *    нельзя: это чужой account_id ЗАПИСОК, а не `User.id` ПРАКТИКИ, и
 *    сопоставлять их запрещено условием задачи. `05_METRICS §6` сам числит
 *    эту связь в списке того, что не измеряется.
 *  - `zapiskiNotesPerSession` — тот же дефицит: знаменатель («на сессию»)
 *    недостижим без той же связи.
 *  - `zapiskiSupport` — в `events.yaml` нет ни одного события про
 *    обращения в поддержку; `ZAPISKI_feedback_beta.md` прямо говорит, что
 *    тексты обращений остаются в базе ЗАПИСОК и в общий приёмник не идут.
 *    Дыра продуктовая (нет источника), а не аналитическая.
 *
 * Субъект: у ЗАПИСОК — `accountId` (пишется в `AnalyticsEvent` как есть,
 * `ingest.ts` его не ищет и не проверяет в `User`), у МОМЕНТОВ — `deviceId`
 * (аккаунтов у продукта в проде нет). Ни один из запросов ниже не джойнит
 * ни то, ни другое с `User`/`DiarySession` ПРАКТИКИ.
 */

/**
 * `q_zapiski_nsm` — «Сессий закрыто заметкой». Определения, которое можно
 * вычислить, нет — см. комментарий блока выше. Причина честная и новая, а
 * не унаследованная ложь про отсутствие приёмника.
 */
export async function qZapiskiNsm(): Promise<PanelBlock<never>> {
    return noData(
        'q_zapiski_nsm',
        'North Star ЗАПИСОК (05_METRICS §2.2) — доля сессий ПРАКТИКИ, закрытых заметкой за 72 часа — не вычислить: у note_saved нет session_id, событие note_linked_to_session в реестр не попало, а accountId ЗАПИСОК нельзя сопоставлять с User ПРАКТИКИ',
    );
}

async function measureZapiskiWriters(fromDays: number, toDays: number): Promise<{ events: number; writers: number }> {
    const now = Date.now();
    const rows = await db.analyticsEvent.findMany({
        where: {
            product: 'zapiski',
            event: 'note_saved',
            ts: { gte: new Date(now - fromDays * DAY_MS), lt: new Date(now - toDays * DAY_MS) },
        },
        select: { accountId: true, deviceId: true },
    });

    const subjects = new Set<string>();
    for (const row of rows as { accountId: string | null; deviceId: string | null }[]) {
        const subject = row.accountId ?? row.deviceId;
        if (subject) subjects.add(subject);
    }
    return { events: rows.length, writers: subjects.size };
}

export interface ZapiskiWriters {
    count: number;
    previous: number;
    delta: Delta;
    windowDays: number;
}

/**
 * `q_zapiski_writers` — «Пишут хоть что-то»: сколько разных субъектов
 * ЗАПИСОК (`accountId`, при его отсутствии — `deviceId`) сохранили хотя бы
 * одну заметку за неделю. Прокси недельной «доли активных специалистов с
 * ≥1 заметкой» из `05_METRICS §2.2` — без доли: общего числа специалистов
 * ЗАПИСОК в этой базе нет (свой аккаунт, своя база), а подставлять чужой
 * знаменатель значило бы считать не то, что написано в источнике.
 */
export async function qZapiskiWriters(): Promise<PanelBlock<ZapiskiWriters>> {
    const windowDays = 7;
    const [current, previous] = await Promise.all([
        measureZapiskiWriters(windowDays, 0),
        measureZapiskiWriters(windowDays * 2, windowDays),
    ]);

    if (current.events === 0) {
        return noData('q_zapiski_writers', `за ${windowDays} дней от ЗАПИСОК не пришло ни одного note_saved`);
    }

    return ok('q_zapiski_writers', {
        count: current.writers,
        previous: previous.writers,
        delta: deltaAbs(current.writers, previous.writers, true),
        windowDays,
    });
}

/**
 * `q_zapiski_notes_per_session` — «Заметок на сессию». Тот же дефицит, что
 * у `zapiskiNsm`: числитель (заметки) есть, знаменатель (сессии, к которым
 * они относятся) не восстановить без `session_id` в событии заметки и без
 * запрещённого сопоставления accountId ЗАПИСОК с сессиями ПРАКТИКИ.
 */
export async function qZapiskiNotesPerSession(): Promise<PanelBlock<never>> {
    return noData(
        'q_zapiski_notes_per_session',
        'заметок на сессию не посчитать: у note_saved нет session_id, а сопоставлять accountId ЗАПИСОК с сессиями ПРАКТИКИ запрещено',
    );
}

interface ZapiskiSyncWindow {
    count: number;
    conflicts: number;
    pushed: number;
    pulled: number;
}

async function measureZapiskiSyncs(fromDays: number, toDays: number): Promise<ZapiskiSyncWindow> {
    const now = Date.now();
    const rows = await db.analyticsEvent.findMany({
        where: {
            product: 'zapiski',
            event: 'sync_completed',
            ts: { gte: new Date(now - fromDays * DAY_MS), lt: new Date(now - toDays * DAY_MS) },
        },
        select: { props: true },
    });

    let conflicts = 0;
    let pushed = 0;
    let pulled = 0;
    for (const row of rows as { props: Record<string, unknown> }[]) {
        const props = row.props ?? {};
        if (typeof props.conflicts === 'number') conflicts += props.conflicts;
        if (typeof props.pushed === 'number') pushed += props.pushed;
        if (typeof props.pulled === 'number') pulled += props.pulled;
    }
    return { count: rows.length, conflicts, pushed, pulled };
}

export interface ZapiskiSyncs {
    count: number;
    previous: number;
    delta: Delta;
    pushed: number;
    pulled: number;
    windowDays: number;
}

/**
 * `q_zapiski_syncs` — число `sync_completed` за 28 дней. `pushed`/`pulled`
 * — необязательные props события (`analytics/schema/events.yaml`),
 * суммируются по факту присутствия: клиент их не всегда шлёт.
 */
export async function qZapiskiSyncs(): Promise<PanelBlock<ZapiskiSyncs>> {
    const windowDays = 28;
    const [current, previous] = await Promise.all([
        measureZapiskiSyncs(windowDays, 0),
        measureZapiskiSyncs(windowDays * 2, windowDays),
    ]);

    if (current.count === 0) {
        return noData('q_zapiski_syncs', `за ${windowDays} дней от ЗАПИСОК не пришло ни одного sync_completed`);
    }

    return ok('q_zapiski_syncs', {
        count: current.count,
        previous: previous.count,
        delta: deltaAbs(current.count, previous.count, true),
        pushed: current.pushed,
        pulled: current.pulled,
        windowDays,
    });
}

export interface ZapiskiConflicts {
    count: number;
    previous: number;
    delta: Delta;
    syncsTotal: number;
    ratePercent: number | null;
    windowDays: number;
}

/**
 * `q_zapiski_conflicts` — сумма `conflicts` из тех же `sync_completed` за
 * 28 дней. Независимый от `zapiskiSyncs` запрос (не переиспользует его
 * результат), потому что оба обязаны самостоятельно переживать `guard()` —
 * падение одного не должно гасить другой.
 */
export async function qZapiskiConflicts(): Promise<PanelBlock<ZapiskiConflicts>> {
    const windowDays = 28;
    const [current, previous] = await Promise.all([
        measureZapiskiSyncs(windowDays, 0),
        measureZapiskiSyncs(windowDays * 2, windowDays),
    ]);

    if (current.count === 0) {
        return noData(
            'q_zapiski_conflicts',
            `за ${windowDays} дней от ЗАПИСОК не пришло ни одного sync_completed — конфликты считать не из чего`,
        );
    }

    return ok('q_zapiski_conflicts', {
        count: current.conflicts,
        previous: previous.conflicts,
        delta: deltaAbs(current.conflicts, previous.conflicts, false),
        syncsTotal: current.count,
        ratePercent: current.count > 0 ? (current.conflicts / current.count) * 100 : null,
        windowDays,
    });
}

/**
 * `q_zapiski_support` — «Бета: обращения». В реестре событий нет ни одного
 * события про обращения в поддержку (`note_saved`/`note_searched`/
 * `sync_completed`/`export_requested` — и всё), а `ZAPISKI_feedback_beta.md`
 * прямо оговаривает: тексты обращений остаются в базе ЗАПИСОК и в общий
 * приёмник не отправляются — только словарь тем `topics.ts`, у которого
 * пока нет источника. Дыра продуктовая, не аналитическая.
 */
export async function qZapiskiSupport(): Promise<PanelBlock<never>> {
    return noData(
        'q_zapiski_support',
        'обращения беты живут в базе ЗАПИСОК и не отправляются в общий приёмник — события для этого в реестре нет',
    );
}

async function measureMomentyD0(fromDays: number, toDays: number): Promise<{ cohort: number; activated: number }> {
    const now = Date.now();
    const installs = await db.analyticsEvent.findMany({
        where: {
            product: 'moments',
            event: 'app_installed',
            deviceId: { not: null },
            ts: { gte: new Date(now - fromDays * DAY_MS), lt: new Date(now - toDays * DAY_MS) },
        },
        select: { deviceId: true, ts: true },
    });
    if (installs.length === 0) return { cohort: 0, activated: 0 };

    const installByDevice = new Map<string, Date>();
    for (const row of installs as { deviceId: string; ts: Date }[]) {
        const seen = installByDevice.get(row.deviceId);
        if (!seen || row.ts < seen) installByDevice.set(row.deviceId, row.ts);
    }

    const finishes = await db.analyticsEvent.findMany({
        where: { product: 'moments', event: 'practice_finished', deviceId: { in: [...installByDevice.keys()] } },
        select: { deviceId: true, ts: true },
    });
    const finishByDevice = new Map<string, Date[]>();
    for (const row of finishes as { deviceId: string; ts: Date }[]) {
        const list = finishByDevice.get(row.deviceId) ?? [];
        list.push(row.ts);
        finishByDevice.set(row.deviceId, list);
    }

    let activated = 0;
    for (const [deviceId, installTs] of installByDevice) {
        const hits = finishByDevice.get(deviceId) ?? [];
        const within = hits.some((ts) => ts.getTime() >= installTs.getTime() && ts.getTime() - installTs.getTime() <= DAY_MS);
        if (within) activated += 1;
    }
    return { cohort: installByDevice.size, activated };
}

export interface MomentyActivation {
    rate: number;
    previous: number;
    delta: Delta;
    activated: number;
    cohort: number;
    windowDays: number;
}

/**
 * `q_momenty_nsm` — «Завершили первую практику в первый день». Определение
 * — карточка активации МОМЕНТОВ, `05_METRICS §2.3`: ≥1 завершённая практика
 * в первые 24 часа после установки. Когорта — устройства, установившие
 * МОМЕНТЫ; окно сдвинуто на сутки, чтобы у каждого устройства в когорте
 * эти 24 часа уже истекли (посчитано, а не «рано»).
 */
export async function qMomentyNsm(): Promise<PanelBlock<MomentyActivation>> {
    const windowDays = 7;
    const maturityDays = 1;
    const [current, previous] = await Promise.all([
        measureMomentyD0(windowDays + maturityDays, maturityDays),
        measureMomentyD0(windowDays * 2 + maturityDays, windowDays + maturityDays),
    ]);

    if (current.cohort === 0) {
        return noData(
            'q_momenty_nsm',
            `за последние ${windowDays} дней (плюс сутки на созревание когорты) МОМЕНТЫ не прислали ни одного app_installed`,
        );
    }

    const rate = (current.activated / current.cohort) * 100;
    const prevRate = previous.cohort > 0 ? (previous.activated / previous.cohort) * 100 : 0;

    return ok('q_momenty_nsm', {
        rate,
        previous: prevRate,
        delta: deltaPoints(rate, prevRate, true),
        activated: current.activated,
        cohort: current.cohort,
        windowDays,
    });
}

async function measureMomentyInstalls(fromDays: number, toDays: number): Promise<number> {
    const now = Date.now();
    return db.analyticsEvent.count({
        where: {
            product: 'moments',
            event: 'app_installed',
            ts: { gte: new Date(now - fromDays * DAY_MS), lt: new Date(now - toDays * DAY_MS) },
        },
    });
}

export interface MomentyInstalls {
    count: number;
    previous: number;
    delta: Delta;
    windowDays: number;
}

/** `q_momenty_installs` — установок в неделю: число `app_installed`. */
export async function qMomentyInstalls(): Promise<PanelBlock<MomentyInstalls>> {
    const windowDays = 7;
    const [current, previous] = await Promise.all([
        measureMomentyInstalls(windowDays, 0),
        measureMomentyInstalls(windowDays * 2, windowDays),
    ]);

    if (current === 0) {
        return noData('q_momenty_installs', `за ${windowDays} дней МОМЕНТЫ не прислали ни одного app_installed`);
    }

    return ok('q_momenty_installs', { count: current, previous, delta: deltaAbs(current, previous, true), windowDays });
}

export interface MomentyRetention {
    percent: number;
    retained: number;
    cohort: number;
    days: number;
}

/** Сколько дней зрелой когорты берём в окно D1/D7/D30 разом, а не одну когорту дня. */
const RETENTION_COHORT_DAYS = 28;

/**
 * Физически ли возможно посчитать D`n`: нужно, чтобы самое старое событие
 * `app_installed` МОМЕНТОВ было старше `n+1` суток — иначе ни одна когорта
 * ещё не могла дожить до дня `n`. Это не измеренный ноль, а недостаточная
 * история (условие задачи, F2) — таблица пуста или младше окна.
 */
async function momentyHistoryTooShortFor(days: number): Promise<boolean> {
    const oldest = await db.analyticsEvent.findFirst({
        where: { product: 'moments', event: 'app_installed' },
        orderBy: { ts: 'asc' },
        select: { ts: true },
    });
    if (!oldest) return true;
    return Date.now() - (oldest as { ts: Date }).ts.getTime() < (days + 1) * DAY_MS;
}

/**
 * Удержание МОМЕНТОВ по когортам устройств (условие задачи, F2):
 * `app_installed` задаёт день 0, возврат на день N — любое событие того же
 * устройства в промежутке [installTs + N дней, installTs + N+1 день).
 * Когорта — устройства, установившие МОМЕНТЫ в окне `RETENTION_COHORT_DAYS`
 * дней перед тем, у кого день N уже наступил (installTs + (N+1) дней ≤
 * сейчас) — иначе они попали бы в знаменатель, ещё не успев вернуться.
 */
async function measureMomentyRetention(days: number): Promise<PanelBlock<MomentyRetention>> {
    const source = `q_momenty_d${days}`;

    if (await momentyHistoryTooShortFor(days)) {
        return noData(
            source,
            `для D${days} нужно ${days + 1} дней истории с первой установки МОМЕНТОВ — таблица событий пока моложе`,
        );
    }

    const now = Date.now();
    const cohortUntil = new Date(now - (days + 1) * DAY_MS);
    const cohortSince = new Date(now - (days + 1 + RETENTION_COHORT_DAYS) * DAY_MS);

    const installs = await db.analyticsEvent.findMany({
        where: {
            product: 'moments',
            event: 'app_installed',
            deviceId: { not: null },
            ts: { gte: cohortSince, lt: cohortUntil },
        },
        select: { deviceId: true, ts: true },
    });

    if (installs.length === 0) {
        return noData(
            source,
            `в окне ${RETENTION_COHORT_DAYS} дней нет ни одной установки МОМЕНТОВ, доросшей до дня ${days}`,
        );
    }

    const installByDevice = new Map<string, Date>();
    for (const row of installs as { deviceId: string; ts: Date }[]) {
        const seen = installByDevice.get(row.deviceId);
        if (!seen || row.ts < seen) installByDevice.set(row.deviceId, row.ts);
    }

    const events = await db.analyticsEvent.findMany({
        where: {
            product: 'moments',
            deviceId: { in: [...installByDevice.keys()] },
            ts: { gte: cohortSince, lte: new Date(now) },
        },
        select: { deviceId: true, ts: true },
    });

    const eventsByDevice = new Map<string, Date[]>();
    for (const row of events as { deviceId: string; ts: Date }[]) {
        const list = eventsByDevice.get(row.deviceId) ?? [];
        list.push(row.ts);
        eventsByDevice.set(row.deviceId, list);
    }

    let retained = 0;
    for (const [deviceId, installTs] of installByDevice) {
        const dayStart = installTs.getTime() + days * DAY_MS;
        const dayEnd = dayStart + DAY_MS;
        const hits = (eventsByDevice.get(deviceId) ?? []).some((ts) => ts.getTime() >= dayStart && ts.getTime() < dayEnd);
        if (hits) retained += 1;
    }

    return ok(source, { percent: (retained / installByDevice.size) * 100, retained, cohort: installByDevice.size, days });
}

export const qMomentyD1 = (): Promise<PanelBlock<MomentyRetention>> => measureMomentyRetention(1);
export const qMomentyD7 = (): Promise<PanelBlock<MomentyRetention>> => measureMomentyRetention(7);
export const qMomentyD30 = (): Promise<PanelBlock<MomentyRetention>> => measureMomentyRetention(30);

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
