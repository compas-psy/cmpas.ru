'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, MapPin, Video, Calendar, Clock, X, Shield } from 'lucide-react';
import { toast } from 'sonner';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ru } from 'date-fns/locale/ru';
import { format } from 'date-fns';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import 'react-datepicker/dist/react-datepicker.css';
import {
    getPsychologist,
    getAvailableDates,
    getAvailableTimes,
    bookSession,
    getClientByTelegram,
    getScheduleMode,
    getClientUpcomingSessions,
    getAddressById,
    checkConsentRequired,
    saveConsent
} from '../../actions';
import { trackBookingStep } from '../../analytics-actions';
import { BookingChannel, BookingLinkType, BookingFunnelStep } from '@/lib/analytics/booking-funnel-types';

registerLocale('ru', ru);

export default function ClientBookingPage() {
    const params = useParams();
    const psychologistId = params.psychologistId as string;

    // Extract clientId manually inside the init function to avoid race conditions.
    const [clientId, setClientId] = useState<string | null>(null);

    const router = useRouter();
    const [tgUser, setTgUser] = useState<any>(null);
    const [psy, setPsy] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Client state
    const [isKnownClient, setIsKnownClient] = useState(false);
    const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);

    // Booking state
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    type TimeSlot = { time: string, format: string, addressId: string | null, isOwnBooking?: boolean };
    const [availableTimes, setAvailableTimes] = useState<TimeSlot[]>([]);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
    const [selectedFormat, setSelectedFormat] = useState<'online' | 'offline' | null>(null);
    const [form, setForm] = useState({ name: '', phone: '' });
    const [booking, setBooking] = useState(false);

    // Consent state
    const [consentRequired, setConsentRequired] = useState(false);
    const [consentText, setConsentText] = useState('');
    const [consentVersion, setConsentVersionState] = useState('');
    const [showConsentModal, setShowConsentModal] = useState(false);
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [consentSaving, setConsentSaving] = useState(false);

    // Success state
    const [bookingSuccess, setBookingSuccess] = useState<{
        date: string;
        time: string;
        format: string;
        psyName: string;
        addressName?: string | null;
        addressFull?: string | null;
        onlineLink?: string | null;
    } | null>(null);

    // Auto-navigate to first available month
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [scheduleMode, setScheduleMode] = useState<string>('booking');

    // Booking funnel analytics (O-260817-11) — channel/link type are fixed
    // for the whole visit, resolved once the page mounts; each step fires
    // at most once per visit.
    const funnelContextRef = useRef<{ channel: BookingChannel; linkType: BookingLinkType } | null>(null);
    const trackedStepsRef = useRef<Set<string>>(new Set());
    const trackStep = useCallback((step: BookingFunnelStep, knownClient: boolean) => {
        const ctx = funnelContextRef.current;
        if (!ctx || trackedStepsRef.current.has(step)) return;
        trackedStepsRef.current.add(step);
        trackBookingStep(psychologistId, step, { channel: ctx.channel, linkType: ctx.linkType, knownClient });
    }, [psychologistId]);

    // Fetch initial data
    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const channel: BookingChannel = tg ? 'telegram' : urlParams?.get('via') === 'max' ? 'max' : 'browser';
        const linkType: BookingLinkType = urlParams?.get('c') ? 'personal' : 'general';
        funnelContextRef.current = { channel, linkType };
        if (tg) {
            tg.ready();
            tg.expand();
            tg.setHeaderColor?.('#f5f5f5');
            tg.setBackgroundColor?.('#f5f5f5');

            if (tg.initDataUnsafe?.user) {
                setTgUser(tg.initDataUnsafe.user);
            }
        }

        const init = async () => {
            if (!psychologistId) return;

            try {
                const user = await getPsychologist(psychologistId);
                setPsy(user);

                // Get schedule mode
                if (user?.scheduleMode) {
                    setScheduleMode(user.scheduleMode);
                }

                // If private mode, don't load dates
                if (user?.scheduleMode === 'private') {
                    trackStep('booking_link_opened', false);
                    setLoading(false);
                    return;
                }

                // Extract c param synchronously or read from localStorage
                let currentClientId: string | undefined = undefined;
                if (typeof window !== 'undefined') {
                    const urlParams = new URLSearchParams(window.location.search);
                    const c = urlParams.get('c');
                    if (c) {
                        currentClientId = c;
                        setClientId(c);
                    } else {
                        const savedClientId = localStorage.getItem('compas_clientId');
                        if (savedClientId) {
                            currentClientId = savedClientId;
                            setClientId(savedClientId);
                        }
                    }
                }

                // Fetch dates for current and next 3 months to find first available
                const now = new Date();
                let allDates: string[] = [];
                for (let i = 0; i < 4; i++) {
                    const m = (now.getMonth() + i) % 12;
                    const y = now.getFullYear() + Math.floor((now.getMonth() + i) / 12);
                    const d = await getAvailableDates(psychologistId, y, m, false, currentClientId || null);
                    allDates = [...allDates, ...d];
                }
                setAvailableDates(allDates);

                // Auto-navigate to first month with available dates
                if (allDates.length > 0) {
                    const firstDate = new Date(allDates[0] + 'T00:00:00');
                    setStartDate(firstDate);
                }

                // Pre-fill client data if returning
                const tgUserId = tg?.initDataUnsafe?.user?.id;

                if (tgUserId && user) {
                    try {
                        const client = await getClientByTelegram(psychologistId, String(tgUserId), currentClientId);
                        if (client) {
                            setIsKnownClient(true);
                            setForm({
                                name: client.name || tg?.initDataUnsafe?.user?.first_name || '',
                                phone: client.phone || ''
                            });

                            // Load upcoming sessions for known client
                            const sessions = await getClientUpcomingSessions(psychologistId, String(tgUserId));
                            setUpcomingSessions(sessions);
                        } else {
                            setForm(f => ({ ...f, name: tg?.initDataUnsafe?.user?.first_name || '' }));
                        }

                        // Check consent requirement
                        const consent = await checkConsentRequired(String(tgUserId), psychologistId);
                        setConsentRequired(consent.required);
                        setConsentText(consent.text);
                        setConsentVersionState(consent.version);
                        trackStep('booking_link_opened', !!client);
                    } catch {
                        setForm(f => ({ ...f, name: tg?.initDataUnsafe?.user?.first_name || '' }));
                        trackStep('booking_link_opened', false);
                    }
                } else if (currentClientId && user) {
                    // Client loaded from URL, but without Telegram context (e.g. opened in browser)
                    try {
                        // Import dynamically to avoid top-level issues if needed, but it's already in actions
                        const { getClientById, getClientUpcomingSessionsById } = await import('../../actions');
                        const client = await getClientById(psychologistId, currentClientId);

                        if (client) {
                            setIsKnownClient(true);
                            setForm({
                                name: client.name || '',
                                phone: client.phone || ''
                            });

                            // Load upcoming sessions for known client
                            const sessions = await getClientUpcomingSessionsById(psychologistId, currentClientId);
                            setUpcomingSessions(sessions);
                        }

                        // Treat as needing consent check
                        const consent = await checkConsentRequired('', psychologistId);
                        setConsentRequired((client as any)?.consentVersion ? false : consent.required);
                        setConsentText(consent.text);
                        setConsentVersionState(consent.version);
                        trackStep('booking_link_opened', !!client);
                    } catch (e) {
                        console.error(e);
                        trackStep('booking_link_opened', false);
                    }
                } else {
                    // Unknown client without TG and without client ID
                    try {
                        const consent = await checkConsentRequired('', psychologistId);
                        setConsentRequired(true);
                        setConsentText(consent.text);
                        setConsentVersionState(consent.version);
                    } catch { }
                    trackStep('booking_link_opened', false);
                }
            } catch (err) {
                toast.error('Не удалось загрузить данные специалиста');
            } finally {
                setLoading(false);
            }
        };

        if (psychologistId) {
            init();
        }
    }, [psychologistId, trackStep]);

    // Handle Date selection and fetch times
    const handleDateChange = async (date: Date | null) => {
        if (!date) return;

        setSelectedDate(date);
        setSelectedTimeSlot(null);
        setSelectedFormat(null);
        setAvailableTimes([]);

        const dateStr = format(date, 'yyyy-MM-dd');
        try {
            const times = await getAvailableTimes(psychologistId, dateStr, false, undefined, clientId || null);
            setAvailableTimes(times);
        } catch (e) {
            toast.error('Ошибка при загрузке времени');
        }
    };

    // Handle month change in DatePicker — fetch dates for new month
    const handleMonthChange = async (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        const hasMonth = availableDates.some(d => d.startsWith(monthPrefix));
        if (!hasMonth) {
            const newDates = await getAvailableDates(psychologistId, year, month, false, clientId || null);
            setAvailableDates(prev => [...prev, ...newDates]);
        }
    };

    const handleTimeSlotSelect = (slot: TimeSlot) => {
        setSelectedTimeSlot(slot);
        if (slot.format === 'both') {
            setSelectedFormat(null);
        } else {
            setSelectedFormat(slot.format as 'online' | 'offline');
        }
        trackStep('booking_time_selected', isKnownClient);
    };

    const handleBookingAttempt = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !selectedTimeSlot || !selectedFormat) {
            toast.error('Выберите дату, время и формат встречи');
            return;
        }
        if (!form.phone || form.phone.length < 10) {
            toast.error('Введите корректный номер телефона');
            return;
        }

        // If consent is required, show modal first
        if (consentRequired && !consentAccepted) {
            setShowConsentModal(true);
            trackStep('booking_consent_shown', isKnownClient);
            return;
        }

        await performBooking();
    };

    const handleConsentAccept = async () => {
        if (!consentAccepted) {
            toast.error('Необходимо принять согласие');
            return;
        }

        setConsentSaving(true);
        try {
            const tgUserId = tgUser?.id ? String(tgUser.id) : '';
            await saveConsent(psychologistId, tgUserId, consentVersion);
            setConsentRequired(false);
            setShowConsentModal(false);
            await performBooking();
        } catch (e) {
            toast.error('Ошибка при сохранении согласия');
        } finally {
            setConsentSaving(false);
        }
    };

    const performBooking = async () => {
        if (!selectedDate || !selectedTimeSlot || !selectedFormat) return;

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        setBooking(true);

        try {
            const res = await bookSession(psychologistId, tgUser, {
                ...form,
                date: dateStr,
                time: selectedTimeSlot.time,
                format: selectedFormat,
                addressId: selectedFormat === 'offline' ? selectedTimeSlot.addressId : null
            });

            if (res && !res.success) {
                toast.error(res.error || 'Произошла ошибка при записи');
                setBooking(false);
                return;
            }

            // Save clientId to local storage for persistent identification
            if (res && res.clientId && typeof window !== 'undefined') {
                localStorage.setItem('compas_clientId', res.clientId);
            }

            trackStep('booking_completed', isKnownClient);

            // Get address details for success screen
            let addressName: string | null = null;
            let addressFull: string | null = null;
            if (selectedFormat === 'offline' && selectedTimeSlot.addressId) {
                const addr = await getAddressById(selectedTimeSlot.addressId);
                if (addr) {
                    addressName = addr.name;
                    addressFull = addr.address;
                }
            }

            // Show success screen
            const dayOfWeek = selectedDate.toLocaleDateString('ru-RU', { weekday: 'long' });
            const formattedDate = selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            setBookingSuccess({
                date: `${dayOfWeek}, ${formattedDate}`,
                time: selectedTimeSlot.time,
                format: selectedFormat,
                psyName: psy?.name || 'Специалист',
                addressName,
                addressFull,
                onlineLink: psy?.psychologistSettings?.onlineSessionLink || null
            });
        } catch (e: any) {
            toast.error(e?.message || 'Ошибка записи');
        }
        setBooking(false);
    };

    const isDateAvailable = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return availableDates.includes(dateStr);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen mobile-full-height bg-background safe-top safe-bottom">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    if (!psy) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen mobile-full-height bg-background p-4 text-center safe-top safe-bottom">
                <h2 className="text-xl font-bold mb-2 text-foreground">Специалист не найден</h2>
                <p className="text-muted-foreground text-sm">Проверьте ссылку и попробуйте еще раз.</p>
            </div>
        );
    }

    // Private mode — booking closed
    if (scheduleMode === 'private') {
        return (
            <div className="min-h-screen mobile-full-height bg-background text-foreground pb-12 safe-top safe-bottom telegram-miniapp-scrollbar-hide">
                <div className="p-4 max-w-md mx-auto flex flex-col items-center justify-center min-h-screen">
                    <div className="bg-card border border-border rounded-3xl p-8 shadow-sm w-full text-center">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-5">
                            <span className="text-3xl">🔒</span>
                        </div>
                        <h2 className="text-xl font-bold mb-2 text-foreground">Запись закрыта</h2>
                        <p className="text-muted-foreground text-sm">Специалист пока не принимает запись онлайн. Попробуйте позже или свяжитесь напрямую.</p>
                        <button
                            onClick={() => { const tg = (window as any).Telegram?.WebApp; if (tg) tg.close(); else window.location.href = '/'; }}
                            className="w-full mt-6 py-3.5 rounded-xl border-2 border-[#1e3a2f] text-white bg-[#1e3a2f] dark:border-[#b89a4e] dark:text-gray-900 dark:bg-[#b89a4e] font-bold text-base transition-all min-h-[44px] haptic-light hover:opacity-90 shadow-sm active:scale-[0.98]"
                        >
                            Назад
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Success screen
    if (bookingSuccess) {
        return (
            <div className="min-h-screen mobile-full-height bg-background text-foreground pb-12 safe-top safe-bottom telegram-miniapp-scrollbar-hide">
                <div className="p-4 max-w-md mx-auto flex flex-col items-center justify-center min-h-screen">
                    <div className="bg-card border border-border rounded-3xl p-8 shadow-sm w-full text-center animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2 text-foreground">Вы записаны!</h2>
                        <p className="text-muted-foreground text-sm mb-6">Уведомление придёт в Telegram</p>

                        <div className="bg-muted/30 rounded-2xl p-5 text-left space-y-3 border border-border/50">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Специалист</p>
                                <p className="font-bold text-foreground">{bookingSuccess.psyName}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Дата и время</p>
                                <p className="font-bold text-foreground">{bookingSuccess.time}, {bookingSuccess.date}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Формат</p>
                                <p className="font-bold text-foreground flex items-center gap-1.5">
                                    {bookingSuccess.format === 'online' ? (
                                        <><Video className="w-4 h-4 text-primary" /> Онлайн</>
                                    ) : (
                                        <><MapPin className="w-4 h-4 text-primary" /> В кабинете</>
                                    )}
                                </p>
                            </div>
                            {/* Issue #5: Show address if offline */}
                            {bookingSuccess.format === 'offline' && bookingSuccess.addressFull && (
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Адрес</p>
                                    <p className="font-bold text-foreground flex items-center gap-1.5">
                                        <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                                        {bookingSuccess.addressName ? `${bookingSuccess.addressName}: ` : ''}{bookingSuccess.addressFull}
                                    </p>
                                </div>
                            )}
                            {bookingSuccess.format === 'online' && bookingSuccess.onlineLink && (
                                <div className="mt-2">
                                    <p className="text-xs font-medium text-muted-foreground">Ссылка на переговорку</p>
                                    <a href={bookingSuccess.onlineLink} target="_blank" rel="noopener noreferrer" className="font-bold text-primary hover:underline flex items-center gap-1.5 break-all mt-0.5">
                                        {bookingSuccess.onlineLink}
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Issue #6: Navigate to client calendar instead of closing */}
                        <button
                            onClick={() => {
                                window.location.href = '/bot/client';
                            }}
                            className="w-full mt-6 py-3.5 rounded-xl border-2 border-[#1e3a2f] text-white bg-[#1e3a2f] dark:border-[#b89a4e] dark:text-gray-900 dark:bg-[#b89a4e] font-bold text-base transition-all min-h-[44px] haptic-light hover:opacity-90 shadow-sm active:scale-[0.98]"
                        >
                            Готово
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen mobile-full-height bg-background text-foreground pb-12 safe-top safe-bottom telegram-miniapp-scrollbar-hide">
            <div className="p-4 max-w-md mx-auto">
                <h1 className="text-3xl font-bold tracking-tight mb-1">Запись на сессию</h1>
                <p className="text-primary font-semibold text-sm mb-1">Специалист — {psy.name}</p>
                <p className="text-muted-foreground mb-6 text-sm">
                    Выберите удобную дату и время.
                </p>

                {/* Issue #2: Upcoming sessions for known client */}
                {isKnownClient && upcomingSessions.length > 0 && (
                    <div className="mb-6 bg-card p-4 rounded-2xl border border-border shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                        <h3 className="font-medium mb-3 text-foreground flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            Ваши предстоящие записи
                        </h3>
                        <div className="space-y-2">
                            {upcomingSessions.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => window.location.href = `/bot/client?c=${clientId || ''}`}
                                    className="w-full text-left flex items-center gap-3 p-2.5 bg-muted/30 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors active:scale-[0.98]"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-foreground">
                                            {format(new Date(s.date), 'd MMM', { locale: ru })} в {s.time}
                                        </p>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            {s.format === 'offline' ? (
                                                <><MapPin className="w-3 h-3" /> {s.addressName || 'В кабинете'}</>
                                            ) : (
                                                <><Video className="w-3 h-3" /> Онлайн</>
                                            )}
                                        </p>
                                    </div>
                                    <span className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium flex-shrink-0">
                                        {s.status === 'confirmed' ? 'Подтв.' : 'Ожид.'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Calendar */}
                <div className="mb-6">
                    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm p-2 flex justify-center">
                        <DatePicker
                            inline
                            locale="ru"
                            selected={selectedDate}
                            onChange={handleDateChange}
                            onMonthChange={handleMonthChange}
                            minDate={new Date()}
                            openToDate={startDate || undefined}
                            filterDate={isDateAvailable}
                            calendarClassName="!border-none !font-sans !bg-transparent"
                            dayClassName={(date) => {
                                const isAvail = isDateAvailable(date);
                                const isSelected = selectedDate && date.getTime() === selectedDate.getTime();
                                if (isSelected) return "!bg-transparent !border-2 !border-[#1e3a2f] dark:!border-[#b89a4e] !text-[#1e3a2f] dark:!text-[#b89a4e] !rounded-[12px] !font-medium";
                                if (isAvail) return "!text-foreground !bg-transparent !border-2 !border-transparent hover:!border-[#1e3a2f]/50 dark:hover:!border-[#b89a4e]/50 !font-medium !rounded-[12px] transition-colors";
                                return "!text-muted-foreground !opacity-40 !font-normal !bg-transparent !border-2 !border-transparent !rounded-[12px]";
                            }}
                            monthClassName={() => "!text-foreground !font-medium"}
                            weekDayClassName={() => "!text-muted-foreground !font-medium !text-xs"}
                        />
                    </div>
                </div>

                {/* Time selection */}
                {selectedDate && (
                    <div className="mb-6 bg-card p-4 rounded-2xl border border-border shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                        <h3 className="font-medium mb-3 text-foreground">Свободное время:</h3>
                        {availableTimes.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center py-4">Нет свободного времени на эту дату</p>
                        ) : (
                            <div className="grid grid-cols-4 gap-2">
                                {availableTimes.map(slot => {
                                    if (slot.isOwnBooking) {
                                        return (
                                            <div
                                                key={`${slot.time}-${slot.format}-own`}
                                                className="py-2 px-1 text-center rounded-xl border-2 font-bold text-sm min-h-[44px] flex flex-col items-center justify-center border-primary/40 bg-primary/10 text-primary"
                                                onClick={() => toast.info('Это ваше забронированное время')}
                                            >
                                                <span>{slot.time}</span>
                                                <span className="text-[9px] leading-tight opacity-80 uppercase tracking-wider mt-0.5">Ваше</span>
                                            </div>
                                        );
                                    }
                                    return (
                                        <button
                                            key={`${slot.time}-${slot.format}`}
                                            type="button"
                                            onClick={() => handleTimeSlotSelect(slot)}
                                            className={`py-2 rounded-xl border-2 font-medium transition-colors text-sm min-h-[44px] haptic-light ${selectedTimeSlot?.time === slot.time && selectedTimeSlot?.format === slot.format
                                                ? 'border-[#1e3a2f] text-white dark:border-[#b89a4e] dark:text-gray-900 bg-[#1e3a2f] dark:bg-[#b89a4e] shadow-sm'
                                                : 'border-[#1e3a2f] text-[#1e3a2f] hover:bg-[#1e3a2f]/10 dark:border-[#b89a4e] dark:text-[#b89a4e] dark:hover:bg-[#b89a4e]/10 bg-transparent'
                                                }`}
                                        >
                                            {slot.time}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Format selection — only for hybrid slots */}
                        {selectedTimeSlot?.format === 'both' && (
                            <div className="mt-4 pt-4 border-t border-border/50 animate-in fade-in duration-200">
                                <label className="block text-sm font-medium mb-3 text-foreground">Формат проведения <span className="text-destructive">*</span></label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedFormat('online')}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors min-h-[44px] haptic-light ${selectedFormat === 'online' ? 'border-[#1e3a2f] text-white dark:border-[#b89a4e] dark:text-gray-900 bg-[#1e3a2f] dark:bg-[#b89a4e] shadow-sm' : 'border-[#1e3a2f] text-[#1e3a2f] hover:bg-[#1e3a2f]/10 dark:border-[#b89a4e] dark:text-[#b89a4e] dark:hover:bg-[#b89a4e]/10 bg-transparent'}`}
                                    >💻 Онлайн</button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedFormat('offline')}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors min-h-[44px] haptic-light ${selectedFormat === 'offline' ? 'border-[#1e3a2f] text-white dark:border-[#b89a4e] dark:text-gray-900 bg-[#1e3a2f] dark:bg-[#b89a4e] shadow-sm' : 'border-[#1e3a2f] text-[#1e3a2f] hover:bg-[#1e3a2f]/10 dark:border-[#b89a4e] dark:text-[#b89a4e] dark:hover:bg-[#b89a4e]/10 bg-transparent'}`}
                                    >🏠 В кабинете</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <form onSubmit={handleBookingAttempt} className="space-y-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-foreground">Имя</label>
                        <input
                            type="text"
                            required
                            value={form.name}
                            onChange={e => { setForm(f => ({ ...f, name: e.target.value })); trackStep('booking_form_started', isKnownClient); }}
                            className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 bg-background text-foreground transition-all"
                            placeholder="Ваше имя"
                            readOnly={isKnownClient}
                        />
                        {isKnownClient && (
                            <p className="text-xs text-primary mt-1.5 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Данные заполнены автоматически
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-foreground">Телефон</label>
                        <PhoneInput
                            country={'ru'}
                            value={form.phone}
                            onChange={phone => { setForm(f => ({ ...f, phone })); trackStep('booking_form_started', isKnownClient); }}
                            inputProps={{
                                required: true,
                            }}
                            containerClass="!w-full"
                            inputClass="!w-full !px-4 !py-3 !pl-12 !h-auto !text-base !border-border !rounded-xl focus:!ring-2 focus:!ring-ring/50 !bg-background !text-foreground !transition-all"
                            buttonClass="!bg-background !border-border !rounded-l-xl focus:!ring-ring/50 hover:!bg-muted"
                            dropdownClass="!bg-card !text-foreground !border !border-border !rounded-xl !shadow-lg"
                            disabled={isKnownClient && !!form.phone}
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                            Телефон нужен для связи. Уведомление о сессии придет в Telegram.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={!selectedDate || !selectedTimeSlot || !selectedFormat || booking || scheduleMode === 'readonly'}
                        className={`w-full py-3.5 rounded-xl border-2 font-bold text-base transition-all min-h-[44px] haptic-light mt-4 ${!selectedDate || !selectedTimeSlot || !selectedFormat || booking || scheduleMode === 'readonly'
                            ? 'border-[#1e3a2f] text-[#1e3a2f] dark:border-[#b89a4e] dark:text-[#b89a4e] bg-transparent cursor-not-allowed opacity-40'
                            : 'border-[#1e3a2f] text-white dark:border-[#b89a4e] dark:text-gray-900 bg-[#1e3a2f] dark:bg-[#b89a4e] hover:opacity-90 shadow-sm active:scale-[0.98]'
                            }`}
                    >
                        {booking ? <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> : null}
                        {scheduleMode === 'readonly' ? 'Только просмотр' : booking ? 'Оформление...' : 'Записаться'}
                    </button>
                    {scheduleMode === 'readonly' && (
                        <p className="text-xs text-center text-muted-foreground mt-2">
                            Специалист пока принимает запись только лично. Вы можете посмотреть свободные окна и связаться напрямую.
                        </p>
                    )}

                    {/* Issue #4: Consent notice for unknown clients */}
                    {consentRequired && (
                        <p className="text-xs text-center text-muted-foreground mt-3 leading-relaxed">
                            Нажимая кнопку «Записаться», вы принимаете условия{' '}
                            <button
                                type="button"
                                onClick={() => { setShowConsentModal(true); trackStep('booking_consent_shown', isKnownClient); }}
                                className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                            >
                                согласия на обработку персональных данных
                            </button>
                        </p>
                    )}
                </form>

                {/* Consent Modal */}
                {showConsentModal && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
                        <div className="bg-card rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col border border-border shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
                            {/* Header */}
                            <div className="px-6 pt-6 pb-4 border-b border-border/50 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-primary" />
                                    <h3 className="text-lg font-bold text-foreground">Согласие на обработку ПДн</h3>
                                </div>
                                <button
                                    onClick={() => setShowConsentModal(false)}
                                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                                >
                                    <X className="w-5 h-5 text-muted-foreground" />
                                </button>
                            </div>

                            {/* Consent text */}
                            <div className="px-6 py-4 overflow-y-auto flex-1 custom-scrollbar">
                                <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                    {consentText}
                                </div>
                            </div>

                            {/* Accept section */}
                            <div className="px-6 py-4 border-t border-border/50 flex-shrink-0 space-y-4">
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={consentAccepted}
                                        onChange={e => setConsentAccepted(e.target.checked)}
                                    />
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 mt-0.5 ${consentAccepted
                                        ? 'bg-[#1e3a2f] border-[#1e3a2f] dark:bg-[#b89a4e] dark:border-[#b89a4e]'
                                        : 'border-border group-hover:border-[#1e3a2f]/50 dark:group-hover:border-[#b89a4e]/50'
                                        }`}>
                                        {consentAccepted && (
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        )}
                                    </div>
                                    <span className="text-sm text-foreground leading-snug">
                                        Я даю <a href="/legal/privacy" target="_blank" className="text-primary hover:underline" onClick={e => e.stopPropagation()}>согласие</a> на обработку моих персональных данных
                                    </span>
                                </label>

                                <button
                                    onClick={handleConsentAccept}
                                    disabled={!consentAccepted || consentSaving}
                                    className={`w-full py-3.5 rounded-xl border-2 font-bold text-base transition-all min-h-[44px] haptic-light ${!consentAccepted || consentSaving
                                        ? 'border-[#1e3a2f] text-[#1e3a2f] dark:border-[#b89a4e] dark:text-[#b89a4e] bg-transparent cursor-not-allowed opacity-40'
                                        : 'border-[#1e3a2f] text-white dark:border-[#b89a4e] dark:text-gray-900 bg-[#1e3a2f] dark:bg-[#b89a4e] hover:opacity-90 shadow-sm active:scale-[0.98]'
                                        }`}
                                >
                                    {consentSaving ? <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> : null}
                                    {consentSaving ? 'Сохранение...' : 'Подтвердить и записаться'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <style dangerouslySetInnerHTML={{
                    __html: `
                    .react-datepicker { font-family: inherit; border: none; }
                    .react-datepicker__header { background: transparent; border-bottom: none; padding-top: 1rem; }
                    .react-datepicker__day--selected { 
                        background-color: transparent !important; 
                        border: 2px solid #1e3a2f !important; 
                        border-radius: 12px !important; 
                        color: #1e3a2f !important;
                    }
                    @media (prefers-color-scheme: dark) {
                        .react-datepicker__day--selected { 
                            border: 2px solid #b89a4e !important; 
                            color: #b89a4e !important;
                        }
                    }
                    .react-datepicker__day:hover { border-radius: 12px; }
                    .react-datepicker__day--disabled { opacity: 0.3; }
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 4px; }
                `}} />
            </div >
        </div >
    );
}
