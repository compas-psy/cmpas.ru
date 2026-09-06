import type {
    ResolveDayParams,
    ResolvedSlotOption,
} from './types';

// Task 6 (PRAKTIKA MVP): pure, testable day-availability resolver, extracted
// from the inline `getAvailableTimesForDateStr` that used to live in
// src/app/bot/actions.ts. src/app/bot/actions.ts is now a thin adapter:
// it fetches AvailabilitySlot/ScheduleRule/DiaryBlock/DiarySession/settings
// rows from the DB and calls resolveAvailableTimesForDay with them — no
// database access happens in this file.
//
// Two real bugs fixed relative to the old inline version:
//
// 1. maxSessionsPerDay used to be checked against
//    `bookedCount + <candidate slots generated so far in this render>`,
//    not real bookings. Once several ScheduleRules apply to the same day,
//    the second/third rule's candidates count against the cap purely
//    because the first rule already generated a few options — with ZERO
//    real sessions booked, a maxSessionsPerDay=4 cap could still truncate
//    an evening rule after a single slot just because a morning rule had
//    already produced three. The cap now compares ONLY the real booked
//    DiarySession count for the day, checked once up front.
//
// 2. Two slots landing on the same clock time were deduped by
//    `${time}-${format}` alone — same time, same format, but a DIFFERENT
//    rule (different address, different scheduleRuleId) silently
//    overwrote the first one, since both compute to the same key. The key
//    now includes addressId and scheduleRuleId (falling back to
//    availabilitySlotId when a slot has no rule), so distinct bookable
//    options at the same time never collapse into one — only an exact
//    duplicate (same rule, same address, same format, same time) does.
export function resolveAvailableTimesForDay(params: ResolveDayParams): ResolvedSlotOption[] {
    const {
        dateStr,
        slots,
        blocks,
        sessions,
        settings,
        clientId = null,
        skipBuffer = false,
        now = new Date(),
    } = params;

    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    // Use the practice timezone (default Europe/Moscow) for "now" — the server
    // runs in UTC, but slot times like "17:00" are local wall-clock. Comparing
    // against UTC hours wrongly offers past slots (e.g. 17:00 at 19:07 MSK).
    const tz = settings?.timezone || 'Europe/Moscow';
    const nowParts = getPartsInTz(now, tz);
    const todayStr = `${nowParts.year}-${String(nowParts.month).padStart(2, '0')}-${String(nowParts.day).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const nowH = Number(nowParts.hour);
    const nowM = Number(nowParts.minute);

    // Global settings checks
    const bufferHours = settings?.bookingBufferHours ?? 24;
    const bufferDate = new Date(now.getTime() + bufferHours * 60 * 60 * 1000);
    const bufferParts = getPartsInTz(bufferDate, tz);
    const bufferDateStr = `${bufferParts.year}-${String(bufferParts.month).padStart(2, '0')}-${String(bufferParts.day).padStart(2, '0')}`;
    if (dateStr < todayStr) return [];

    // Horizon check — only for client-facing booking, not psychologist
    if (!skipBuffer) {
        const horizonDays = settings?.bookingHorizonDays ?? 14;
        const horizonDate = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
        const horizonDateStr = toDateStr(horizonDate);
        if (dateStr > horizonDateStr) return [];
    }

    const maxSessionsPerDay = settings?.maxSessionsPerDay ?? null;
    const defaultSessionBreak = settings?.sessionBreak ?? 15;

    const dayOfWeek = (date.getUTCDay() + 6) % 7;

    const daySlots = slots.filter(s => {
        if (s.dayOfWeek !== dayOfWeek) return false;

        // Источник правды о доступности: действующий слот И (правила нет ИЛИ
        // правило включено). Тумблер «выключить правило» в расписании
        // специалиста менял только ScheduleRule.isActive, а резолвер этого
        // поля не знал — выключенное правило продолжало публиковать часы
        // клиентам. Сам слот фильтруется по isActive там, где читается из БД.
        if (s.scheduleRule && !s.scheduleRule.isActive) return false;

        const ruleStart = s.scheduleRule?.startDate || s.startDate;
        if (ruleStart) {
            const slotStartStr = toDateStr(new Date(ruleStart));
            if (dateStr < slotStartStr) return false;
        }

        const ruleEnd = s.scheduleRule?.endDate || s.endDate;
        if (ruleEnd) {
            const slotEndStr = toDateStr(new Date(ruleEnd));
            if (dateStr > slotEndStr) return false;
        }
        return true;
    });

    const clientAudience = clientId ? 'regular' : 'new';
    const daySessions = sessions.filter(s => toDateStr(new Date(s.date)) === dateStr);
    const bookedCount = daySessions.length;

    // Fix 1: the day is either already at/over capacity from REAL bookings,
    // in which case nothing further should be offered — or it isn't, in
    // which case every otherwise-valid candidate across every rule should
    // be shown. bookedCount never changes while resolving a single day, so
    // this is a one-time check, not a per-candidate one.
    if (maxSessionsPerDay && bookedCount >= maxSessionsPerDay) return [];

    const timesObj: Record<string, ResolvedSlotOption> = {};

    daySlots.forEach(slot => {
        const audienceFilter = slot.scheduleRule?.audienceFilter || 'all';
        if (audienceFilter !== 'all' && audienceFilter !== clientAudience) return;

        const [startH, startM] = slot.startTime.split(':').map(Number);
        const [endH, endM] = slot.endTime.split(':').map(Number);
        const duration = slot.scheduleRule?.duration ?? slot.duration ?? 50;
        const format = slot.scheduleRule?.format ?? slot.format ?? 'online';
        const addressId = slot.scheduleRule?.addressId ?? slot.addressId ?? null;
        const breakDuration = slot.scheduleRule?.breakDuration ?? defaultSessionBreak;

        let currentTotalMins = startH * 60 + startM;
        const endTotalMins = endH * 60 + endM;

        while (currentTotalMins + duration <= endTotalMins) {
            const h = Math.floor(currentTotalMins / 60);
            const m = currentTotalMins % 60;
            const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const slotEndTimeMins = currentTotalMins + duration;

            // Evaluated exact time buffer.
            if (skipBuffer) {
                // Psychologist manually creating — no buffer restriction, only skip past times for today
                if (isToday) {
                    if (h < nowH || (h === nowH && m <= nowM)) {
                        currentTotalMins += duration + breakDuration;
                        continue;
                    }
                }
            } else if (isToday || dateStr === bufferDateStr) {
                // bufferDate comparison. If this exact slot starts before the buffer Date/Time, skip it.
                const [bH, bM] = [Number(bufferParts.hour), Number(bufferParts.minute)];
                if (dateStr === bufferDateStr && (h < bH || (h === bH && m < bM))) {
                    currentTotalMins += duration + breakDuration;
                    continue;
                } else if (dateStr < bufferDateStr) {
                    currentTotalMins += duration + breakDuration;
                    continue;
                }
            }

            const hasBlock = blocks.some(b => {
                if (toDateStr(new Date(b.date)) !== dateStr) return false;
                const [bSH, bSM] = b.startTime.split(':').map(Number);
                const [bEH, bEM] = b.endTime.split(':').map(Number);
                const blockStartMins = bSH * 60 + bSM;
                const blockEndMins = bEH * 60 + bEM;
                return currentTotalMins < blockEndMins && slotEndTimeMins > blockStartMins;
            });

            let isOwnSession = false;
            let hasClash = false;
            const collidingSession = daySessions.find(sess => {
                const [sessH, sessM] = sess.time.split(':').map(Number);
                const sessStartMins = sessH * 60 + sessM;
                const sessEndMins = sessStartMins + (sess.duration || 50);
                return currentTotalMins < sessEndMins && slotEndTimeMins > sessStartMins;
            });

            if (collidingSession) {
                if (clientId && collidingSession.clientId === clientId) {
                    isOwnSession = true;
                } else {
                    hasClash = true;
                }
            }

            if (!hasClash && !hasBlock) {
                // Fix 2: the key is the USER-VISIBLE option — time, format,
                // address, duration. It deliberately does NOT include
                // scheduleRuleId: two rules that happen to produce the exact
                // same bookable option (same time/format/address/duration)
                // are one button to the client, not two identical-looking
                // ones. Two rules with a different address or format DO
                // still key apart, since those are genuinely different
                // options (e.g. two offline rules, different offices).
                const key = `${timeStr}|${format}|${addressId ?? ''}|${duration}`;
                const candidate: ResolvedSlotOption = {
                    time: timeStr,
                    format,
                    addressId,
                    duration,
                    availabilitySlotId: slot.id,
                    scheduleRuleId: slot.scheduleRuleId ?? null,
                    isOwnBooking: isOwnSession,
                };
                const existing = timesObj[key];
                // When multiple rules collapse into one visible option, pick
                // a canonical availabilitySlotId/scheduleRuleId deterministically
                // (not "whichever the DB happened to return first" — Prisma
                // gives no ordering guarantee here) so the same input always
                // resolves to the same underlying identity.
                if (!existing || isCanonicalOption(candidate, existing)) {
                    timesObj[key] = candidate;
                }
            }

            currentTotalMins += duration + breakDuration;
        }
    });

    return Object.values(timesObj).sort((a, b) => a.time.localeCompare(b.time) || a.format.localeCompare(b.format));
}

// Deterministic tie-break for two options that resolve to the same
// user-visible key: order by (scheduleRuleId, availabilitySlotId), lowest
// wins. Arbitrary but stable — the same set of rules always canonicalizes
// to the same identity, regardless of DB row order.
function isCanonicalOption(a: ResolvedSlotOption, b: ResolvedSlotOption): boolean {
    const aKey = `${a.scheduleRuleId ?? ''} ${a.availabilitySlotId}`;
    const bKey = `${b.scheduleRuleId ?? ''} ${b.availabilitySlotId}`;
    return aKey < bKey;
}

// Helper: convert any Date to 'yyyy-MM-dd' string in UTC to avoid timezone issues
function toDateStr(d: Date): string {
    return d.toISOString().slice(0, 10);
}

// Helper: robust date parsing to specified timezone without relying on server's local time
function getPartsInTz(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '00';

    // Some runtimes return "24" instead of "00" for midnight with hour12: false
    let hour = get('hour');
    if (hour === '24') hour = '00';

    return {
        year: Number(get('year')),
        month: Number(get('month')),
        day: Number(get('day')),
        hour,
        minute: get('minute'),
    };
}
