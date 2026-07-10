type SessionLike = {
    date: Date | string;
    time?: string | null;
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
