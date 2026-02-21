'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ru } from 'date-fns/locale/ru';
import { format } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';
import { getPsychologist, getAvailableDates, getAvailableTimes, bookSession } from '../../actions';

registerLocale('ru', ru);

export default function ClientBookingPage({ params }: { params: { psychologistId: string } }) {
    const router = useRouter();
    const [tgUser, setTgUser] = useState<any>(null);
    const [psy, setPsy] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Booking state
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [availableTimes, setAvailableTimes] = useState<string[]>([]);
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [form, setForm] = useState({ name: '', phone: '' });

    // Fetch initial data
    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
            tg.setHeaderColor?.('#ffffff');

            if (tg.initDataUnsafe?.user) {
                setTgUser(tg.initDataUnsafe.user);
                setForm(f => ({ ...f, name: tg.initDataUnsafe.user.first_name || '' }));
            }
        }

        const init = async () => {
            try {
                const user = await getPsychologist(params.psychologistId);
                setPsy(user);

                // Fetch dates for current and next month
                const now = new Date();
                const d1 = await getAvailableDates(params.psychologistId, now.getFullYear(), now.getMonth());
                const m2 = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
                const y2 = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
                const d2 = await getAvailableDates(params.psychologistId, y2, m2);

                setAvailableDates([...d1, ...d2]);
            } catch (err) {
                toast.error('Не удалось загрузить данные специалиста');
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [params.psychologistId]);

    // Handle Date selection and fetch times
    const handleDateChange = async (date: Date | null) => {
        if (!date) return;

        setSelectedDate(date);
        setSelectedTime('');
        setAvailableTimes([]);

        const dateStr = format(date, 'yyyy-MM-dd');
        try {
            const times = await getAvailableTimes(params.psychologistId, dateStr);
            setAvailableTimes(times);
        } catch (e) {
            toast.error('Ошибка при загрузке времени');
        }
    };

    const handleBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !selectedTime) {
            toast.error('Выберите дату и время');
            return;
        }

        const dateStr = format(selectedDate, 'yyyy-MM-dd');

        toast.promise(
            bookSession(params.psychologistId, tgUser, { ...form, date: dateStr, time: selectedTime }),
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
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    if (!psy) {
        return (
            <div className="p-4 text-center">
                <h2>Специалист не найден</h2>
            </div>
        )
    }

    return (
        <div className="p-4 max-w-md mx-auto pb-12">
            <h1 className="text-2xl font-bold mb-2">Запись на сессию</h1>
            <p className="text-muted-foreground mb-6 text-sm">
                К специалисту {psy.name}. Выберите удобное время.
            </p>

            {/* Calendar */}
            <div className="mb-6 flex justify-center">
                <div className="bg-white border rounded-xl overflow-hidden inline-block shadow-sm">
                    <DatePicker
                        inline
                        locale="ru"
                        selected={selectedDate}
                        onChange={handleDateChange}
                        minDate={new Date()}
                        filterDate={isDateAvailable}
                        calendarClassName="!border-none"
                    />
                </div>
            </div>

            {/* Time selection */}
            {selectedDate && (
                <div className="mb-6">
                    <h3 className="font-medium mb-3">Свободное время:</h3>
                    {availableTimes.length === 0 ? (
                        <p className="text-muted-foreground text-sm">Нет свободного времени на эту дату</p>
                    ) : (
                        <div className="grid grid-cols-4 gap-2">
                            {availableTimes.map(time => (
                                <button
                                    key={time}
                                    type="button"
                                    onClick={() => setSelectedTime(time)}
                                    className={`py-2 rounded-lg font-medium transition-colors text-sm ${selectedTime === time
                                        ? 'bg-primary text-primary-foreground shadow-md'
                                        : 'bg-primary/5 text-primary hover:bg-primary/20'
                                        }`}
                                >
                                    {time}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <form onSubmit={handleBooking} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Имя</label>
                    <input
                        type="text"
                        required
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="Ваше имя"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Телефон</label>
                    <input
                        type="tel"
                        required
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="+7 (999) 000-00-00"
                    />
                </div>

                <button
                    type="submit"
                    disabled={!selectedDate || !selectedTime}
                    className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium mt-6 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Подтвердить запись
                </button>
            </form>

            <style dangerouslySetInnerHTML={{
                __html: `
                .react-datepicker { font-family: inherit; border: none; }
                .react-datepicker__header { background: transparent; border-bottom: none; padding-top: 1rem; }
                .react-datepicker__day--selected { background-color: hsl(var(--primary)) !important; border-radius: 50%; }
                .react-datepicker__day:hover { border-radius: 50%; }
                .react-datepicker__day--disabled { opacity: 0.3; }
            `}} />
        </div>
    );
}
