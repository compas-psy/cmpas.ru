/** Same "специалист не найден" state BookingPageClient renders for an unknown
 * psychologistId — reused by the slug routes (/u/[slug], /у/[slug]) so an
 * unresolvable slug (typo, deleted account) reads identically instead of a
 * generic Next.js 404 page, since it's the same user-facing booking flow. */
export function NotFoundSpecialist() {
    return (
        <div className="practice-booking-theme flex flex-col items-center justify-center min-h-screen mobile-full-height p-4 text-center safe-top safe-bottom" style={{ background: 'var(--booking-paper)' }}>
            <div className="w-full max-w-sm rounded-[var(--booking-radius-card)] border p-6" style={{ background: 'var(--booking-card)', borderColor: 'var(--booking-line)' }}>
                <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--booking-ink)' }}>Специалист не найден</h2>
                <p className="text-sm" style={{ color: 'var(--booking-muted)' }}>Проверьте ссылку и попробуйте ещё раз.</p>
            </div>
        </div>
    );
}
