'use server';

import { db } from '@/lib/db';
import { trackBookingFunnelStep } from '@/lib/analytics/booking-funnel';
import { BookingFunnelStep, BookingFunnelContext } from '@/lib/analytics/booking-funnel-types';

// Fire-and-forget from the client booking page: a failed analytics write
// must never block or error out the booking flow itself.
export async function trackBookingStep(
    psychologistId: string,
    step: BookingFunnelStep,
    context: BookingFunnelContext
): Promise<void> {
    await trackBookingFunnelStep(db, psychologistId, step, context).catch(e => {
        console.error('[analytics] booking funnel step failed:', e);
    });
}
