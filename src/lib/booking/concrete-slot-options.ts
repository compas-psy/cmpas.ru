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
}

export interface ConcreteSlotOption {
    /** Unique per option — the slotToken itself, safe as a React key and as the selected-state identity. */
    key: string;
    time: string;
    format: 'online' | 'offline';
    addressId: string | null;
    slotToken: string;
}

export function expandToConcreteSlotOptions(slots: RawTimeSlot[]): ConcreteSlotOption[] {
    const options: ConcreteSlotOption[] = [];

    for (const slot of slots) {
        if (slot.format === 'both') {
            // A format:'both' rule never resolves to one option — Task 7
            // mints a separate token per concrete choice, and both must
            // become their own visible option; never silently default to
            // online.
            if (slot.slotTokenOnline) {
                options.push({ key: slot.slotTokenOnline, time: slot.time, format: 'online', addressId: null, slotToken: slot.slotTokenOnline });
            }
            if (slot.slotTokenOffline) {
                options.push({ key: slot.slotTokenOffline, time: slot.time, format: 'offline', addressId: slot.addressId, slotToken: slot.slotTokenOffline });
            }
        } else if (slot.slotToken) {
            options.push({
                key: slot.slotToken,
                time: slot.time,
                format: slot.format === 'offline' ? 'offline' : 'online',
                addressId: slot.addressId,
                slotToken: slot.slotToken,
            });
        }
    }

    return options;
}
