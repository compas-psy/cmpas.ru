import { resolvePsychologistIdBySlug } from '@/lib/booking/slug';
import BookingPageClient from '@/app/bot/book/BookingPageClient';
import { NotFoundSpecialist } from '@/app/bot/book/NotFoundSpecialist';

/**
 * §5.1 (O-260829) — human-readable Latin address for a specialist's booking
 * link: /u/anna-volkova instead of /bot/book/<cuid>. Resolves the slug
 * (current or a retired one — see resolvePsychologistIdBySlug) to a
 * psychologistId server-side, then renders the same booking flow as
 * /bot/book/[psychologistId], which keeps working unchanged for old links.
 */
export default async function BookingBySlugPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const psychologistId = await resolvePsychologistIdBySlug(decodeURIComponent(slug));

    if (!psychologistId) {
        return <NotFoundSpecialist />;
    }

    return <BookingPageClient psychologistId={psychologistId} />;
}
