// Task 8 (founder review, UI regression fix): after Task 6, one clock time
// can carry several genuinely different bookable options — same time,
// different format, or same time/format but different office. Both
// RescheduleModal.tsx and RescheduleClient.tsx used to render one button per
// TIME and silently pick a token for it (defaulting to online, or to
// whichever office happened to be in the list first). This turns the raw
// per-time slot list (as returned by getAvailableTimes and its reschedule
// wrappers — one entry per AvailabilitySlot, carrying up to two tokens for a
// format:'both' rule) into one entry PER CONCRETE BOOKABLE TOKEN, so the UI
// can never conflate two different real options that happen to start at the
// same clock time.

export interface RawTimeSlot {
    time: string;
    format: string;
    addressId: string | null;
    slotToken: string | null;
    slotTokenOnline: string | null;
    slotTokenOffline: string | null;
    // Task 14: optional pass-through fields some callers (BookingPageClient's
    // full calendar, getSuggestedTimes) carry on the raw slot and want
    // preserved onto each expanded concrete option — never required, never
    // interpreted by the expansion itself.
    isOwnBooking?: boolean;
    availabilitySlotId?: string;
    scheduleRuleId?: string | null;
    duration?: number;
    /** Display label for addressId (e.g. "Яузская") — null for online. */
    addressName?: string | null;
}

export interface ConcreteSlotOption {
    /** Unique per option — the slotToken itself, safe as a React key and as the selected-state identity. */
    key: string;
    time: string;
    format: 'online' | 'offline';
    addressId: string | null;
    slotToken: string;
    isOwnBooking?: boolean;
    availabilitySlotId?: string;
    scheduleRuleId?: string | null;
    duration?: number;
    addressName?: string | null;
}

export function expandToConcreteSlotOptions(slots: RawTimeSlot[]): ConcreteSlotOption[] {
    const options: ConcreteSlotOption[] = [];

    for (const slot of slots) {
        const passthrough = {
            time: slot.time,
            isOwnBooking: slot.isOwnBooking,
            availabilitySlotId: slot.availabilitySlotId,
            scheduleRuleId: slot.scheduleRuleId,
            duration: slot.duration,
        };
        if (slot.format === 'both') {
            // A format:'both' rule never resolves to one option — Task 7
            // mints a separate token per concrete choice, and both must
            // become their own visible option; never silently default to
            // online.
            if (slot.slotTokenOnline) {
                options.push({ ...passthrough, key: slot.slotTokenOnline, format: 'online', addressId: null, slotToken: slot.slotTokenOnline, addressName: null });
            }
            if (slot.slotTokenOffline) {
                options.push({ ...passthrough, key: slot.slotTokenOffline, format: 'offline', addressId: slot.addressId, slotToken: slot.slotTokenOffline, addressName: slot.addressName ?? null });
            }
        } else if (slot.slotToken) {
            options.push({
                ...passthrough,
                key: slot.slotToken,
                format: slot.format === 'offline' ? 'offline' : 'online',
                addressId: slot.addressId,
                slotToken: slot.slotToken,
                addressName: slot.format === 'offline' ? (slot.addressName ?? null) : null,
            });
        }
    }

    return options;
}
