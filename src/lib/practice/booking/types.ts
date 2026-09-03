// Task 6 (PRAKTIKA MVP): shared shapes for the pure availability resolver in
// availability.ts. These mirror the Prisma rows the adapter (src/app/bot/
// actions.ts) fetches, but are plain interfaces so the resolver has zero
// dependency on Prisma/db — it only ever sees data already loaded by the
// caller.

export interface ScheduleRuleInput {
    id: string;
    format: string;
    addressId: string | null;
    duration: number;
    breakDuration: number;
    audienceFilter: string; // "all" | "new" | "regular"
    startDate: Date | null;
    endDate: Date | null;
}

export interface AvailabilitySlotInput {
    id: string;
    dayOfWeek: number; // 0=Mon ... 6=Sun
    startTime: string; // "HH:MM"
    endTime: string; // "HH:MM"
    duration: number | null;
    format: string | null;
    addressId: string | null;
    startDate: Date | null;
    endDate: Date | null;
    scheduleRuleId: string | null;
    scheduleRule: ScheduleRuleInput | null;
}

export interface BlockInput {
    date: Date;
    startTime: string;
    endTime: string;
}

export interface BookedSessionInput {
    date: Date;
    time: string;
    duration: number | null;
    clientId: string | null;
}

export interface DayResolverSettings {
    timezone?: string | null;
    bookingBufferHours?: number | null;
    bookingHorizonDays?: number | null;
    maxSessionsPerDay?: number | null;
    sessionBreak?: number | null;
}

export interface ResolveDayParams {
    dateStr: string; // "YYYY-MM-DD"
    slots: AvailabilitySlotInput[];
    blocks: BlockInput[];
    sessions: BookedSessionInput[];
    settings: DayResolverSettings | null;
    clientId?: string | null;
    skipBuffer?: boolean;
    /** Injected for deterministic tests; defaults to `new Date()`. */
    now?: Date;
}

export interface ResolvedSlotOption {
    time: string; // "HH:MM"
    format: string;
    addressId: string | null;
    duration: number;
    availabilitySlotId: string;
    scheduleRuleId: string | null;
    isOwnBooking: boolean;
}
