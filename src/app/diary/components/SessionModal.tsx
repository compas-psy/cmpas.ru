
import { useState, useEffect, useCallback } from 'react';
import { X, User, Calendar as CalendarIcon, Clock, Video, MapPin, FileText, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type SessionModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    initialDate?: Date;
    initialClient?: { id: string; name: string };
    editSession?: any; // If provided, we are editing
    clients: { id: string; name: string }[];
};

export function SessionModal({ isOpen, onClose, onSave, initialDate, initialClient, editSession, clients }: SessionModalProps) {
    const [formData, setFormData] = useState({
        clientId: '',
        date: '',
        time: '',
        duration: 50,
        type: 'individual',
        format: 'online',
        notes: '',
        status: 'confirmed'
    });
    const [loading, setLoading] = useState(false);
    const [availableSlots, setAvailableSlots] = useState<{ time: string; format: string; addressId: string | null }[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [availableDates, setAvailableDates] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            if (editSession) {
                setFormData({
                    clientId: editSession.clientId,
                    date: new Date(editSession.date).toISOString().slice(0, 10),
                    time: editSession.time,
                    duration: editSession.duration,
                    type: editSession.type,
                    format: editSession.format,
                    notes: editSession.notes || '',
                    status: editSession.status
                });
            } else {
                const dateStr = initialDate ? initialDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
                setFormData({
                    clientId: initialClient?.id || '',
                    date: dateStr,
                    time: '',
                    duration: 50,
                    type: 'individual',
                    format: 'online',
                    notes: '',
                    status: 'confirmed'
                });
                setCalendarMonth(initialDate || new Date());
            }
        }
    }, [isOpen, editSession, initialDate, initialClient]);

    // Load available dates when month changes
    const fetchAvailableDates = useCallback(async () => {
        if (editSession) return;
        try {
            const { getAvailableDatesForReschedule } = await import('../actions/sessions');
            const year = calendarMonth.getFullYear();
            const month = calendarMonth.getMonth() + 1;
            const dates = await getAvailableDatesForReschedule(year, month);
            setAvailableDates(dates);
        } catch { setAvailableDates([]); }
    }, [calendarMonth, editSession]);

    useEffect(() => {
        if (isOpen) fetchAvailableDates();
    }, [isOpen, fetchAvailableDates]);

    // Load available times when date changes
    useEffect(() => {
        if (!formData.date || editSession) return;
        const fetchTimes = async () => {
            setLoadingSlots(true);
            try {
                const { getAvailableTimesForReschedule } = await import('../actions/sessions');
                const times = await getAvailableTimesForReschedule(formData.date, formData.clientId || undefined);
                setAvailableSlots(times);
                setFormData(s => ({ ...s, time: '' })); // Reset time selection
            } catch { setAvailableSlots([]); }
            setLoadingSlots(false);
        };
        fetchTimes();
    }, [formData.date, formData.clientId, editSession]);

    const handleSubmit = async () => {
        if (!formData.clientId || !formData.date || !formData.time) {
            toast.error('Заполните обязательные поля');
            return;
        }
        setLoading(true);
        try {
            if (editSession) {
                const { updateSession } = await import('../actions/sessions');
                await updateSession(editSession.id, {
                    status: formData.status,
                    notes: formData.notes
                });
                toast.success('Запись обновлена');
            } else {
                const { createSession } = await import('../actions/sessions');
                await createSession(formData);
                toast.success('Запись создана');
            }
            onSave();
            onClose();
        } catch (e: any) {
            toast.error(e?.message || 'Ошибка сохранения');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // Calendar generation
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday start
    const monthName = calendarMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    const today = new Date().toISOString().slice(0, 10);

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-border/50 bg-muted/10">
                    <h2 className="text-xl font-bold tracking-tight">{editSession ? 'Редактировать запись' : 'Новая запись'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors active:scale-95">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>
                <div className="p-6 space-y-5 overflow-auto telegram-miniapp-scrollbar-hide">
                    {!editSession && (
                        <div>
                            <label className="block text-sm font-semibold mb-2 ml-1 text-foreground/90"><User className="w-4 h-4 inline mr-1 text-muted-foreground" />Клиент</label>
                            <select
                                value={formData.clientId}
                                onChange={e => setFormData(s => ({ ...s, clientId: e.target.value }))}
                                className="w-full px-4 py-3 min-h-[48px] border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 bg-background text-sm font-medium transition-all"
                                disabled={!!initialClient}
                            >
                                <option value="">Выберите клиента</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Calendar for date selection (new session only) */}
                    {!editSession && (
                        <div>
                            <label className="block text-sm font-semibold mb-3 ml-1 text-foreground/90">
                                <CalendarIcon className="w-4 h-4 inline mr-1 text-muted-foreground" />Дата
                            </label>
                            <div className="border border-border rounded-2xl p-3">
                                {/* Month nav */}
                                <div className="flex items-center justify-between mb-3">
                                    <button onClick={() => setCalendarMonth(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-sm font-bold capitalize">{monthName}</span>
                                    <button onClick={() => setCalendarMonth(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                                {/* Day headers */}
                                <div className="grid grid-cols-7 mb-1">
                                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                                        <div key={d} className="text-center text-[10px] font-bold text-muted-foreground py-1">{d}</div>
                                    ))}
                                </div>
                                {/* Days */}
                                <div className="grid grid-cols-7">
                                    {Array.from({ length: startOffset }).map((_, i) => (
                                        <div key={`empty-${i}`} />
                                    ))}
                                    {Array.from({ length: daysInMonth }).map((_, i) => {
                                        const day = i + 1;
                                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                        const isAvailable = availableDates.includes(dateStr);
                                        const isSelected = formData.date === dateStr;
                                        const isPast = dateStr < today;
                                        const isToday = dateStr === today;
                                        return (
                                            <button
                                                key={day}
                                                type="button"
                                                disabled={!isAvailable || isPast}
                                                onClick={() => setFormData(s => ({ ...s, date: dateStr, time: '' }))}
                                                className={`w-full aspect-square flex items-center justify-center text-xs font-semibold rounded-lg transition-all ${isSelected
                                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                                    : isToday
                                                        ? 'bg-accent/20 text-accent-foreground font-bold'
                                                        : isAvailable && !isPast
                                                            ? 'hover:bg-muted text-foreground cursor-pointer'
                                                            : 'text-muted-foreground/30 cursor-not-allowed'
                                                    }`}
                                            >
                                                {day}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Time slots (new session only) */}
                    {!editSession && formData.date && (
                        <div>
                            <label className="block text-sm font-semibold mb-3 ml-1 text-foreground/90">
                                <Clock className="w-4 h-4 inline mr-1 text-muted-foreground" />Свободное время
                            </label>
                            {loadingSlots ? (
                                <div className="flex items-center justify-center py-6">
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : availableSlots.length === 0 ? (
                                <div className="text-center py-4 text-sm text-muted-foreground bg-muted/30 rounded-xl">
                                    Нет свободных окон на эту дату
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {availableSlots.map(slot => (
                                        <button
                                            key={slot.time}
                                            type="button"
                                            onClick={() => setFormData(s => ({ ...s, time: slot.time }))}
                                            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[40px] ${formData.time === slot.time
                                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                                    : 'border border-border hover:border-primary/50 hover:bg-muted text-foreground'
                                                }`}
                                        >
                                            {slot.time}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {editSession && (
                        <div>
                            <label className="block text-sm font-semibold mb-2 ml-1 text-foreground/90"><FileText className="w-4 h-4 inline mr-1 text-muted-foreground" />Заметки по сессии</label>
                            <textarea
                                value={formData.notes}
                                onChange={e => setFormData(s => ({ ...s, notes: e.target.value }))}
                                rows={6}
                                className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 bg-background resize-none text-sm font-medium transition-all placeholder:text-muted-foreground/50"
                                placeholder="Ход сессии, домашнее задание, наблюдения..."
                            />
                            <div className="mt-3 flex flex-wrap gap-2">
                                {["Тревожность", "Апатия", "Сопротивление", "Инсайт", "Выдано ДЗ", "Ресурсное состояние", "Прогресс", "Требует внимания"].map(tag => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => setFormData(s => ({ ...s, notes: s.notes ? `${s.notes} #${tag}` : `#${tag}` }))}
                                        className="text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-colors active:scale-95"
                                    >
                                        +{tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {!editSession && (
                        <>
                            <div>
                                <label className="block text-sm font-semibold mb-2 ml-1 text-foreground/90">Тип</label>
                                <div className="flex gap-2">
                                    {[{ v: 'individual', l: 'Индивид.' }, { v: 'couple', l: 'Парная' }, { v: 'family', l: 'Семейная' }].map(t => (
                                        <button key={t.v} type="button" onClick={() => setFormData(s => ({ ...s, type: t.v }))}
                                            className={`flex-1 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors min-h-[44px] ${formData.type === t.v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted text-muted-foreground hover:text-foreground'}`}>
                                            {t.l}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-2 ml-1 text-foreground/90">Формат</label>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setFormData(s => ({ ...s, format: 'online' }))}
                                        className={`flex-1 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors flex items-center justify-center gap-2 min-h-[44px] ${formData.format === 'online' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted text-muted-foreground hover:text-foreground'}`}>
                                        <Video className="w-4 h-4" />Онлайн
                                    </button>
                                    <button type="button" onClick={() => setFormData(s => ({ ...s, format: 'offline' }))}
                                        className={`flex-1 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors flex items-center justify-center gap-2 min-h-[44px] ${formData.format === 'offline' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted text-muted-foreground hover:text-foreground'}`}>
                                        <MapPin className="w-4 h-4" />Офлайн
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <div className="p-6 border-t border-border/50 bg-muted/10 flex gap-4">
                    <button onClick={onClose} className="flex-1 px-4 py-3 min-h-[44px] bg-secondary text-secondary-foreground rounded-xl text-sm font-semibold hover:bg-secondary/80 transition-all active:scale-[0.98]">
                        Отмена
                    </button>
                    <button onClick={handleSubmit} disabled={loading || (!editSession && !formData.time)} className="flex-1 px-4 py-3 min-h-[44px] bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50 active:scale-[0.98]">
                        {loading ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </div>
    );
}
