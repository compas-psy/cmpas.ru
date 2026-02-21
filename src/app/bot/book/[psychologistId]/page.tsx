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
    const [availableTimes, setAvailableTimes] = useState<string[]>([]);
    const [selectedTime, setSelectedTime] = useState<string>('');
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
        setSelectedTime('');
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
        if (!selectedDate || !selectedTime) {
            toast.error('Выберите дату и время');
            return;
        }
        if (!form.phone || form.phone.length < 10) {
            toast.error('Введите корректный номер телефона');
            return;
        }

        const dateStr = format(selectedDate, 'yyyy-MM-dd');

        toast.promise(
            bookSession(psychologistId, tgUser, { ...form, date: dateStr, time: selectedTime }),
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
            <div className="flex items-center justify-center min-h-screen bg-[#f5f5f5]">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    if (!psy) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f5f5] p-4 text-center">
                <h2 className="text-xl font-bold mb-2">Специалист не найден</h2>
                <p className="text-muted-foreground text-sm">Проверьте ссылку и попробуйте еще раз.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f5f5] text-slate-900 pb-12">
            <div className="p-4 max-w-md mx-auto">
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
                    <div className="mb-6 bg-white p-4 rounded-xl border shadow-sm">
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

                <form onSubmit={handleBooking} className="space-y-4 bg-white p-4 rounded-xl border shadow-sm">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">Имя</label>
                        <input
                            type="text"
                            required
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-[#f5f5f5]"
                            placeholder="Ваше имя"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">Телефон</label>
                        <PhoneInput
                            country={'ru'}
                            value={form.phone}
                            onChange={phone => setForm(f => ({ ...f, phone }))}
                            inputStyle={{
                                width: '100%',
                                height: '42px',
                                borderRadius: '0.5rem',
                                borderColor: 'hsl(var(--border))',
                                backgroundColor: '#f5f5f5',
                                fontSize: '1rem',
                            }}
                            buttonStyle={{
                                borderRadius: '0.5rem 0 0 0.5rem',
                                borderColor: 'hsl(var(--border))',
                                backgroundColor: '#fff',
                            }}
                            containerStyle={{
                                width: '100%',
                            }}
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
                    .react-datepicker__day--selected { background-color: hsl(var(--primary)) !important; border-radius: 50%; color: white !important;}
                    .react-datepicker__day:hover { border-radius: 50%; }
                    .react-datepicker__day--disabled { opacity: 0.3; }
                `}} />
            </div>
        </div>
    );
}
