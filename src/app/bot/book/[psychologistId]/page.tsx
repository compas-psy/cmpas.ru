'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ru } from 'date-fns/locale/ru';
import { format } from 'date-fns';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import 'react-datepicker/dist/react-datepicker.css';
import { getPsychologist, getAvailableDates, getAvailableTimes, bookSession } from '../../actions';

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
    const [selectedFormat, setSelectedFormat] = useState<'online' | 'offline'>('online');
    const [form, setForm] = useState({ name: '', phone: '' });

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
                setForm(f => ({ ...f, name: tg.initDataUnsafe.user.first_name || '' }));
            }
        }

        const init = async () => {
            if (!psychologistId) return;

            try {
                const user = await getPsychologist(psychologistId);
                setPsy(user);

                // Fetch dates for current and next month
                const now = new Date();
                const d1 = await getAvailableDates(psychologistId, now.getFullYear(), now.getMonth());
                const m2 = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
                const y2 = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
                const d2 = await getAvailableDates(psychologistId, y2, m2);

                setAvailableDates([...d1, ...d2]);
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
        setAvailableTimes([]);

        const dateStr = format(date, 'yyyy-MM-dd');
        try {
            const times = await getAvailableTimes(psychologistId, dateStr);
            setAvailableTimes(times);
        } catch (e) {
            toast.error('Ошибка при загрузке времени');
        }
    };

    const handleBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !selectedTimeSlot) {
            toast.error('Выберите дату и время');
            return;
        }
        if (!form.phone || form.phone.length < 10) {
            toast.error('Введите корректный номер телефона');
            return;
        }

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const sessionFormat = selectedTimeSlot.format === 'both' ? selectedFormat : selectedTimeSlot.format;

        toast.promise(
            bookSession(psychologistId, tgUser, {
                ...form,
                date: dateStr,
                time: selectedTimeSlot.time,
                format: sessionFormat,
                addressId: sessionFormat === 'offline' ? selectedTimeSlot.addressId : null
            }),
            {
                loading: 'Оформление записи...',
                success: () => {
                    const tg = (window as any).Telegram?.WebApp;
                    if (tg) {
                        tg.showAlert('Вы успешно записаны!', () => tg.close());
                    } else {
                        toast.success('Успешно заявка отправлена!');
                        setTimeout(() => window.location.href = '/', 2000);
                    }
                    return 'Успех! Уведомление придет в Telegram.';
                },
                error: 'Ошибка записи'
            }
        );
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

    return (
        <div className="min-h-screen mobile-full-height bg-background text-foreground pb-12 safe-top safe-bottom telegram-miniapp-scrollbar-hide">
            <div className="p-4 max-w-md mx-auto">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Запись на сессию</h1>
                <p className="text-muted-foreground mb-6 text-sm">
                    К специалисту {psy.name}. Выберите удобное время.
                </p>

                {/* Calendar */}
                <div className="mb-6">
                    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm p-2 flex justify-center">
                        <DatePicker
                            inline
                            locale="ru"
                            selected={selectedDate}
                            onChange={handleDateChange}
                            minDate={new Date()}
                            filterDate={isDateAvailable}
                            calendarClassName="!border-none !font-sans !bg-transparent"
                            dayClassName={(date) => {
                                const isAvail = isDateAvailable(date);
                                const isSelected = selectedDate && date.getTime() === selectedDate.getTime();
                                if (isSelected) return "!bg-transparent !border-2 !border-[#1e3a2f] dark:!border-[#b89a4e] !text-[#1e3a2f] dark:!text-[#b89a4e] !rounded-[50%] !font-medium";
                                if (isAvail) return "!text-foreground !bg-transparent !border-2 !border-transparent hover:!border-[#1e3a2f]/50 dark:hover:!border-[#b89a4e]/50 !font-medium !rounded-[50%] transition-colors";
                                return "!text-muted-foreground !opacity-40 !font-normal !bg-transparent !border-2 !border-transparent !rounded-[50%]";
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
                                        onClick={() => {
                                            setSelectedTimeSlot(slot);
                                            setSelectedFormat(slot.format === 'offline' ? 'offline' : 'online');
                                        }}
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

                        {selectedTimeSlot?.format === 'both' && (
                            <div className="mt-4 pt-4 border-t border-border/50 animate-in fade-in duration-200">
                                <label className="block text-sm font-medium mb-3 text-foreground">Формат проведения</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedFormat('online')}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors min-h-[44px] haptic-light ${selectedFormat === 'online' ? 'border-[#1e3a2f] text-white dark:border-[#b89a4e] dark:text-gray-900 bg-[#1e3a2f] dark:bg-[#b89a4e] shadow-sm' : 'border-[#1e3a2f] text-[#1e3a2f] hover:bg-[#1e3a2f]/10 dark:border-[#b89a4e] dark:text-[#b89a4e] dark:hover:bg-[#b89a4e]/10 bg-transparent'}`}
                                    >Онлайн</button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedFormat('offline')}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors min-h-[44px] haptic-light ${selectedFormat === 'offline' ? 'border-[#1e3a2f] text-white dark:border-[#b89a4e] dark:text-gray-900 bg-[#1e3a2f] dark:bg-[#b89a4e] shadow-sm' : 'border-[#1e3a2f] text-[#1e3a2f] hover:bg-[#1e3a2f]/10 dark:border-[#b89a4e] dark:text-[#b89a4e] dark:hover:bg-[#b89a4e]/10 bg-transparent'}`}
                                    >В кабинете</button>
                                </div>
                            </div>
                        )}
                        {selectedTimeSlot?.format === 'offline' && (
                            <div className="mt-4 pt-4 border-t border-border/50 text-sm text-primary flex items-center justify-center p-3 bg-primary/5 rounded-xl animate-in fade-in duration-200">
                                Будет проведена очная встреча в кабинете.
                            </div>
                        )}
                        {selectedTimeSlot?.format === 'online' && (
                            <div className="mt-4 pt-4 border-t border-border/50 text-sm text-primary flex items-center justify-center p-3 bg-primary/5 rounded-xl animate-in fade-in duration-200">
                                Встреча пройдет в онлайн-формате.
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
                        disabled={!selectedDate || !selectedTimeSlot || loading}
                        className={`w-full py-3.5 rounded-xl border-2 font-bold text-base transition-all min-h-[44px] haptic-light mt-4 ${!selectedDate || !selectedTimeSlot || loading
                            ? 'border-[#1e3a2f] text-[#1e3a2f] dark:border-[#b89a4e] dark:text-[#b89a4e] bg-transparent cursor-not-allowed opacity-40'
                            : 'border-[#1e3a2f] text-white dark:border-[#b89a4e] dark:text-gray-900 bg-[#1e3a2f] dark:bg-[#b89a4e] hover:opacity-90 shadow-sm active:scale-[0.98]'
                            }`}
                    >
                        {loading ? 'Секундочку...' : 'Записаться'}
                    </button>
                </form>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .react-datepicker { font-family: inherit; border: none; }
                    .react-datepicker__header { background: transparent; border-bottom: none; padding-top: 1rem; }
                    .react-datepicker__day--selected { 
                        background-color: transparent !important; 
                        border: 2px solid #1e3a2f !important; 
                        border-radius: 50% !important; 
                        color: #1e3a2f !important;
                    }
                    @media (prefers-color-scheme: dark) {
                        .react-datepicker__day--selected { 
                            border: 2px solid #b89a4e !important; 
                            color: #b89a4e !important;
                        }
                    }
                    .react-datepicker__day:hover { border-radius: 50%; }
                    .react-datepicker__day--disabled { opacity: 0.3; }
                `}} />
            </div >
        </div >
    );
}
