/** Same "специалист не найден" state BookingPageClient renders for an unknown
 * psychologistId — reused by the slug routes (/u/[slug], /у/[slug]) so an
 * unresolvable slug (typo, deleted account) reads identically instead of a
 * generic Next.js 404 page, since it's the same user-facing booking flow. */
export function NotFoundSpecialist() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen mobile-full-height bg-background p-4 text-center safe-top safe-bottom">
            <h2 className="text-xl font-bold mb-2 text-foreground">Специалист не найден</h2>
            <p className="text-muted-foreground text-sm">Проверьте ссылку и попробуйте еще раз.</p>
        </div>
    );
}
