'use client';

import { useParams } from 'next/navigation';
import BookingPageClient from '../BookingPageClient';

// Legacy id-based booking link (already-sent links, Telegram mini-app deep
// links) — must keep working unchanged. §5.1 (O-260829): the actual booking
// flow now lives in BookingPageClient, shared with the new human-readable
// /u/<slug> and /у/<slug> routes so the ~900 lines of logic aren't duplicated.
export default function ClientBookingPage() {
    const params = useParams();
    const psychologistId = params.psychologistId as string;
    return <BookingPageClient psychologistId={psychologistId} />;
}
