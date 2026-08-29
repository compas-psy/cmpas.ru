'use server';

import { auth } from '@/auth';
import { getPsychologistBookingUrl } from '@/lib/booking/slug';

/**
 * §5.1 (O-260829) — human-readable `/u/<slug>` share link for the current
 * psychologist, assigning a slug on first use. Falls back to the old
 * `/bot/book/<id>` form if slug resolution fails for any reason.
 */
export async function getMyBookingUrl(): Promise<string> {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return getPsychologistBookingUrl(session.user.id);
}
