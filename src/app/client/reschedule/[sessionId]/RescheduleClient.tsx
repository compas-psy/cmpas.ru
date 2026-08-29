'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAvailableDatesForClientReschedule, getAvailableTimesForClientReschedule, submitClientReschedule } from './actions';

type TimeSlot = { time: string; format: string; addressId: string | null };

type Props = {
    sessionId: string;
    token: string;
    initial: { date: string; time: string; clientName: string; psychologistName: string };
};

export function RescheduleClient({ sessionId, token, initial }: Props) {
    const [calMonth, setCalMonth] = useState(() => {
        const d = new Date();
        return { year: d.getFullYear(), month: d.getMonth() };
    });
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [loadingDates, setLoadingDates] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ date: string; time: string } | null>(null);

    useEffect(() => {
        let cancelled = false;
        const m2 = calMonth.month === 11 ? 0 : calMonth.month + 1;
        const y2 = calMonth.month === 11 ? calMonth.year + 1 : calMonth.year;
        Promise.all([
            getAvailableDatesForClientReschedule(sessionId, token, calMonth.year, calMonth.month),
            getAvailableDatesForClientReschedule(sessionId, token, y2, m2),
        ]).then(([d1, d2]) => { if (!cancelled) setAvailableDates([...d1, ...d2]); })
            .catch(() => { if (!cancelled) setAvailableDates([]); })
            .finally(() => { if (!cancelled) setLoadingDates(false); });
        return () => { cancelled = true; };
    }, [sessionId, token, calMonth]);

    const fetchSlots = useCallback((dateStr: string) => {
        setLoadingSlots(true);
        getAvailableTimesForClientReschedule(sessionId, token, dateStr)
            .then(setAvailableSlots)
            .catch(() => setAvailableSlots([]))
            .finally(() => setLoadingSlots(false));
    }, [sessionId, token]);

    const handleDateSelect = (dateStr: string) => {
        setSelectedDate(dateStr);
        setSelectedSlot(null);
        fetchSlots(dateStr);
    };

    const handleSave = async () => {
        if (!selectedDate || !selectedSlot) {
            setError('Выберите дату и время');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await submitClientReschedule(sessionId, token, selectedDate, selectedSlot.time);
            setResult(res);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось перенести встречу');
        }
        setSaving(false);
    };

    if (result) {
        return (
            <main className="practice-booking-theme min-h-screen bg-[#faf8f5] px-4 py-8 text-[#1f2a24]">
                <div className="mx-auto max-w-md rounded-3xl border border-[#e6dfd1] bg-white p-6 shadow-sm sm:p-8 text-center">
                    <h1 className="text-xl font-bold text-[var(--booking-accent)] mb-2">Встреча перенесена</h1>
                    <p className="text-sm text-[#5d665f]">Новое время: {result.date} в {result.time}. Специалист уже видит изменение.</p>
                </div>
            </main>
        );
    }

    const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
    const firstDayOfWeek = (new Date(calMonth.year, calMonth.month, 1).getDay() + 6) % 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthName = new Date(calMonth.year, calMonth.month).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

    const prevMonth = () => {
        setLoadingDates(true);
        setCalMonth(prev => prev.month === 0 ? { year: prev.year - 1, month: 11 } : { ...prev, month: prev.month - 1 });
    };
    const nextMonth = () => {
        setLoadingDates(true);
        setCalMonth(prev => prev.month === 11 ? { year: prev.year + 1, month: 0 } : { ...prev, month: prev.month + 1 });
    };

    return (
        <main className="practice-booking-theme min-h-screen bg-[#faf8f5] px-4 py-8 text-[#1f2a24]">
            <div className="mx-auto max-w-md rounded-3xl border border-[#e6dfd1] bg-white p-6 shadow-sm sm:p-8">
                <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--booking-accent)]">ПРАКТИКА · перенос встречи</p>
                <h1 className="text-xl font-bold leading-tight tracking-tight mb-4">Выберите новое время</h1>

                <div className="bg-[#f4f1ea] rounded-2xl p-4 mb-5 border border-[#e6dfd1]">
                    <p className="text-sm text-[#5d665f]">Сейчас записаны к {initial.psychologistName}</p>
                    <p className="font-semibold">
                        {new Date(initial.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} в {initial.time}
                    </p>
                </div>

                <div className="mb-5">
                    <div className="flex items-center justify-between mb-3">
                        <button onClick={prevMonth} className="p-2 hover:bg-[#f4f1ea] rounded-xl transition-colors text-[#5d665f]">◀</button>
                        <span className="font-semibold capitalize">{monthName}</span>
                        <button onClick={nextMonth} className="p-2 hover:bg-[#f4f1ea] rounded-xl transition-colors text-[#5d665f]">▶</button>
                    </div>
                    <div className="grid grid-cols-7 text-center text-xs font-medium text-[#5d665f] mb-2">
                        {['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map(d => <div key={d}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`} />)}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dateObj = new Date(calMonth.year, calMonth.month, day);
                            const dateStr = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const isPast = dateObj < today;
                            const isAvail = availableDates.includes(dateStr);
                            const isSel = selectedDate === dateStr;

                            return (
                                <button
                                    key={day}
                                    disabled={isPast || !isAvail}
                                    onClick={() => handleDateSelect(dateStr)}
                                    className={`h-9 rounded-xl text-sm font-medium transition-colors ${isSel ? 'bg-[var(--booking-accent)] text-white shadow-sm' : isAvail ? 'text-[#1f2a24] hover:bg-[#f4f1ea]' : 'text-[#c3beb0] cursor-default'}`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    {loadingDates && <p className="text-center pt-2 text-sm text-[#5d665f]">Загружаем свободные дни…</p>}
                </div>

                {selectedDate && (
                    <div className="mb-5">
                        <h2 className="font-semibold mb-3">Свободное время</h2>
                        {loadingSlots ? (
                            <p className="text-sm text-[#5d665f] text-center py-4">Загружаем…</p>
                        ) : availableSlots.length === 0 ? (
                            <p className="text-sm text-[#5d665f] text-center py-3">Нет свободных слотов на эту дату</p>
                        ) : (
                            <div className="grid grid-cols-4 gap-2">
                                {availableSlots.map(slot => (
                                    <button
                                        key={slot.time}
                                        onClick={() => setSelectedSlot(slot)}
                                        className={`py-2 rounded-xl border-2 font-medium text-sm transition-colors ${selectedSlot?.time === slot.time ? 'border-[var(--booking-accent)] bg-[var(--booking-accent)] text-white' : 'border-[#e6dfd1] text-[#1f2a24] hover:border-[var(--booking-accent)]/50'}`}
                                    >
                                        {slot.time}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="mb-4 rounded-xl border border-[#D4183D]/20 bg-[#D4183D]/5 px-3 py-2 text-sm text-[#D4183D]">{error}</div>
                )}

                <button
                    onClick={handleSave}
                    disabled={saving || !selectedSlot}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[var(--booking-accent)] hover:opacity-90 transition-colors disabled:opacity-50"
                >
                    {saving ? 'Переносим…' : 'Перенести встречу'}
                </button>
            </div>
        </main>
    );
}
