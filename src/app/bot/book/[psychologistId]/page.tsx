'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, MapPin, Video } from 'lucide-react';
import { toast } from 'sonner';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ru } from 'date-fns/locale/ru';
import { format } from 'date-fns';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import 'react-datepicker/dist/react-datepicker.css';
import { getPsychologist, getAvailableDates, getAvailableTimes, bookSession, getClientByTelegram } from '../../actions';

registerLocale('ru', ru);

export default function ClientBookingPage() {
    const params = useParams();
    const psychologistId = params.psychologistId as string;

    const router = useRouter();
    const [tgUser, setTgUser] = useState<any>(null);
    const [psy, setPsy] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Booking state
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    type TimeSlot = { time: string, format: string, addressId: string | null };
    const [availableTimes, setAvailableTimes] = useState<TimeSlot[]>([]);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
    const [selectedFormat, setSelectedFormat] = useState<'online' | 'offline' | null>(null);
    const [form, setForm] = useState({ name: '', phone: '' });
    const [booking, setBooking] = useState(false);

    // Success state
    const [bookingSuccess, setBookingSuccess] = useState<{
        date: string;
        time: string;
        format: string;
        psyName: string;
    } | null>(null);

    // Auto-navigate to first available month
    const [startDate, setStartDate] = useState<Date | null>(null);

    // Fetch initial data
    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
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

                // Fetch dates for current and next 3 months to find first available
                const now = new Date();
                let allDates: string[] = [];
                for (let i = 0; i < 4; i++) {
                    const m = (now.getMonth() + i) % 12;
                    const y = now.getFullYear() + Math.floor((now.getMonth() + i) / 12);
                    const d = await getAvailableDates(psychologistId, y, m);
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
                        const client = await getClientByTelegram(psychologistId, String(tgUserId));
                        if (client) {
                            setForm({
                                name: client.name || tg?.initDataUnsafe?.user?.first_name || '',
                                phone: client.phone || ''
                            });
                        } else {
                            setForm(f => ({ ...f, name: tg?.initDataUnsafe?.user?.first_name || '' }));
                        }
                    } catch {
                        setForm(f => ({ ...f, name: tg?.initDataUnsafe?.user?.first_name || '' }));
                    }
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
            const times = await getAvailableTimes(psychologistId, dateStr);
            setAvailableTimes(times);
        } catch (e) {
            toast.error('Ошибка при загрузке времени');
        }
    };

    // Handle month change in DatePicker — fetch dates for new month
    const handleMonthChange = async (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        // Check if we already have dates for this month
        const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        const hasMonth = availableDates.some(d => d.startsWith(monthPrefix));
        if (!hasMonth) {
            const newDates = await getAvailableDates(psychologistId, year, month);
            setAvailableDates(prev => [...prev, ...newDates]);
        }
    };

    const handleTimeSlotSelect = (slot: TimeSlot) => {
        setSelectedTimeSlot(slot);
        if (slot.format === 'both') {
            setSelectedFormat(null); // Force user to choose
        } else {
            setSelectedFormat(slot.format as 'online' | 'offline');
        }
    };

    const handleBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !selectedTimeSlot || !selectedFormat) {
            toast.error('Выберите дату, время и формат встречи');
            return;
        }
        if (!form.phone || form.phone.length < 10) {
            toast.error('Введите корректный номер телефона');
            return;
        }

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        setBooking(true);

        try {
            await bookSession(psychologistId, tgUser, {
                ...form,
                date: dateStr,
                time: selectedTimeSlot.time,
                format: selectedFormat,
                addressId: selectedFormat === 'offline' ? selectedTimeSlot.addressId : null
            });

            // Show success screen
            const dayOfWeek = selectedDate.toLocaleDateString('ru-RU', { weekday: 'long' });
            const formattedDate = selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            setBookingSuccess({
                date: `${dayOfWeek}, ${formattedDate}`,
                time: selectedTimeSlot.time,
                format: selectedFormat,
                psyName: psy?.name || 'Специалист',
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
                        </div>

                        <button
                            onClick={() => {
                                const tg = (window as any).Telegram?.WebApp;
                                if (tg) tg.close();
                                else window.location.href = '/';
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
                                {availableTimes.map(slot => (
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
                                ))}
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

                <form onSubmit={handleBooking} className="space-y-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-foreground">Имя</label>
                        <input
                            type="text"
                            required
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 bg-background text-foreground transition-all"
                            placeholder="Ваше имя"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-foreground">Телефон</label>
                        <PhoneInput
                            country={'ru'}
                            value={form.phone}
                            onChange={phone => setForm(f => ({ ...f, phone }))}
                            inputProps={{
                                required: true,
                            }}
                            containerClass="!w-full"
                            inputClass="!w-full !px-4 !py-3 !pl-12 !h-auto !text-base !border-border !rounded-xl focus:!ring-2 focus:!ring-ring/50 !bg-background !text-foreground !transition-all"
                            buttonClass="!bg-background !border-border !rounded-l-xl focus:!ring-ring/50 hover:!bg-muted"
                            dropdownClass="!bg-card !text-foreground !border !border-border !rounded-xl !shadow-lg"
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                            Телефон нужен для связи. Уведомление о сессии придет в Telegram.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={!selectedDate || !selectedTimeSlot || !selectedFormat || booking}
                        className={`w-full py-3.5 rounded-xl border-2 font-bold text-base transition-all min-h-[44px] haptic-light mt-4 ${!selectedDate || !selectedTimeSlot || !selectedFormat || booking
                            ? 'border-[#1e3a2f] text-[#1e3a2f] dark:border-[#b89a4e] dark:text-[#b89a4e] bg-transparent cursor-not-allowed opacity-40'
                            : 'border-[#1e3a2f] text-white dark:border-[#b89a4e] dark:text-gray-900 bg-[#1e3a2f] dark:bg-[#b89a4e] hover:opacity-90 shadow-sm active:scale-[0.98]'
                            }`}
                    >
                        {booking ? <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> : null}
                        {booking ? 'Оформление...' : 'Записаться'}
                    </button>
                </form>
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
                `}} />
            </div >
        </div >
    );
}
