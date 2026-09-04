'use client';

import { useEffect, useState } from 'react';
import { CalendarCheck, Copy, Eye, Lock } from 'lucide-react';
import { ShareButton } from '@/components/psidairy/ShareSheet';
import { humanizeUrl } from '@/lib/share/buildShareUrls';

export function BookingLinkCard({ psychologistId, isPrivate }: { psychologistId: string; isPrivate: boolean }) {
    // §5.1 (O-260829): human-readable /u/<slug> link instead of the raw id.
    // Starts on the old id-based URL (always valid) and swaps in the
    // slug-based one once resolved/lazily created — no loading flicker either way.
    const [bookingUrl, setBookingUrl] = useState(`https://cmpas.ru/bot/book/${psychologistId}`);

    useEffect(() => {
        let cancelled = false;
        import('../actions/booking-link').then(({ getMyBookingUrl }) => {
            getMyBookingUrl().then(url => { if (!cancelled) setBookingUrl(url); }).catch(() => { });
        });
        return () => { cancelled = true; };
    }, [psychologistId]);

    return (
        <div className={`bg-card border border-border rounded-2xl shadow-card p-5 ${isPrivate ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-2 mb-3">
                <CalendarCheck className="w-4 h-4 text-primary" />
                <div>
                    <h3 className="text-[14px] font-bold text-foreground">Ссылка на самозапись</h3>
                    <p className="text-[11px] text-muted-foreground">
                        {isPrivate ? 'Недоступна в приватном режиме' : 'Поделитесь ссылкой с клиентами'}
                    </p>
                </div>
            </div>
            {isPrivate ? (
                <div className="flex items-center gap-2 bg-muted/30 border border-border/50 rounded-xl px-3 py-2.5">
                    <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-[12px] text-muted-foreground">Включите режим «Просмотр» или «Запись» чтобы активировать ссылку</span>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-2 bg-sage-50 border border-sage-200 rounded-xl px-3 py-2.5">
                        <span className="flex-1 text-[13px] font-medium text-foreground truncate">{humanizeUrl(bookingUrl)}</span>
                    </div>
                    {/* Задача 18 §3: не отдельная «песочница», а та самая страница
                        записи, которую видит клиент. Открывается в новой вкладке,
                        чтобы не потерять несохранённые настройки расписания. */}
                    <a
                        href={bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-1.5 mt-3 px-3 py-2.5 rounded-xl text-[12px] font-bold bg-primary text-primary-foreground hover:bg-forest-700 transition-colors"
                    >
                        <Eye className="w-3.5 h-3.5" /> Посмотреть глазами клиента
                    </a>
                    <ShareButton
                        url={bookingUrl}
                        text="Запишитесь на сессию:"
                        icon={<Copy className="w-3.5 h-3.5" />}
                        className="w-full flex items-center justify-center gap-1.5 mt-2 px-3 py-2.5 rounded-xl text-[12px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    />
                </>
            )}
        </div>
    );
}
