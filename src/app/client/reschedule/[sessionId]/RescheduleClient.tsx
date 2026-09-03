'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAvailableDatesForClientReschedule, getAvailableTimesForClientReschedule, submitClientReschedule } from './actions';
import { getAddressById } from '@/app/bot/actions';
import { expandToConcreteSlotOptions, type ConcreteSlotOption, type RawTimeSlot } from '@/lib/booking/concrete-slot-options';

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
    const [rawSlots, setRawSlots] = useState<RawTimeSlot[]>([]);
    const [addressNames, setAddressNames] = useState<Record<string, string>>({});
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedOption, setSelectedOption] = useState<ConcreteSlotOption | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ date: string; time: string } | null>(null);

    // Task 8 (founder review): one clock time can carry several genuinely
    // different bookable options (same time, different format or office) —
    // each becomes its own selectable option here, never collapsed by time
    // alone. See src/lib/booking/concrete-slot-options.ts.
    const options = useMemo(() => expandToConcreteSlotOptions(rawSlots), [rawSlots]);

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
            .then(async (slots: RawTimeSlot[]) => {
                setRawSlots(slots);

                // Resolve office names for any offline addresses among
                // today's options. Re-fetched per date rather than cached
                // against component state, to avoid a stale-closure cache
                // (this callback is memoized by [sessionId, token] alone)
                // serving a name from a previous render.
                const addressIds = Array.from(new Set(
                    slots.map((s) => s.addressId).filter((id): id is string => !!id)
                ));
                if (addressIds.length > 0) {
                    const resolved = await Promise.all(addressIds.map((id) => getAddressById(id)));
                    setAddressNames((prev) => {
                        const next = { ...prev };
                        addressIds.forEach((id, i) => { next[id] = resolved[i]?.name || 'Кабинет'; });
                        return next;
                    });
                }
            })
            .catch(() => setRawSlots([]))
            .finally(() => setLoadingSlots(false));
    }, [sessionId, token]);

    const handleDateSelect = (dateStr: string) => {
        setSelectedDate(dateStr);
        setSelectedOption(null);
        fetchSlots(dateStr);
    };

    const handleSave = async () => {
        if (!selectedDate || !selectedOption) {
            setError('Выберите дату и время');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await submitClientReschedule(sessionId, token, selectedOption.slotToken);
            setResult(res);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось перенести встречу');
        }
        setSaving(false);
    };

    if (result) {
        return (
            <main className="practice-booking-theme min-h-screen bg-[var(--booking-paper)] px-4 py-8 text-[var(--booking-ink)]">
                <div className="mx-auto max-w-md rounded-[var(--booking-radius-card)] border border-[var(--booking-line)] bg-[var(--booking-card)] p-6 shadow-sm sm:p-8 text-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl bg-[var(--booking-accent-soft)] text-[var(--booking-accent)]">
                        ✓
                    </div>
                    <h1 className="text-xl font-semibold text-[var(--booking-ink)] mb-2">Встреча перенесена</h1>
                    <p className="text-sm text-[var(--booking-muted)]">Новое время: {result.date} в {result.time}. Специалист уже видит изменение.</p>
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
        <main className="practice-booking-theme min-h-screen bg-[var(--booking-paper)] px-4 py-8 text-[var(--booking-ink)]">
            <div className="mx-auto max-w-md rounded-[var(--booking-radius-card)] border border-[var(--booking-line)] bg-[var(--booking-card)] p-6 shadow-sm sm:p-8">
                <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--booking-accent)]">ПРАКТИКА · перенос встречи</p>
                <h1 className="text-xl font-semibold leading-tight tracking-tight mb-4">Выберите новое время</h1>

                <div className="bg-[var(--booking-accent-soft)] rounded-[var(--booking-radius-card)] p-4 mb-5">
                    <p className="text-sm text-[var(--booking-muted)]">Сейчас записаны к {initial.psychologistName}</p>
                    <p className="font-semibold">
                        {new Date(initial.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} в {initial.time}
                    </p>
                </div>

                <div className="mb-5">
                    <div className="flex items-center justify-between mb-3">
                        <button onClick={prevMonth} className="p-2 hover:bg-[var(--booking-accent-soft)] rounded-xl transition-colors text-[var(--booking-muted)]">◀</button>
                        <span className="font-semibold capitalize">{monthName}</span>
                        <button onClick={nextMonth} className="p-2 hover:bg-[var(--booking-accent-soft)] rounded-xl transition-colors text-[var(--booking-muted)]">▶</button>
                    </div>
                    <div className="grid grid-cols-7 text-center text-xs font-medium text-[var(--booking-muted)] mb-2">
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
                                    className={`h-9 rounded-xl text-sm font-medium transition-colors ${isSel ? 'bg-[var(--booking-accent)] text-white shadow-sm' : isAvail ? 'text-[var(--booking-ink)] hover:bg-[var(--booking-accent-soft)]' : 'text-[var(--booking-muted)] opacity-50 cursor-default'}`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    {loadingDates && <p className="text-center pt-2 text-sm text-[var(--booking-muted)]">Загружаем свободные дни…</p>}
                </div>

                {selectedDate && (
                    <div className="mb-5">
                        <h2 className="font-semibold mb-3">Свободное время</h2>
                        {loadingSlots ? (
                            <p className="text-sm text-[var(--booking-muted)] text-center py-4">Загружаем…</p>
                        ) : options.length === 0 ? (
                            <p className="text-sm text-[var(--booking-muted)] text-center py-3">Нет свободных слотов на эту дату</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {options.map(option => (
                                    <button
                                        key={option.key}
                                        onClick={() => setSelectedOption(option)}
                                        className={`px-3 py-2 rounded-[var(--booking-radius-card)] border text-left transition-colors ${selectedOption?.key === option.key ? 'border-[var(--booking-accent)] bg-[var(--booking-accent)] text-white' : 'border-[var(--booking-line)] text-[var(--booking-ink)] hover:border-[var(--booking-accent)]'}`}
                                    >
                                        <div className="text-sm font-semibold">{option.time}</div>
                                        <div className={`text-xs ${selectedOption?.key === option.key ? 'text-white/80' : 'text-[var(--booking-muted)]'}`}>
                                            {option.format === 'online' ? 'Онлайн' : `Очно · ${option.addressId ? (addressNames[option.addressId] || '…') : 'Кабинет'}`}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>
                )}

                <button
                    onClick={handleSave}
                    disabled={saving || !selectedOption}
                    className="w-full py-3 rounded-[var(--booking-radius-card)] text-sm font-semibold text-white bg-[var(--booking-accent)] hover:opacity-90 transition-colors disabled:opacity-50"
                >
                    {saving ? 'Переносим…' : 'Перенести встречу'}
                </button>
            </div>
        </main>
    );
}
