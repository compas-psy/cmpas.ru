import { resolvePsychologistIdBySlug } from '@/lib/booking/slug';
import BookingPageClient from '@/app/bot/book/BookingPageClient';
import { NotFoundSpecialist } from '@/app/bot/book/NotFoundSpecialist';

/**
 * §5.1 (O-260829) — Cyrillic alias of /u/[slug]: /у/анна-волкова. Deliberate
 * Cyrillic "у" path segment so a human-friendly Russian URL typed or shared
 * directly also resolves (relevant e.g. for Max, which has no mini-app).
 * Same resolution and rendering as /u/[slug] — see that file for details.
 */
export default async function BookingBySlugCyrillicPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const psychologistId = await resolvePsychologistIdBySlug(decodeURIComponent(slug));

    if (!psychologistId) {
        return <NotFoundSpecialist />;
    }

    return <BookingPageClient psychologistId={psychologistId} />;
}
