'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Calendar, Clock, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    sessionId: string;
    currentDate: string;
    currentTime: string;
    clientName: string;
    clientId?: string;
};

type AvailableSlot = { time: string; format: string; addressId: string | null; slotToken: string | null; slotTokenOnline: string | null; slotTokenOffline: string | null };

export function RescheduleModal({ isOpen, onClose, onSave, sessionId, currentDate, currentTime, clientName, clientId }: Props) {
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
    const [saving, setSaving] = useState(false);
    const [loadingDates, setLoadingDates] = useState(true);
    const [loadingSlots, setLoadingSlots] = useState(false);

    // Calendar state
    const [calMonth, setCalMonth] = useState(() => {
        const d = new Date();
        return { year: d.getFullYear(), month: d.getMonth() };
    });

    const fetchAvailableDates = useCallback(async (year: number, month: number) => {
        try {
            const { getAvailableDatesForReschedule } = await import('../actions/sessions');
            const dates = await getAvailableDatesForReschedule(year, month);
            return dates;
        } catch {
            return [];
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        setLoadingDates(true);
        const load = async () => {
            const d1 = await fetchAvailableDates(calMonth.year, calMonth.month);
            const m2 = calMonth.month === 11 ? 0 : calMonth.month + 1;
            const y2 = calMonth.month === 11 ? calMonth.year + 1 : calMonth.year;
            const d2 = await fetchAvailableDates(y2, m2);
            setAvailableDates([...d1, ...d2]);
            setLoadingDates(false);
        };
        load();
    }, [isOpen, calMonth, fetchAvailableDates]);

    const fetchSlots = useCallback(async (dateStr: string) => {
        setLoadingSlots(true);
        try {
            const { getAvailableTimesForReschedule } = await import('../actions/sessions');
            const slots = await getAvailableTimesForReschedule(dateStr, sessionId, clientId);
            setAvailableSlots(slots);
        } catch {
            setAvailableSlots([]);
        }
        setLoadingSlots(false);
    }, [clientId]);

    const handleDateSelect = (dateStr: string) => {
        setSelectedDate(dateStr);
        setSelectedSlot(null);
        fetchSlots(dateStr);
    };

    const handleSave = async () => {
        if (!selectedDate || !selectedSlot) {
            toast.error('Выберите дату и время');
            return;
        }
        // Task 8: the token IS the reschedule target — never re-derived from
        // date/time on the server. A format:'both' rule mints two tokens;
        // this modal has no online/offline toggle (unchanged from before),
        // so it defaults to the online one when both are offered.
        const token = selectedSlot.slotToken || selectedSlot.slotTokenOnline || selectedSlot.slotTokenOffline;
        if (!token) {
            toast.error('Это время больше недоступно — выберите другое.');
            return;
        }
        setSaving(true);
        try {
            const { rescheduleSession } = await import('../actions/sessions');
            await rescheduleSession(sessionId, token);
            toast.success('Сессия перенесена');
            onSave();
            onClose();
        } catch (e: any) {
            toast.error(e?.message || 'Ошибка переноса');
        }
        setSaving(false);
    };

    if (!isOpen) return null;

    // Build calendar grid for current calMonth
    const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
    const firstDayOfWeek = (new Date(calMonth.year, calMonth.month, 1).getDay() + 6) % 7; // Mon=0
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthName = new Date(calMonth.year, calMonth.month).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

    const prevMonth = () => {
        setCalMonth(prev => {
            if (prev.month === 0) return { year: prev.year - 1, month: 11 };
            return { ...prev, month: prev.month - 1 };
        });
    };
    const nextMonth = () => {
        setCalMonth(prev => {
            if (prev.month === 11) return { year: prev.year + 1, month: 0 };
            return { ...prev, month: prev.month + 1 };
        });
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-card rounded-2xl shadow-floating max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-xl font-bold tracking-tight text-foreground">Перенести сессию</h3>
                    <button onClick={onClose} className="p-2 hover:bg-sage-100 rounded-xl transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>

                <div className="bg-sage-50 rounded-2xl p-4 mb-5 border border-border/50">
                    <p className="text-sm font-medium text-muted-foreground">Клиент</p>
                    <p className="font-bold text-foreground">{clientName}</p>
                    <p className="text-sm font-medium text-muted-foreground mt-2">Текущее время</p>
                    <p className="font-semibold text-foreground">
                        {new Date(currentDate + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} в {currentTime}
                    </p>
                </div>

                {/* Calendar */}
                <div className="mb-5">
                    <div className="flex items-center justify-between mb-3">
                        <button onClick={prevMonth} className="p-2 hover:bg-sage-100 rounded-xl transition-colors text-muted-foreground">◀</button>
                        <span className="font-semibold text-foreground capitalize">{monthName}</span>
                        <button onClick={nextMonth} className="p-2 hover:bg-sage-100 rounded-xl transition-colors text-muted-foreground">▶</button>
                    </div>
                    <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground mb-2">
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
                            const isToday = dateObj.getTime() === today.getTime();

                            return (
                                <button
                                    key={day}
                                    disabled={isPast || !isAvail}
                                    onClick={() => handleDateSelect(dateStr)}
                                    className={`relative h-9 rounded-xl text-sm font-medium transition-colors ${isSel
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : isAvail
                                            ? 'text-foreground hover:bg-sage-100'
                                            : 'text-muted-foreground/40 cursor-default'
                                        } ${isToday && !isSel ? 'ring-1 ring-primary/30' : ''}`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    {loadingDates && <div className="text-center pt-2"><Loader2 className="w-4 h-4 animate-spin inline text-muted-foreground" /></div>}
                </div>

                {/* Time slots */}
                {selectedDate && (
                    <div className="mb-5 animate-in fade-in slide-in-from-top-2 duration-200">
                        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-1.5"><Clock className="w-4 h-4 text-primary" /> Свободное время:</h4>
                        {loadingSlots ? (
                            <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin inline text-muted-foreground" /></div>
                        ) : availableSlots.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-3">Нет свободных слотов</p>
                        ) : (
                            <div className="grid grid-cols-4 gap-2">
                                {availableSlots.map(slot => (
                                    <button
                                        key={slot.time}
                                        onClick={() => setSelectedSlot(slot)}
                                        className={`py-2 rounded-xl border-2 font-medium text-sm transition-colors ${selectedSlot?.time === slot.time
                                            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                            : 'border-border text-foreground hover:border-primary/50'
                                            }`}
                                    >
                                        {slot.time}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-3 min-h-[44px] bg-secondary text-secondary-foreground rounded-xl text-sm font-semibold hover:bg-secondary/80 transition-colors">Отмена</button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !selectedSlot}
                        className="flex-1 px-4 py-3 min-h-[44px] bg-primary text-primary-foreground rounded-xl text-sm font-semibold shadow-sm hover:bg-forest-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {saving ? 'Перенос...' : 'Перенести'}
                    </button>
                </div>
            </div>
        </div>
    );
}
