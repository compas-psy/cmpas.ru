// Task 8 (founder review, UI regression fix) — the four regression cases
// the founder listed explicitly:
//   1. same time, online + offline → two distinct options
//   2. same time, two offices → two distinct options
//   3. format:'both' → online/offline both explicit, no silent default
//   4. "click option B → server gets token B" — covered at the component
//      level (RescheduleModal/RescheduleClient tests), not here: this file
//      only tests the pure expansion logic.

import { describe, it, expect } from 'vitest';
import { expandToConcreteSlotOptions, type RawTimeSlot } from '../concrete-slot-options';

function slot(overrides: Partial<RawTimeSlot> = {}): RawTimeSlot {
    return {
        time: '15:00',
        format: 'online',
        addressId: null,
        slotToken: 'slt1_online',
        slotTokenOnline: null,
        slotTokenOffline: null,
        ...overrides,
    };
}

describe('expandToConcreteSlotOptions', () => {
    it('same time, online + offline slots → two distinct options with distinct keys', () => {
        const options = expandToConcreteSlotOptions([
            slot({ format: 'online', slotToken: 'slt1_online' }),
            slot({ format: 'offline', addressId: 'addr-yauzskaya', slotToken: 'slt1_offline-yauzskaya' }),
        ]);

        expect(options).toHaveLength(2);
        expect(new Set(options.map((o) => o.key)).size).toBe(2);
        expect(options.find((o) => o.format === 'online')?.slotToken).toBe('slt1_online');
        expect(options.find((o) => o.format === 'offline')?.slotToken).toBe('slt1_offline-yauzskaya');
    });

    it('same time, two DIFFERENT offices → two distinct options, not collapsed', () => {
        const options = expandToConcreteSlotOptions([
            slot({ format: 'offline', addressId: 'addr-yauzskaya', slotToken: 'slt1_yauzskaya' }),
            slot({ format: 'offline', addressId: 'addr-other-office', slotToken: 'slt1_other-office' }),
        ]);

        expect(options).toHaveLength(2);
        expect(options.map((o) => o.addressId).sort()).toEqual(['addr-other-office', 'addr-yauzskaya']);
        expect(new Set(options.map((o) => o.key)).size).toBe(2);
    });

    it("format:'both' expands into an explicit online option AND an explicit offline option — never a silent default", () => {
        const options = expandToConcreteSlotOptions([
            slot({ format: 'both', addressId: 'addr-yauzskaya', slotToken: null, slotTokenOnline: 'slt1_both-online', slotTokenOffline: 'slt1_both-offline' }),
        ]);

        expect(options).toHaveLength(2);
        const online = options.find((o) => o.format === 'online')!;
        const offline = options.find((o) => o.format === 'offline')!;
        expect(online.slotToken).toBe('slt1_both-online');
        expect(online.addressId).toBeNull();
        expect(offline.slotToken).toBe('slt1_both-offline');
        expect(offline.addressId).toBe('addr-yauzskaya');
    });

    it('a slot with no usable token (grid raced ahead of a stale/expired token) is dropped rather than producing a dead option', () => {
        const options = expandToConcreteSlotOptions([
            slot({ format: 'online', slotToken: null }),
            slot({ format: 'both', slotTokenOnline: null, slotTokenOffline: null }),
        ]);
        expect(options).toHaveLength(0);
    });

    it('three same-time options (online + two offices) all stay distinct together', () => {
        const options = expandToConcreteSlotOptions([
            slot({ format: 'online', slotToken: 'slt1_a' }),
            slot({ format: 'offline', addressId: 'addr-1', slotToken: 'slt1_b' }),
            slot({ format: 'offline', addressId: 'addr-2', slotToken: 'slt1_c' }),
        ]);
        expect(options).toHaveLength(3);
        expect(new Set(options.map((o) => o.key)).size).toBe(3);
    });
});
