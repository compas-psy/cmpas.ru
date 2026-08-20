/**
 * Экран 1 — «Утро». Единственный экран, который смотрят каждый день.
 * Порядок жёсткий: главная метрика → состояние систем → «требует вас».
 */

import { db } from '@/lib/db';
import { broken, guard, noData, ok, stale, type AttentionItem, type LampData, type PanelBlock } from '../types';
import { severityFor, THRESHOLDS } from '../thresholds';
import { deltaPercent, dateOf, dec, duration, num, pct, type Delta } from '../format';
import { latestPulse, NO_PULSE_REASON, parseContainers, parseDrift, staleReason } from './infra';
import { backupDrillAt } from './config';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionsWeekly {
    current: number;
    previous: number;
    delta: Delta;
    /** 12 недель, от старой к новой. `null` — недели до появления таблицы. */
    weeks: { label: string; value: number | null }[];
}

/**
 * `q_sessions_weekly` — главная метрика: сессии через систему за неделю.
 * Считаем завершённые сессии: намерение записаться метрикой не является.
 */
export async function qSessionsWeekly(): Promise<PanelBlock<SessionsWeekly>> {
    const now = new Date();
    const from = new Date(now.getTime() - 12 * WEEK_MS);

    const rows = await db.diarySession.findMany({
        where: { status: 'completed', date: { gte: from, lte: now } },
        select: { date: true },
    });

    const buckets = new Array(12).fill(0) as number[];
    for (const row of rows) {
        const idx = 11 - Math.floor((now.getTime() - row.date.getTime()) / WEEK_MS);
        if (idx >= 0 && idx < 12) buckets[idx] += 1;
    }

    const current = buckets[11];
    const previous = buckets[10];

    return ok('q_sessions_weekly', {
        current,
        previous,
        delta: deltaPercent(current, previous, true),
        weeks: buckets.map((value, i) => ({
            label: dateOf(new Date(now.getTime() - (11 - i) * WEEK_MS)),
            value,
        })),
    });
}

/** `q_lamp_money` — доля успешных списаний за сутки. */
export async function qLampMoney(): Promise<PanelBlock<LampData>> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await db.payment.groupBy({
        by: ['status'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
    });

    const total = rows.reduce((acc, r) => acc + r._count._all, 0);
    if (total === 0) {
        // Ноль попыток — это не «списания на нуле», это отсутствие измерения.
        return noData('q_lamp_money', 'за сутки не было ни одной попытки списания — доли считать не из чего');
    }

    const paid = rows.find((r) => r.status === 'paid')?._count._all ?? 0;
    const rate = (paid / total) * 100;
    const severity = severityFor('paymentSuccess', rate);

    return ok('q_lamp_money', {
        label: 'Деньги',
        lamp: severity === 'serious' ? 'serious' : severity === 'warning' ? 'warning' : 'ok',
        detail: `списания ${pct(rate)} · ${num(paid)} из ${num(total)}`,
        href: '/admin/panel/money',
    });
}

/** `q_lamp_site` — сертификат и аптайм контейнера приложения. */
export async function qLampSite(): Promise<PanelBlock<LampData>> {
    const pulse = await latestPulse();
    if (!pulse) return noData('q_lamp_site', NO_PULSE_REASON);

    const { row } = pulse;
    const containers = parseContainers(row.containers);
    const app = containers?.find((c) => c.name.includes('app') || c.name.includes('web'));
    const certDays = row.certDaysLeft;

    if (certDays === null && !app) {
        return noData('q_lamp_site', 'в последнем показании нет ни сертификата, ни контейнеров', pulse.collectedAt.toISOString());
    }

    const certSeverity = severityFor('certDaysLeft', certDays);
    const appDown = app ? !app.running : false;

    const lamp: LampData['lamp'] =
        appDown ? 'broken'
        : certSeverity === 'serious' ? 'serious'
        : certSeverity === 'warning' ? 'warning'
        : 'ok';

    const parts: string[] = [];
    if (app) parts.push(app.running ? `приложение ${duration(app.uptimeSeconds / 3600)}` : 'приложение не запущено');
    if (certDays !== null) parts.push(`сертификат ${certDays} дн`);

    const data: LampData = { label: 'Сайт', lamp, detail: parts.join(' · '), href: '/admin/panel/tech' };
    return pulse.isStale
        ? stale('q_lamp_site', data, staleReason(pulse.ageMinutes), pulse.collectedAt.toISOString())
        : ok('q_lamp_site', data, pulse.collectedAt.toISOString());
}

/**
 * `q_lamp_db` — расхождение миграций.
 * Любое расхождение — «серьёзно», порога «внимание» у него нет (ТЗ §7).
 */
export async function qLampDb(): Promise<PanelBlock<LampData>> {
    const pulse = await latestPulse();
    if (!pulse) return noData('q_lamp_db', NO_PULSE_REASON);

    const { row } = pulse;
    const drift = parseDrift(row.migrationsDrift);
    const unfinished = row.migrationsUnfinished ?? 0;

    if (drift === null && row.migrationsApplied === null) {
        return noData('q_lamp_db', 'журнал миграций в показании пуст', pulse.collectedAt.toISOString());
    }

    const driftCount = drift?.total ?? 0;
    const lamp: LampData['lamp'] = driftCount > 0 ? 'broken' : unfinished > 0 ? 'serious' : 'ok';

    const detail =
        driftCount > 0 ? `миграций расходится: ${driftCount}`
        : unfinished > 0 ? `незавершённых миграций: ${unfinished}`
        : `в журнале ${num(row.migrationsApplied ?? 0)}, расхождений нет`;

    const data: LampData = { label: 'База', lamp, detail, href: '/admin/panel/tech' };
    return pulse.isStale
        ? stale('q_lamp_db', data, staleReason(pulse.ageMinutes), pulse.collectedAt.toISOString())
        : ok('q_lamp_db', data, pulse.collectedAt.toISOString());
}

/**
 * `q_lamp_backup` — возраст и читаемость копии есть; «дней с учебного
 * восстановления» источника не имеет, пока никто не заполнил
 * `SystemConfig.backup_restore_drill_at`.
 *
 * Правило ТЗ §5/§6.3: пока это число не станет конечным, лампа не может
 * быть зелёной ни при каких обстоятельствах.
 */
export async function qLampBackup(): Promise<PanelBlock<LampData>> {
    const [pulse, drill] = await Promise.all([latestPulse(), backupDrillAt()]);
    if (!pulse) return noData('q_lamp_backup', NO_PULSE_REASON);

    const { row } = pulse;
    if (row.backupAgeHours === null && row.backupReadable === null) {
        return noData('q_lamp_backup', 'в показании нет данных о копиях', pulse.collectedAt.toISOString());
    }

    const ageSeverity = severityFor('backupAgeHours', row.backupAgeHours);
    const unreadable = row.backupReadable === false;

    // Без учебного восстановления лампа не опускается ниже «серьёзно».
    const lamp: LampData['lamp'] =
        unreadable ? 'broken'
        : drill === null ? 'serious'
        : ageSeverity === 'serious' ? 'serious'
        : ageSeverity === 'warning' ? 'warning'
        : 'ok';

    const detail =
        unreadable ? 'последняя копия не читается'
        : drill === null ? 'учебного восстановления не было ни разу'
        : `восстановление ${dateOf(drill)} · копии ${duration(row.backupAgeHours ?? 0)}`;

    const data: LampData = { label: 'Бэкап', lamp, detail, href: '/admin/panel/tech' };
    return pulse.isStale
        ? stale('q_lamp_backup', data, staleReason(pulse.ageMinutes), pulse.collectedAt.toISOString())
        : ok('q_lamp_backup', data, pulse.collectedAt.toISOString());
}

/**
 * `q_lamp_reminders` — зависит от `ReminderOutbox`.
 * Модели в схеме нет, коллектор пишет в счётчики null — блок честно пуст.
 */
export async function qLampReminders(): Promise<PanelBlock<LampData>> {
    const pulse = await latestPulse();
    if (!pulse) return noData('q_lamp_reminders', NO_PULSE_REASON);

    const { row } = pulse;
    if (row.remindersDue === null && row.remindersSent === null) {
        return noData('q_lamp_reminders', 'журнал отправок не заведён', pulse.collectedAt.toISOString());
    }

    const due = row.remindersDue ?? 0;
    if (due === 0) {
        return noData('q_lamp_reminders', 'за сутки не было ни одного напоминания к отправке', pulse.collectedAt.toISOString());
    }

    const sent = row.remindersSent ?? 0;
    const rate = (sent / due) * 100;
    const severity = severityFor('remindersOnTime', rate);

    const data: LampData = {
        label: 'Рассылка',
        lamp: severity === 'serious' ? 'serious' : severity === 'warning' ? 'warning' : 'ok',
        detail: `вовремя ${pct(rate)} · цель ровно 100 %`,
        href: '/admin/panel/tech',
    };
    return pulse.isStale
        ? stale('q_lamp_reminders', data, staleReason(pulse.ageMinutes), pulse.collectedAt.toISOString())
        : ok('q_lamp_reminders', data, pulse.collectedAt.toISOString());
}

/**
 * `q_lamp_app` — источника нет: у МОМЕНТОВ нет сервера, у ЗАПИСОК свой.
 * Это `unverified`, а не «в порядке»: серый пунктир, не зелёный (ТЗ §5).
 */
export async function qLampApp(): Promise<PanelBlock<LampData>> {
    return ok('q_lamp_app', {
        label: 'Приложение',
        lamp: 'unverified',
        detail: 'нет сигнала от приложений',
        href: '/admin/panel/tech',
    });
}

/**
 * `q_attention` — «требует вас». Вычисляется из состояний ламп и порогов.
 * Формулировки — через ПОСЛЕДСТВИЕ, а не через метрику, и живут здесь,
 * в конфиге запроса, а не в разметке (ТЗ §5).
 */
export async function qAttention(lamps: {
    money: PanelBlock<LampData>;
    site: PanelBlock<LampData>;
    dbLamp: PanelBlock<LampData>;
    backup: PanelBlock<LampData>;
    reminders: PanelBlock<LampData>;
}): Promise<PanelBlock<AttentionItem[]>> {
    const items: AttentionItem[] = [];
    const pulse = await latestPulse();
    const drift = pulse ? parseDrift(pulse.row.migrationsDrift) : null;
    const drill = await backupDrillAt();

    if (drift && drift.total > 0) {
        items.push({
            id: 'schema-drift',
            title: 'Схема базы разошлась с репозиторием',
            consequence: `Не применено миграций: ${drift.total}. Следующая выкладка упадёт молча — ошибка вылезет уже у пользователей.`,
            minutes: 30,
            lamp: 'broken',
            action: { label: 'Открыть базу', href: '/admin/panel/tech' },
        });
    }

    if (drill === null) {
        items.push({
            id: 'backup-drill',
            title: 'Учебного восстановления не было ни разу',
            consequence: 'Копии снимаются, но никем не разворачивались. Пока это так, бэкапа у нас нет — есть файлы неизвестного качества.',
            minutes: 20,
            lamp: 'serious',
            action: { label: 'Назначить проверку', href: '/admin/system' },
        });
    }

    const buildMinutes = pulse?.row.buildMinutesLeft ?? null;
    const buildSeverity = severityFor('buildMinutes', buildMinutes);
    if (buildSeverity === 'warning' || buildSeverity === 'serious') {
        items.push({
            id: 'build-minutes',
            title: `Минуты сборок кончаются: осталось ${num(buildMinutes ?? 0)}`,
            consequence: 'Когда они кончатся, выкладки останавливаются целиком — включая срочную починку.',
            minutes: 5,
            lamp: buildSeverity === 'serious' ? 'serious' : 'warning',
            action: { label: 'Продлить тариф', href: '/admin/panel/tech' },
        });
    }

    const money = lamps.money.data;
    if (money && (money.lamp === 'warning' || money.lamp === 'serious')) {
        items.push({
            id: 'payments',
            title: 'Списания проходят хуже порога',
            consequence: `Каждый несписанный платёж — это подписка, которая тихо кончится. Порог внимания — ${THRESHOLDS.paymentSuccess.warning} %.`,
            minutes: 15,
            lamp: money.lamp,
            action: { label: 'Открыть деньги', href: '/admin/panel/money' },
        });
    }

    const site = lamps.site.data;
    if (site && (site.lamp === 'serious' || site.lamp === 'broken')) {
        items.push({
            id: 'site',
            title: site.lamp === 'broken' ? 'Приложение не запущено' : 'Сертификат скоро истечёт',
            consequence:
                site.lamp === 'broken'
                    ? 'Сайт недоступен: ни записи, ни оплат, ни входа в кабинет.'
                    : 'После истечения браузер закроет вход в кабинет предупреждением, а бот перестанет получать вебхуки.',
            minutes: site.lamp === 'broken' ? 30 : 10,
            lamp: site.lamp,
            action: { label: 'Открыть технику', href: '/admin/panel/tech' },
        });
    }

    const reminders = lamps.reminders.data;
    if (reminders && reminders.lamp !== 'ok') {
        items.push({
            id: 'reminders',
            title: 'Напоминания уходят не все',
            consequence: 'Клиент, не получивший напоминание, просто не приходит — а специалист узнаёт об этом в час сессии.',
            minutes: 20,
            lamp: reminders.lamp === 'broken' ? 'broken' : reminders.lamp === 'serious' ? 'serious' : 'warning',
            action: { label: 'Открыть технику', href: '/admin/panel/tech' },
        });
    }

    const order = { broken: 0, serious: 1, warning: 2, unverified: 3, ok: 4 } as const;
    items.sort((a, b) => order[a.lamp] - order[b.lamp]);

    return ok('q_attention', items);
}

export { guard, broken, dec };
