type SessionLike = {
    date: Date | string;
    time?: string | null;
    duration?: number | null;
};

type CancellationSettingsLike = {
    cancellationHours?: number | null;
} | null | undefined;

function sessionStartAt(session: SessionLike) {
    const datePart = session.date instanceof Date
        ? session.date.toISOString().split('T')[0]
        : String(session.date).split('T')[0];
    const timePart = session.time || '00:00';
    return new Date(`${datePart}T${timePart}:00`);
}

export function clientCancellationLimitHours(settings: CancellationSettingsLike) {
    const raw = settings?.cancellationHours;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return 24;
    return Math.max(0, Math.floor(raw));
}

export function canClientCancel(session: SessionLike, settings: CancellationSettingsLike, now = new Date()) {
    const limitHours = clientCancellationLimitHours(settings);
    if (limitHours === 0) return { allowed: true, limitHours };

    const startsAt = sessionStartAt(session);
    const diffMs = startsAt.getTime() - now.getTime();
    const requiredMs = limitHours * 60 * 60 * 1000;

    return { allowed: diffMs >= requiredMs, limitHours };
}

export function clientCancelBlockedMessage(limitHours: number) {
    return `До сессии меньше ${limitHours} ч. — отмена уже не доступна онлайн. Если будет удобно, напишите специалисту напрямую.`;
}

/**
 * CJM_booking_v1.md §1.3: "ссылка на перенос живёт до конца сессии и после
 * этого мертва". A confirm/cancel link found in an old notification shouldn't
 * still work once the session it points to is long over.
 */
export function isClientLinkExpired(session: SessionLike, now = new Date()) {
    const startsAt = sessionStartAt(session);
    const durationMinutes = session.duration ?? 50;
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
    return now.getTime() > endsAt.getTime();
}
