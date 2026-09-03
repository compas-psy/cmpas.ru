'use client';

import { useEffect, useState } from 'react';
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
    getSuggestedTimes,
    submitWaitlistInterest,
    bookSession,
    getClientByTelegram,
    getScheduleMode,
    getClientUpcomingSessions,
    getAddressById,
    checkConsentRequired,
    saveConsent,
    resolveSignedClientLinkParam,
    resolveVerifiedTelegramUserId
} from '../actions';
import type { TimePreference, SuggestedTimeCandidate } from '@/lib/booking/suggested-times';
import { NotFoundSpecialist } from './NotFoundSpecialist';

registerLocale('ru', ru);

// O-260829 §5.3 "Возврат по ссылке без брони" (S1-R): клиентская сторона
// only — визит на страницу записи сам по себе чувствителен (кто, когда,
// к какому специалисту заходил), поэтому никакого серверного хранения нет,
// только localStorage этого устройства. 30 дней — тот же срок, что и у
// подписанного личного токена клиента (PERSONAL_LINK_TTL_MS,
// src/lib/client-workflow.ts), не для согласованности схем, а потому что
// это тот же порядок давности, за которым "недавний интерес" перестаёт быть
// актуальным.
const RETURN_PREFERENCE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const PREFERENCE_LABELS: Record<TimePreference, string> = {
    weekday_evening: 'Будни, после 18:00',
    weekend_morning: 'Утро выходных',
    any: 'Ближайшее время',
};

function bookingPrefStorageKey(psychologistId: string) {
    return `booking_pref_${psychologistId}`;
}

function readSavedPreference(psychologistId: string): TimePreference | null {
    try {
        const raw = localStorage.getItem(bookingPrefStorageKey(psychologistId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { preference?: TimePreference; savedAt?: number };
        if (!parsed?.preference || !parsed?.savedAt) return null;
        if (Date.now() - parsed.savedAt > RETURN_PREFERENCE_TTL_MS) {
            localStorage.removeItem(bookingPrefStorageKey(psychologistId));
            return null;
        }
        return parsed.preference;
    } catch {
        // Повреждённая запись — ведём себя как при первом визите, а не падаем.
        return null;
    }
}

// Extracted from src/app/bot/book/[psychologistId]/page.tsx (§5.1, O-260829)
// so that the human-readable slug routes (/u/<slug>, /у/<slug>) and the
// legacy /bot/book/<id> route render the exact same booking flow without
// duplicating ~900 lines of logic. The id route reads psychologistId via
// useParams() and passes it in; the slug routes resolve the slug to an id
// server-side first. Nothing about the booking flow itself changed here.
export default function BookingPageClient({ psychologistId }: { psychologistId: string }) {
    // Extract clientId manually inside the init function to avoid race conditions.
    const [clientId, setClientId] = useState<string | null>(null);
    // The raw signed token itself (not the id it decodes to) — the only thing
    // safe to persist in localStorage or hand back to the browser for
    // "manage my bookings" links. Task 3 (addendum §6): a raw clientId is
    // never proof of identity; only a signature this server issued is.
    const [clientLinkToken, setClientLinkToken] = useState<string | null>(null);

    // Task 3 (PRAKTIKA MVP addendum §6): initDataUnsafe.user.id is
    // client-controlled — fine only for a display-only greeting (read
    // directly off tg.initDataUnsafe where needed), never for looking up or
    // writing another client's record. saveConsent below matches solely by
    // telegramChatId, so an unverified id here would let a visitor record
    // 152-ФЗ consent onto someone else's client. This holds the
    // HMAC-verified id (or null) instead.
    const [verifiedTelegramUserId, setVerifiedTelegramUserId] = useState<string | null>(null);
    // O-260829 §4.2: канал доставки уведомления — по факту контекста, в
    // котором открыта ссылка, а не хардкод "Telegram" для всех. Второй
    // мессенджер бота — Max (см. sendMaxMessage в src/lib/max*.ts); других
    // каналов у ссылки специалиста сегодня нет, поэтому выбор бинарный.
    const [notificationChannel, setNotificationChannel] = useState<'Telegram' | 'Max'>('Max');
    const [psy, setPsy] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Client state
    const [isKnownClient, setIsKnownClient] = useState(false);
    const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);

    // Booking state
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    // Task 7: slotToken is the exact-slot identity the booking commit trusts —
    // format/addressId/duration are never re-derived from raw date/time at
    // booking time, only decoded from this signed token server-side. A
    // format:'both' slot has no single token (the concrete choice isn't made
    // yet), so it carries one token per concrete format instead.
    type TimeSlot = { time: string, format: string, addressId: string | null, isOwnBooking?: boolean, slotToken?: string | null, slotTokenOnline?: string | null, slotTokenOffline?: string | null };
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

    // Mechanic B "подбор времени" (CJM_booking_v1.md этап 2) — behind
    // psy.timeSuggestEnabled. showFullCalendar is the "показать все" escape
    // hatch back to the plain grid below, which stays untouched either way.
    const [showFullCalendar, setShowFullCalendar] = useState(false);
    const [preference, setPreference] = useState<TimePreference | null>(null);
    const [suggestedTimes, setSuggestedTimes] = useState<SuggestedTimeCandidate[] | null>(null);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const [waitlistForm, setWaitlistForm] = useState({ name: '', contact: '' });
    const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

    // O-260829 §5.3 "Возврат по ссылке без брони" (S1-R)
    const [returningPreference, setReturningPreference] = useState<TimePreference | null>(null);
    const [showReturnBanner, setShowReturnBanner] = useState(false);
    const [returnFlowTriggered, setReturnFlowTriggered] = useState(false);

    // Читаем сохранённое предпочтение сразу, независимо от загрузки психолога —
    // это чтение localStorage этого устройства, серверу ничего не нужно.
    useEffect(() => {
        if (!psychologistId) return;
        setReturningPreference(readSavedPreference(psychologistId));
    }, [psychologistId]);

    // Показываем баннер и сразу подбираем свежие (не кэшированные) варианты —
    // только когда доступна фича подбора времени и клиент ещё не известен
    // (уже есть подтверждённые встречи — значит, это не "смотрел и ушёл").
    // Once-guard (returnFlowTriggered): без него баннер переигрывался бы
    // заново при каждом решении isKnownClient/psy.
    useEffect(() => {
        if (returnFlowTriggered) return;
        if (loading) return;
        if (!psy?.timeSuggestEnabled) return;
        if (!returningPreference) return;
        if (isKnownClient) return;
        if (bookingSuccess) return;

        setReturnFlowTriggered(true);
        setShowReturnBanner(true);
        handlePreferenceSelect(returningPreference);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, psy, returningPreference, isKnownClient, bookingSuccess, returnFlowTriggered]);

    const handleForgetMe = () => {
        try {
            localStorage.removeItem(bookingPrefStorageKey(psychologistId));
        } catch {
            // Хранилище недоступно (приватный режим и т.п.) — записывать уже нечего.
        }
        setShowReturnBanner(false);
        setReturningPreference(null);
    };

    // Fetch initial data
    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
            // Telegram WebApp native chrome color: this API takes a literal
            // hex string, not a CSS custom property, so it can't reference
            // --booking-paper directly — kept in sync with it by value.
            tg.setHeaderColor?.('#F7F5F1');
            tg.setBackgroundColor?.('#F7F5F1');

            setNotificationChannel('Telegram');
        } else {
            setNotificationChannel('Max');
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
                    setLoading(false);
                    return;
                }

                // Task 3 (PRAKTIKA MVP addendum §6): the only two sources for
                // currentClientId are the `?c=` URL param and a previously
                // saved link TOKEN in localStorage — never a raw clientId.
                // Both go through the STRICT resolver (no legacy fallback):
                // a raw id here would let a visitor look up another client's
                // name/phone/upcoming sessions below (getClientById /
                // getClientUpcomingSessionsById), exactly the bug this closes.
                let currentClientId: string | undefined = undefined;
                if (typeof window !== 'undefined') {
                    const urlParams = new URLSearchParams(window.location.search);
                    const c = urlParams.get('c') || localStorage.getItem('compas_clientToken');
                    if (c) {
                        const resolved = await resolveSignedClientLinkParam(c);
                        if (resolved) {
                            currentClientId = resolved.clientId;
                            setClientId(resolved.clientId);
                            setClientLinkToken(c);
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

                // Pre-fill client data if returning. Task 3 (PRAKTIKA MVP
                // addendum §6): tg.initDataUnsafe.user.id is client-controlled
                // — a page visitor could set it to any Telegram id and read
                // that person's name/phone/upcoming sessions via the calls
                // below. Only an id that passed HMAC verification of
                // tg.initData may be used to look up a client.
                const verifiedTgUserId = tg?.initData
                    ? await resolveVerifiedTelegramUserId(tg.initData)
                    : null;
                setVerifiedTelegramUserId(verifiedTgUserId);

                if (verifiedTgUserId && user) {
                    try {
                        const client = await getClientByTelegram(psychologistId, verifiedTgUserId, currentClientId);
                        if (client) {
                            setIsKnownClient(true);
                            setForm({
                                name: client.name || tg?.initDataUnsafe?.user?.first_name || '',
                                phone: client.phone || ''
                            });

                            // Load upcoming sessions for known client
                            const sessions = await getClientUpcomingSessions(psychologistId, verifiedTgUserId);
                            setUpcomingSessions(sessions);
                        } else {
                            setForm(f => ({ ...f, name: tg?.initDataUnsafe?.user?.first_name || '' }));
                        }

                        // Check consent requirement
                        const consent = await checkConsentRequired(verifiedTgUserId, psychologistId);
                        setConsentRequired(consent.required);
                        setConsentText(consent.text);
                        setConsentVersionState(consent.version);
                    } catch {
                        setForm(f => ({ ...f, name: tg?.initDataUnsafe?.user?.first_name || '' }));
                    }
                } else if (currentClientId && user) {
                    // Client loaded from URL, but without Telegram context (e.g. opened in browser)
                    try {
                        // Import dynamically to avoid top-level issues if needed, but it's already in actions
                        const { getClientById, getClientUpcomingSessionsById } = await import('../actions');
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
                    } catch (e) {
                        console.error(e);
                    }
                } else {
                    // Unknown client without TG and without client ID
                    try {
                        const consent = await checkConsentRequired('', psychologistId);
                        setConsentRequired(true);
                        setConsentText(consent.text);
                        setConsentVersionState(consent.version);
                    } catch { }
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
    }, [psychologistId]);

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
    };

    const handlePreferenceSelect = async (pref: TimePreference) => {
        setPreference(pref);
        try {
            localStorage.setItem(bookingPrefStorageKey(psychologistId), JSON.stringify({ preference: pref, savedAt: Date.now() }));
        } catch {
            // Приватный режим браузера и т.п. — S1-R просто не сработает при
            // следующем визите, сама запись от этого не ломается.
        }
        setSuggestLoading(true);
        try {
            const times = await getSuggestedTimes(psychologistId, pref, clientId || null);
            setSuggestedTimes(times);
        } catch {
            toast.error('Не удалось подобрать время');
            setSuggestedTimes([]);
        } finally {
            setSuggestLoading(false);
        }
    };

    const handleSuggestedTimeSelect = (candidate: SuggestedTimeCandidate) => {
        const [y, m, d] = candidate.date.split('-').map(Number);
        setSelectedDate(new Date(y, m - 1, d));
        handleTimeSlotSelect({ time: candidate.time, format: candidate.format, addressId: candidate.addressId, slotToken: candidate.slotToken });
    };

    const handleWaitlistSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!waitlistForm.name.trim() || !waitlistForm.contact.trim()) {
            toast.error('Укажите имя и контакт');
            return;
        }
        try {
            const result = await submitWaitlistInterest(psychologistId, waitlistForm.name, waitlistForm.contact, preference || undefined);
            if (result.success) {
                setWaitlistSubmitted(true);
            } else {
                toast.error(result.error || 'Не удалось отправить');
            }
        } catch {
            toast.error('Не удалось отправить');
        }
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
            await saveConsent(psychologistId, verifiedTelegramUserId || '', consentVersion);
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

        setBooking(true);

        // Task 7: the slotToken IS the booking — format/addressId/duration
        // are never sent as separate fields the server would have to trust.
        // A format:'both' slot carries two tokens, one per concrete choice;
        // anything else carries exactly one.
        const tokenToUse = selectedTimeSlot.format === 'both'
            ? (selectedFormat === 'offline' ? selectedTimeSlot.slotTokenOffline : selectedTimeSlot.slotTokenOnline)
            : selectedTimeSlot.slotToken;

        if (!tokenToUse) {
            toast.error('Это время больше недоступно — выберите другое.');
            setBooking(false);
            return;
        }

        try {
            // Task 7 (founder review): the server must never trust a
            // client-supplied user object (tgUser comes from
            // initDataUnsafe.user, which a visitor fully controls) for a
            // Telegram-chat-id binding. Pass the raw, signed initData string
            // instead — bookSession verifies it server-side.
            const tgInitData = (window as any).Telegram?.WebApp?.initData || null;
            const res = await bookSession(psychologistId, tgInitData, {
                ...form,
                slotToken: tokenToUse,
            });

            if (res && !res.success) {
                toast.error(res.error || 'Произошла ошибка при записи');
                setBooking(false);
                return;
            }

            // Save the signed link TOKEN (never the raw clientId — Task 3,
            // addendum §6) for persistent identification on this device.
            if (res && res.clientToken && typeof window !== 'undefined') {
                localStorage.setItem('compas_clientToken', res.clientToken);
                setClientLinkToken(res.clientToken);
                if (res.clientId) setClientId(res.clientId);
            }

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
            <div className="practice-booking-theme flex items-center justify-center min-h-screen mobile-full-height bg-[var(--booking-paper)] safe-top safe-bottom">
                <Loader2 className="w-8 h-8 text-[var(--booking-accent)] animate-spin" />
            </div>
        );
    }

    if (!psy) {
        return <NotFoundSpecialist />;
    }

    // Private mode — booking closed
    if (scheduleMode === 'private') {
        return (
            <div className="practice-booking-theme min-h-screen mobile-full-height bg-[var(--booking-paper)] text-[var(--booking-ink)] pb-12 safe-top safe-bottom telegram-miniapp-scrollbar-hide">
                <div className="p-4 max-w-md mx-auto flex flex-col items-center justify-center min-h-screen">
                    <div className="bg-[var(--booking-card)] border border-[var(--booking-line)] rounded-[var(--booking-radius-card)] p-8 shadow-sm w-full text-center">
                        <div className="w-16 h-16 bg-[var(--booking-accent-soft)] rounded-full flex items-center justify-center mx-auto mb-5">
                            <span className="text-3xl">🔒</span>
                        </div>
                        <h2 className="text-xl font-semibold mb-2 text-[var(--booking-ink)]">Запись закрыта</h2>
                        <p className="text-[var(--booking-muted)] text-sm">Специалист пока не принимает запись онлайн. Попробуйте позже или свяжитесь напрямую.</p>
                        <button
                            onClick={() => { const tg = (window as any).Telegram?.WebApp; if (tg) tg.close(); else window.location.href = '/'; }}
                            className="w-full mt-6 py-3.5 rounded-[var(--booking-radius-card)] border-2 border-[var(--booking-accent)] text-white bg-[var(--booking-accent)] font-semibold text-base transition-all min-h-[44px] haptic-light hover:opacity-90 shadow-sm active:scale-[0.98]"
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
            <div className="practice-booking-theme min-h-screen mobile-full-height bg-[var(--booking-paper)] text-[var(--booking-ink)] pb-12 safe-top safe-bottom telegram-miniapp-scrollbar-hide">
                <div className="p-4 max-w-md mx-auto flex flex-col items-center justify-center min-h-screen">
                    <div className="bg-[var(--booking-card)] border border-[var(--booking-line)] rounded-[var(--booking-radius-card)] p-8 shadow-sm w-full text-center animate-in fade-in zoom-in duration-300">
                        <div className="rounded-full flex items-center justify-center mx-auto mb-4 bg-[var(--booking-accent-soft)] text-[var(--booking-accent)]" style={{ width: 52, height: 52 }}>
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-semibold mb-2 text-[var(--booking-ink)]">Вы записаны!</h2>
                        <p className="text-[var(--booking-muted)] text-sm mb-6">Уведомление придёт в {notificationChannel}</p>

                        <div className="bg-[var(--booking-paper)] rounded-[var(--booking-radius-card)] p-5 text-left space-y-3 border border-[var(--booking-line)]">
                            <div>
                                <p className="text-xs font-medium text-[var(--booking-muted)]">Специалист</p>
                                <p className="font-semibold text-[var(--booking-ink)]">{bookingSuccess.psyName}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-[var(--booking-muted)]">Дата и время</p>
                                <p className="font-semibold text-[var(--booking-ink)]">{bookingSuccess.time}, {bookingSuccess.date}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-[var(--booking-muted)]">Формат</p>
                                <p className="font-semibold text-[var(--booking-ink)] flex items-center gap-1.5">
                                    {bookingSuccess.format === 'online' ? (
                                        <><Video className="w-4 h-4 text-[var(--booking-accent)]" /> Онлайн</>
                                    ) : (
                                        <><MapPin className="w-4 h-4 text-[var(--booking-accent)]" /> В кабинете</>
                                    )}
                                </p>
                            </div>
                            {/* Issue #5: Show address if offline */}
                            {bookingSuccess.format === 'offline' && bookingSuccess.addressFull && (
                                <div>
                                    <p className="text-xs font-medium text-[var(--booking-muted)]">Адрес</p>
                                    <p className="font-semibold text-[var(--booking-ink)] flex items-center gap-1.5">
                                        <MapPin className="w-4 h-4 text-[var(--booking-accent)] flex-shrink-0" />
                                        {bookingSuccess.addressName ? `${bookingSuccess.addressName}: ` : ''}{bookingSuccess.addressFull}
                                    </p>
                                </div>
                            )}
                            {bookingSuccess.format === 'online' && bookingSuccess.onlineLink && (
                                <div className="mt-2">
                                    <p className="text-xs font-medium text-[var(--booking-muted)]">Ссылка на переговорку</p>
                                    <a href={bookingSuccess.onlineLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--booking-accent)] hover:underline flex items-center gap-1.5 break-all mt-0.5">
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
                            className="w-full mt-6 py-3.5 rounded-[var(--booking-radius-card)] border-2 border-[var(--booking-accent)] text-white bg-[var(--booking-accent)] font-semibold text-base transition-all min-h-[44px] haptic-light hover:opacity-90 shadow-sm active:scale-[0.98]"
                        >
                            Готово
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="practice-booking-theme min-h-screen mobile-full-height bg-[var(--booking-paper)] text-[var(--booking-ink)] pb-12 safe-top safe-bottom telegram-miniapp-scrollbar-hide">
            <div className="p-4 max-w-md mx-auto">
                <h1 className="text-2xl font-semibold tracking-tight mb-1">Запись на сессию</h1>
                <p className="text-[var(--booking-accent)] font-semibold text-sm mb-1">Специалист — {psy.name}</p>
                <p className="text-[var(--booking-muted)] mb-6 text-sm">
                    Выберите удобную дату и время.
                </p>

                {/* Issue #2: Upcoming sessions for known client */}
                {isKnownClient && upcomingSessions.length > 0 && (
                    <div className="mb-6 bg-[var(--booking-card)] p-4 rounded-[var(--booking-radius-card)] border border-[var(--booking-line)] shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                        <h3 className="font-medium mb-3 text-[var(--booking-ink)] flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-[var(--booking-accent)]" />
                            Ваши предстоящие записи
                        </h3>
                        <div className="space-y-2">
                            {upcomingSessions.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => window.location.href = `/bot/client?c=${encodeURIComponent(clientLinkToken || '')}`}
                                    className="w-full text-left flex items-center gap-3 p-2.5 bg-[var(--booking-paper)] rounded-xl border border-[var(--booking-line)] hover:border-[var(--booking-accent)] transition-colors active:scale-[0.98]"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-[var(--booking-ink)]">
                                            {format(new Date(s.date), 'd MMM', { locale: ru })} в {s.time}
                                        </p>
                                        <p className="text-xs text-[var(--booking-muted)] flex items-center gap-1">
                                            {s.format === 'offline' ? (
                                                <><MapPin className="w-3 h-3" /> {s.addressName || 'В кабинете'}</>
                                            ) : (
                                                <><Video className="w-3 h-3" /> Онлайн</>
                                            )}
                                        </p>
                                    </div>
                                    <span className="text-xs px-2 py-1 rounded-lg bg-[var(--booking-accent-soft)] text-[var(--booking-accent)] font-medium flex-shrink-0">
                                        {s.status === 'confirmed' ? 'Подтв.' : 'Ожид.'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Mechanic B "подбор времени" (CJM_booking_v1.md этап 2) */}
                {psy?.timeSuggestEnabled && !showFullCalendar && (
                    <div className="mb-6 bg-[var(--booking-card)] p-4 rounded-[var(--booking-radius-card)] border border-[var(--booking-line)] shadow-sm">
                        {showReturnBanner && returningPreference && (
                            <div className="mb-3 px-3 py-2.5 rounded-xl bg-[var(--booking-accent-soft)] border border-[var(--booking-accent)]/30 space-y-1.5">
                                <p className="text-sm text-[var(--booking-ink)]">
                                    С возвращением. Вы смотрели: <strong>{PREFERENCE_LABELS[returningPreference]}</strong>
                                </p>
                                <button
                                    type="button"
                                    onClick={handleForgetMe}
                                    className="text-xs text-[var(--booking-muted)] underline underline-offset-2 haptic-light"
                                >
                                    Не запоминать меня на этом устройстве
                                </button>
                            </div>
                        )}
                        <h3 className="font-medium mb-3 text-[var(--booking-ink)]">Когда вам удобнее?</h3>
                        <div className="grid grid-cols-1 gap-2 mb-3">
                            {([
                                ['weekday_evening', 'Будни, после 18:00'],
                                ['weekend_morning', 'Утро выходных'],
                                ['any', 'Не важно — покажите ближайшее'],
                            ] as [TimePreference, string][]).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => handlePreferenceSelect(value)}
                                    className={`py-2.5 px-3 rounded-xl border-2 text-left font-medium text-sm transition-colors haptic-light ${preference === value
                                        ? 'border-[var(--booking-accent)] text-white bg-[var(--booking-accent)]'
                                        : 'border-[var(--booking-line)] text-[var(--booking-ink)] hover:border-[var(--booking-accent)]'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {suggestLoading && <p className="text-[var(--booking-muted)] text-sm text-center py-2">Подбираем время…</p>}

                        {!suggestLoading && suggestedTimes && suggestedTimes.length > 0 && (
                            <div className="space-y-2">
                                {suggestedTimes.map(candidate => {
                                    const isPicked = selectedTimeSlot?.time === candidate.time
                                        && selectedDate && format(selectedDate, 'yyyy-MM-dd') === candidate.date;
                                    return (
                                        <button
                                            key={`${candidate.date}-${candidate.time}`}
                                            type="button"
                                            onClick={() => handleSuggestedTimeSelect(candidate)}
                                            className={`w-full py-2.5 px-3 rounded-xl border-2 text-left font-medium text-sm transition-colors haptic-light ${isPicked
                                                ? 'border-[var(--booking-accent)] text-white bg-[var(--booking-accent)]'
                                                : 'border-[var(--booking-accent)] text-[var(--booking-accent)] hover:bg-[var(--booking-accent)]/10'
                                                }`}
                                        >
                                            {format(new Date(candidate.date + 'T00:00:00'), 'd MMMM', { locale: ru })}, {candidate.time}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {!suggestLoading && suggestedTimes && suggestedTimes.length === 0 && !waitlistSubmitted && (
                            <form onSubmit={handleWaitlistSubmit} className="space-y-2 pt-2 border-t border-[var(--booking-line)]">
                                <p className="text-[var(--booking-muted)] text-sm">Сейчас свободного времени нет. Оставьте контакт — предложим первое освободившееся.</p>
                                <input
                                    type="text" placeholder="Как к вам обращаться"
                                    value={waitlistForm.name}
                                    onChange={e => setWaitlistForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-xl border border-[var(--booking-line)] bg-[var(--booking-card)] text-[var(--booking-ink)] text-sm"
                                />
                                <input
                                    type="text" placeholder="Телефон или Telegram"
                                    value={waitlistForm.contact}
                                    onChange={e => setWaitlistForm(f => ({ ...f, contact: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-xl border border-[var(--booking-line)] bg-[var(--booking-card)] text-[var(--booking-ink)] text-sm"
                                />
                                <button type="submit" className="w-full py-2.5 rounded-xl border-2 border-[var(--booking-accent)] text-[var(--booking-accent)] font-medium text-sm haptic-light">
                                    Записать в лист ожидания
                                </button>
                            </form>
                        )}

                        {!suggestLoading && suggestedTimes && suggestedTimes.length === 0 && waitlistSubmitted && (
                            <p className="text-sm text-center py-2 text-[var(--booking-ink)]">Спасибо! Мы свяжемся, как только время освободится.</p>
                        )}

                        <button
                            type="button"
                            onClick={() => setShowFullCalendar(true)}
                            className="w-full text-center text-xs text-[var(--booking-muted)] underline mt-3"
                        >
                            Показать все времена
                        </button>
                    </div>
                )}

                {/* Calendar */}
                {(!psy?.timeSuggestEnabled || showFullCalendar) && (
                <div className="mb-6">
                    <div className="bg-[var(--booking-card)] border border-[var(--booking-line)] rounded-[var(--booking-radius-card)] overflow-hidden shadow-sm p-2 flex justify-center">
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
                                if (isSelected) return "!bg-transparent !border-2 !border-[var(--booking-accent)] !text-[var(--booking-accent)] !rounded-[12px] !font-medium";
                                if (isAvail) return "!text-[var(--booking-ink)] !bg-transparent !border-2 !border-transparent hover:!border-[var(--booking-accent)]/50 !font-medium !rounded-[12px] transition-colors";
                                return "!text-[var(--booking-muted)] !opacity-40 !font-normal !bg-transparent !border-2 !border-transparent !rounded-[12px]";
                            }}
                            monthClassName={() => "!text-[var(--booking-ink)] !font-medium"}
                            weekDayClassName={() => "!text-[var(--booking-muted)] !font-medium !text-xs"}
                        />
                    </div>
                </div>
                )}

                {/* Time selection */}
                {selectedDate && (!psy?.timeSuggestEnabled || showFullCalendar) && (
                    <div className="mb-6 bg-[var(--booking-card)] p-4 rounded-[var(--booking-radius-card)] border border-[var(--booking-line)] shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                        <h3 className="font-medium mb-3 text-[var(--booking-ink)]">Свободное время:</h3>
                        {availableTimes.length === 0 ? (
                            <p className="text-[var(--booking-muted)] text-sm text-center py-4">Нет свободного времени на эту дату</p>
                        ) : (
                            <div className="grid grid-cols-4 gap-2">
                                {availableTimes.map(slot => {
                                    if (slot.isOwnBooking) {
                                        return (
                                            <div
                                                key={`${slot.time}-${slot.format}-own`}
                                                className="py-2 px-1 text-center rounded-xl border-2 font-bold text-sm min-h-[44px] flex flex-col items-center justify-center border-[var(--booking-accent)]/40 bg-[var(--booking-accent-soft)] text-[var(--booking-accent)]"
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
                                                ? 'border-[var(--booking-accent)] text-white bg-[var(--booking-accent)] shadow-sm'
                                                : 'border-[var(--booking-accent)] text-[var(--booking-accent)] hover:bg-[var(--booking-accent)]/10 bg-transparent'
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
                            <div className="mt-4 pt-4 border-t border-[var(--booking-line)] animate-in fade-in duration-200">
                                <label className="block text-sm font-medium mb-3 text-[var(--booking-ink)]">Формат проведения <span className="text-destructive">*</span></label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedFormat('online')}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors min-h-[44px] haptic-light ${selectedFormat === 'online' ? 'border-[var(--booking-accent)] text-white bg-[var(--booking-accent)] shadow-sm' : 'border-[var(--booking-accent)] text-[var(--booking-accent)] hover:bg-[var(--booking-accent)]/10 bg-transparent'}`}
                                    >💻 Онлайн</button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedFormat('offline')}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors min-h-[44px] haptic-light ${selectedFormat === 'offline' ? 'border-[var(--booking-accent)] text-white bg-[var(--booking-accent)] shadow-sm' : 'border-[var(--booking-accent)] text-[var(--booking-accent)] hover:bg-[var(--booking-accent)]/10 bg-transparent'}`}
                                    >🏠 В кабинете</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <form onSubmit={handleBookingAttempt} className="space-y-4 bg-[var(--booking-card)] p-4 rounded-[var(--booking-radius-card)] border border-[var(--booking-line)] shadow-sm">
                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-[var(--booking-ink)]">Имя</label>
                        <input
                            type="text"
                            required
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full px-4 py-3 border border-[var(--booking-line)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--booking-accent-soft)] focus:border-[var(--booking-accent)] bg-[var(--booking-card)] text-[var(--booking-ink)] transition-all"
                            placeholder="Ваше имя"
                            readOnly={isKnownClient}
                        />
                        {isKnownClient && (
                            <p className="text-xs text-[var(--booking-accent)] mt-1.5 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Данные заполнены автоматически
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-[var(--booking-ink)]">Телефон</label>
                        <PhoneInput
                            country={'ru'}
                            value={form.phone}
                            onChange={phone => setForm(f => ({ ...f, phone }))}
                            inputProps={{
                                required: true,
                            }}
                            containerClass="!w-full"
                            inputClass="!w-full !px-4 !py-3 !pl-12 !h-auto !text-base !border-[var(--booking-line)] !rounded-xl focus:!ring-2 focus:!ring-[var(--booking-accent-soft)] !bg-[var(--booking-card)] !text-[var(--booking-ink)] !transition-all"
                            buttonClass="!bg-[var(--booking-card)] !border-[var(--booking-line)] !rounded-l-xl focus:!ring-[var(--booking-accent-soft)] hover:!bg-[var(--booking-accent-soft)]"
                            dropdownClass="!bg-[var(--booking-card)] !text-[var(--booking-ink)] !border !border-[var(--booking-line)] !rounded-xl !shadow-lg"
                            disabled={isKnownClient && !!form.phone}
                        />
                        <p className="text-xs text-[var(--booking-muted)] mt-2">
                            Телефон нужен для связи. Уведомление о сессии придёт в {notificationChannel}.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={!selectedDate || !selectedTimeSlot || !selectedFormat || booking || scheduleMode === 'readonly'}
                        className={`w-full py-3.5 rounded-[var(--booking-radius-card)] border-2 font-semibold text-base transition-all min-h-[44px] haptic-light mt-4 ${!selectedDate || !selectedTimeSlot || !selectedFormat || booking || scheduleMode === 'readonly'
                            ? 'border-[var(--booking-accent)] text-[var(--booking-accent)] bg-transparent cursor-not-allowed opacity-40'
                            : 'border-[var(--booking-accent)] text-white bg-[var(--booking-accent)] hover:opacity-90 shadow-sm active:scale-[0.98]'
                            }`}
                    >
                        {booking ? <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> : null}
                        {scheduleMode === 'readonly' ? 'Только просмотр' : booking ? 'Оформление...' : 'Записаться'}
                    </button>
                    {scheduleMode === 'readonly' && (
                        <p className="text-xs text-center text-[var(--booking-muted)] mt-2">
                            Специалист пока принимает запись только лично. Вы можете посмотреть свободные окна и связаться напрямую.
                        </p>
                    )}

                    {/* Issue #4: Consent notice for unknown clients */}
                    {consentRequired && (
                        <p className="text-xs text-center text-[var(--booking-muted)] mt-3 leading-relaxed">
                            Нажимая кнопку «Записаться», вы принимаете условия{' '}
                            <button
                                type="button"
                                onClick={() => setShowConsentModal(true)}
                                className="text-[var(--booking-accent)] underline underline-offset-2 hover:opacity-80 transition-colors"
                            >
                                согласия на обработку персональных данных
                            </button>
                        </p>
                    )}
                </form>

                {/* Consent Modal */}
                {showConsentModal && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
                        <div className="bg-[var(--booking-card)] rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col border border-[var(--booking-line)] shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
                            {/* Header */}
                            <div className="px-6 pt-6 pb-4 border-b border-[var(--booking-line)] flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-[var(--booking-accent)]" />
                                    <h3 className="text-lg font-semibold text-[var(--booking-ink)]">Согласие на обработку ПДн</h3>
                                </div>
                                <button
                                    onClick={() => setShowConsentModal(false)}
                                    className="p-1.5 rounded-lg hover:bg-[var(--booking-accent-soft)] transition-colors"
                                >
                                    <X className="w-5 h-5 text-[var(--booking-muted)]" />
                                </button>
                            </div>

                            {/* Consent text */}
                            <div className="px-6 py-4 overflow-y-auto flex-1 custom-scrollbar">
                                <div className="text-sm text-[var(--booking-ink)] leading-relaxed whitespace-pre-wrap">
                                    {consentText}
                                </div>
                            </div>

                            {/* Accept section */}
                            <div className="px-6 py-4 border-t border-[var(--booking-line)] flex-shrink-0 space-y-4">
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={consentAccepted}
                                        onChange={e => setConsentAccepted(e.target.checked)}
                                    />
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 mt-0.5 ${consentAccepted
                                        ? 'bg-[var(--booking-accent)] border-[var(--booking-accent)]'
                                        : 'border-[var(--booking-line)] group-hover:border-[var(--booking-accent)]/50'
                                        }`}>
                                        {consentAccepted && (
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        )}
                                    </div>
                                    <span className="text-sm text-[var(--booking-ink)] leading-snug">
                                        Я даю <a href="/legal/privacy" target="_blank" className="text-[var(--booking-accent)] hover:underline" onClick={e => e.stopPropagation()}>согласие</a> на обработку моих персональных данных
                                    </span>
                                </label>

                                <button
                                    onClick={handleConsentAccept}
                                    disabled={!consentAccepted || consentSaving}
                                    className={`w-full py-3.5 rounded-[var(--booking-radius-card)] border-2 font-semibold text-base transition-all min-h-[44px] haptic-light ${!consentAccepted || consentSaving
                                        ? 'border-[var(--booking-accent)] text-[var(--booking-accent)] bg-transparent cursor-not-allowed opacity-40'
                                        : 'border-[var(--booking-accent)] text-white bg-[var(--booking-accent)] hover:opacity-90 shadow-sm active:scale-[0.98]'
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
                        border: 2px solid var(--booking-accent) !important;
                        border-radius: 12px !important;
                        color: var(--booking-accent) !important;
                    }
                    .react-datepicker__day:hover { border-radius: 12px; }
                    .react-datepicker__day--disabled { opacity: 0.3; }
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--booking-line); border-radius: 4px; }
                `}} />
            </div >
        </div >
    );
}
