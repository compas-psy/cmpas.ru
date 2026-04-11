'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Plus, X, Calendar, Trash2, Palmtree, User, Coffee, Edit2, Lock, Eye,
    CalendarCheck, RefreshCw, AlertCircle, ChevronDown, ChevronUp,
    Clock, Minus, Shield, Zap, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { DatePicker, TimePicker } from '@/components/ui/date-picker';
import {
    getAvailabilitySlots,
    getTimeBlocks,
    createAvailabilitySlot,
    deleteAvailabilitySlot,
    updateAvailabilitySlot,
    deleteTimeBlock,
    createTimeBlock,
    checkBlockIntersections,
    createManualSlot,
} from '../actions/availability';
import { getAddresses, getSettings, updateSettings } from '../actions/settings';

type Slot = {
    id: string; dayOfWeek: number; startTime: string; endTime: string;
    duration: number; isRecurring: boolean; startDate?: string | null;
    endDate?: string | null; format?: string; addressId?: string | null;
};
type Block = { id: string; startDate: string; endDate: string; type: string; reason: string | null };
type Address = { id: string; name: string; address: string };
type Settings = {
    scheduleMode: string;
    sessionBreak: number;
    maxSessionsPerDay: number | null;
    defaultSessionDuration: number;
};

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAY_LABELS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const BLOCK_LABELS: Record<string, string> = { vacation: 'Отпуск', personal: 'Личное', other: 'Другое' };
const BLOCK_ICONS: Record<string, typeof Palmtree> = { vacation: Palmtree, personal: User, other: Coffee };

const TIMELINE_START = 7; // 7:00
const TIMELINE_END = 22; // 22:00
const HOUR_HEIGHT = 60; // px per hour
const HALF_HOUR = HOUR_HEIGHT / 2;

/** Converts "HH:MM" to pixels offset from TIMELINE_START */
function timeToY(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return (h - TIMELINE_START) * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;
}

/** Converts a Y pixel offset back to "HH:MM" (snapped to 15 min) */
function yToTime(y: number): string {
    const totalMinutes = (y / HOUR_HEIGHT) * 60 + TIMELINE_START * 60;
    const snapped = Math.round(totalMinutes / 15) * 15;
    const h = Math.floor(snapped / 60);
    const m = snapped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Add minutes to a time string */
function addMinutes(time: string, mins: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + mins;
    const nh = Math.floor(total / 60);
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

export default function AvailabilityPage() {
    const [slots, setSlots] = useState<Slot[]>([]);
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [settings, setSettingsState] = useState<Settings>({
        scheduleMode: 'private',
        sessionBreak: 10,
        maxSessionsPerDay: null,
        defaultSessionDuration: 50,
    });
    const [loading, setLoading] = useState(true);
    const [savingMode, setSavingMode] = useState(false);
    const [showNewSlot, setShowNewSlot] = useState(false);
    const [showNewBlock, setShowNewBlock] = useState(false);
    const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
    const [showExpired, setShowExpired] = useState(false);
    const [hoveredCell, setHoveredCell] = useState<{ day: number; time: string } | null>(null);

    // Quick-add popover state
    type QuickSlot = {
        day: number; time: string; posX: number; posY: number;
        duration: number; format: string;
        startDate: string; endDate: string;
    };
    const [quickSlot, setQuickSlot] = useState<QuickSlot | null>(null);

    const initialSlot = {
        startDate: '', endDate: '',
        daysOfWeek: [] as number[],
        startTime: '09:00', endTime: '18:00', duration: settings.defaultSessionDuration,
        hasLunch: false, lunchStart: '13:00', lunchEnd: '14:00',
        format: 'online', addressId: ''
    };
    const [newSlot, setNewSlot] = useState(initialSlot);
    const [newBlock, setNewBlock] = useState({ startDate: '', endDate: '', type: 'vacation', reason: '' });

    const fetchData = useCallback(async () => {
        try {
            const [slotsRes, blocksRes, addrs, settingsRes] = await Promise.all([
                getAvailabilitySlots(),
                getTimeBlocks(),
                getAddresses(),
                getSettings(),
            ]);

            if (slotsRes.success && slotsRes.data) {
                setSlots(slotsRes.data.map((x: any) => ({
                    ...x,
                    startDate: x.startDate ? new Date(x.startDate).toISOString() : null,
                    endDate: x.endDate ? new Date(x.endDate).toISOString() : null,
                })));
            }
            if (blocksRes.success && blocksRes.data) {
                setBlocks(blocksRes.data.map((x: any) => ({
                    ...x,
                    startDate: new Date(x.startDate).toISOString(),
                    endDate: new Date(x.endDate).toISOString(),
                })));
            }
            if (addrs.success && addrs.data) setAddresses(addrs.data);
            if (settingsRes.success && settingsRes.data) {
                const d = settingsRes.data as any;
                setSettingsState({
                    scheduleMode: d.scheduleMode || 'private',
                    sessionBreak: d.sessionBreak ?? 10,
                    maxSessionsPerDay: d.maxSessionsPerDay ?? null,
                    defaultSessionDuration: d.defaultSessionDuration ?? 50,
                });
            }
        } catch (e: any) {
            console.error('fetchData error:', e);
            toast.error('Ошибка при загрузке данных');
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Derived data ──

    const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

    const activeSlots = useMemo(() =>
        slots.filter(s => {
            if (s.endDate && new Date(s.endDate) < today) return false;
            if (s.startDate && new Date(s.startDate) > today) return false;
            return true;
        }), [slots, today]);

    const upcomingSlots = useMemo(() =>
        slots.filter(s => s.startDate && new Date(s.startDate) > today), [slots, today]);

    const expiredSlots = useMemo(() =>
        slots.filter(s => s.endDate && new Date(s.endDate) < today), [slots, today]);

    const visibleSlots = useMemo(() => [...activeSlots, ...upcomingSlots], [activeSlots, upcomingSlots]);

    const slotsByDay = useMemo(() =>
        DAY_LABELS.map((_, i) => visibleSlots.filter(s => s.dayOfWeek === i).sort((a, b) => a.startTime.localeCompare(b.startTime))),
        [visibleSlots]);

    const nearestExpiry = useMemo(() => {
        const dates = activeSlots.filter(s => s.endDate).map(s => new Date(s.endDate!));
        dates.sort((a, b) => a.getTime() - b.getTime());
        return dates[0] ?? null;
    }, [activeSlots]);

    const daysUntilExpiry = nearestExpiry ? Math.ceil((nearestExpiry.getTime() - today.getTime()) / 86400000) : null;

    // ── Actions ──

    const handleUpdateSettings = async (patch: Partial<Settings>) => {
        const next = { ...settings, ...patch };
        setSettingsState(next);
        setSavingMode(true);
        try {
            await updateSettings(patch as any);
        } catch { toast.error('Ошибка сохранения'); }
        setSavingMode(false);
    };

    const rmSlot = async (id: string) => {
        try {
            const res = await deleteAvailabilitySlot(id);
            if (res.success) { toast.success('Удалено'); fetchData(); }
            else toast.error(res.error || 'Ошибка');
        } catch { toast.error('Ошибка'); }
    };

    const handleClickTimeline = (day: number, time: string, e: React.MouseEvent) => {
        // Open inline popover instead of auto-creating
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 90);
        setQuickSlot({
            day, time,
            posX: rect.left + rect.width / 2,
            posY: rect.top + (e.clientY - rect.top),
            duration: settings.defaultSessionDuration,
            format: 'online',
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
        });
    };

    const confirmQuickSlot = async () => {
        if (!quickSlot) return;
        const endTime = addMinutes(quickSlot.time, quickSlot.duration);
        try {
            const res = await createManualSlot({
                dayOfWeek: quickSlot.day,
                startTime: quickSlot.time,
                endTime,
                duration: quickSlot.duration,
                format: quickSlot.format,
                startDate: quickSlot.startDate,
                endDate: quickSlot.endDate,
            });
            if (res.success) {
                toast.success(`${DAY_LABELS[quickSlot.day]} ${quickSlot.time}–${endTime}`);
                setQuickSlot(null);
                fetchData();
            } else {
                toast.error(res.error || 'Ошибка');
            }
        } catch { toast.error('Ошибка'); }
    };

    const saveEditSlot = async () => {
        if (!editingSlot) return;
        if (editingSlot.startTime >= editingSlot.endTime) { toast.error('Некорректное время'); return; }
        try {
            const res = await updateAvailabilitySlot(editingSlot.id, {
                startTime: editingSlot.startTime,
                endTime: editingSlot.endTime,
                duration: editingSlot.duration,
                format: editingSlot.format || 'online',
                addressId: editingSlot.format !== 'online' ? (editingSlot.addressId || null) : null,
            });
            if (res.success) { toast.success('Обновлено'); setEditingSlot(null); fetchData(); }
            else toast.error(res.error || 'Ошибка');
        } catch { toast.error('Ошибка'); }
    };

    // Template slot creation (existing logic)
    const addSlot = async () => {
        if (!newSlot.startDate || !newSlot.endDate) { toast.error('Укажите даты'); return; }
        if (new Date(newSlot.endDate) < new Date(newSlot.startDate)) { toast.error('Дата окончания раньше начала'); return; }
        if (newSlot.daysOfWeek.length === 0) { toast.error('Выберите хотя бы один день'); return; }
        if (newSlot.startTime >= newSlot.endTime) { toast.error('Некорректное время'); return; }
        if (newSlot.hasLunch && (newSlot.lunchStart <= newSlot.startTime || newSlot.lunchEnd >= newSlot.endTime || newSlot.lunchStart >= newSlot.lunchEnd)) {
            toast.error('Некорректное время обеда'); return;
        }
        try {
            const res = await createAvailabilitySlot(newSlot);
            if (res.success) { toast.success('Окна добавлены'); setShowNewSlot(false); setNewSlot(initialSlot); fetchData(); }
            else toast.error(res.error || 'Ошибка');
        } catch { toast.error('Ошибка'); }
    };

    const [intersectingSessions, setIntersectingSessions] = useState<{ id: string; date: Date; time: string; clientName: string }[]>([]);
    const [cancelIntersecting, setCancelIntersecting] = useState(false);
    const [isConfirmingBlock, setIsConfirmingBlock] = useState(false);

    const addBlock = async () => {
        if (!newBlock.startDate || !newBlock.endDate) { toast.error('Укажите даты'); return; }
        try {
            if (!isConfirmingBlock) {
                const res = await checkBlockIntersections(newBlock.startDate, newBlock.endDate);
                if (res.success && res.data && res.data.length > 0) {
                    setIntersectingSessions(res.data.map((x: any) => ({ ...x, date: new Date(x.date) })));
                    setIsConfirmingBlock(true);
                    return;
                }
            }
            const res = await createTimeBlock({ ...newBlock, cancelIntersectingSessions: cancelIntersecting });
            if (res.success) {
                toast.success('Блокировка добавлена');
                setShowNewBlock(false); setIsConfirmingBlock(false);
                setIntersectingSessions([]); setCancelIntersecting(false);
                fetchData();
            } else toast.error(res.error || 'Ошибка');
        } catch { toast.error('Ошибка'); }
    };

    const rmBlock = async (id: string) => {
        try {
            const res = await deleteTimeBlock(id);
            if (res.success) { toast.success('Удалено'); fetchData(); }
            else toast.error(res.error || 'Ошибка');
        } catch { toast.error('Ошибка'); }
    };

    // ── Render ──

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    );

    const timelineHours = Array.from({ length: TIMELINE_END - TIMELINE_START }, (_, i) => TIMELINE_START + i);

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Расписание</h1>
                    <p className="text-muted-foreground text-sm mt-1">Визуальный конструктор вашей рабочей недели</p>
                </div>
                <div className="flex gap-2 self-start">
                    <button onClick={() => setShowNewBlock(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-2xl text-foreground hover:bg-muted transition-all text-sm font-semibold shadow-sm active:scale-[0.97] min-h-[44px]">
                        <Calendar className="w-4 h-4" />Блокировка
                    </button>
                    <button onClick={() => setShowNewSlot(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-2xl hover:bg-primary/90 transition-all text-sm font-semibold shadow-sm active:scale-[0.97] min-h-[44px]">
                        <Plus className="w-4 h-4" />Шаблон
                    </button>
                </div>
            </div>

            {/* ── Smart Settings Bar ── */}
            <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
                {/* Mode selector */}
                <div className="p-5 border-b border-border/50">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-2xl border-2 border-accent/30 text-accent bg-transparent flex items-center justify-center">
                            <Shield className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold tracking-tight text-foreground">Режим записи</h2>
                            <p className="text-[11px] text-muted-foreground">Как клиенты видят ваше расписание</p>
                        </div>
                    </div>
                    <div className="flex gap-1.5 bg-muted/50 p-1 rounded-2xl">
                        {[
                            { value: 'private', label: 'Приватный', Icon: Lock },
                            { value: 'readonly', label: 'Просмотр', Icon: Eye },
                            { value: 'booking', label: 'Запись', Icon: CalendarCheck },
                        ].map(m => (
                            <button
                                key={m.value}
                                disabled={savingMode}
                                onClick={() => handleUpdateSettings({ scheduleMode: m.value })}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                                    settings.scheduleMode === m.value
                                        ? 'bg-white text-foreground shadow-sm dark:bg-foreground/10'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <m.Icon className="w-3.5 h-3.5" />
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Buffer + Limits */}
                <div className="p-5 flex flex-col sm:flex-row gap-5">
                    {/* Buffer between sessions */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                            <Coffee className="w-4 h-4 text-accent" />
                            <span className="text-sm font-semibold text-foreground">Перерыв между сессиями</span>
                        </div>
                        <div className="flex gap-1.5">
                            {[0, 5, 10, 15, 20, 30].map(v => (
                                <button
                                    key={v}
                                    onClick={() => handleUpdateSettings({ sessionBreak: v })}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                                        settings.sessionBreak === v
                                            ? 'bg-accent text-accent-foreground shadow-sm'
                                            : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent hover:border-border'
                                    }`}
                                >
                                    {v === 0 ? '—' : `${v}′`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Max sessions per day */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                            <Zap className="w-4 h-4 text-accent" />
                            <span className="text-sm font-semibold text-foreground">Лимит сессий в день</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleUpdateSettings({ maxSessionsPerDay: Math.max(1, (settings.maxSessionsPerDay || 6) - 1) })}
                                className="w-10 h-10 bg-muted/50 hover:bg-muted rounded-xl flex items-center justify-center border border-border transition-colors"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                            <div className="flex-1 bg-muted/30 rounded-xl px-4 py-2 text-center">
                                <span className="text-lg font-bold text-foreground">
                                    {settings.maxSessionsPerDay ?? '∞'}
                                </span>
                                <span className="text-[10px] text-muted-foreground block -mt-0.5">
                                    {settings.maxSessionsPerDay === null ? 'без лимита' : 'в день'}
                                </span>
                            </div>
                            <button
                                onClick={() => handleUpdateSettings({ maxSessionsPerDay: (settings.maxSessionsPerDay || 0) + 1 })}
                                className="w-10 h-10 bg-muted/50 hover:bg-muted rounded-xl flex items-center justify-center border border-border transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                            {settings.maxSessionsPerDay !== null && (
                                <button
                                    onClick={() => handleUpdateSettings({ maxSessionsPerDay: null })}
                                    className="text-[10px] text-muted-foreground hover:text-foreground font-medium px-2 py-1 rounded-lg hover:bg-muted transition-colors"
                                    title="Убрать лимит"
                                >
                                    ∞
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Status Alerts ── */}
            {activeSlots.length === 0 && upcomingSlots.length > 0 && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-amber-800">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-semibold">
                        Расписание начнётся с {new Date(upcomingSlots.sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())[0].startDate!).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                    </span>
                </div>
            )}
            {activeSlots.length === 0 && upcomingSlots.length === 0 && expiredSlots.length > 0 && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-amber-800">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-semibold">Расписание истекло — добавьте новые окна.</span>
                    <button onClick={() => setShowNewSlot(true)} className="ml-auto text-xs font-bold bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap">+ Шаблон</button>
                </div>
            )}
            {activeSlots.length > 0 && daysUntilExpiry !== null && daysUntilExpiry <= 14 && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-amber-800">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-semibold">
                        Расписание действует ещё {daysUntilExpiry} {daysUntilExpiry === 1 ? 'день' : daysUntilExpiry < 5 ? 'дня' : 'дней'}
                    </span>
                    <button onClick={() => setShowNewSlot(true)} className="ml-auto text-xs font-bold bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap">Продлить</button>
                </div>
            )}

            {/* ── Prompt to add slots if empty ── */}
            {visibleSlots.length === 0 && expiredSlots.length === 0 && (
                <div className="bg-card rounded-3xl border border-border p-12 text-center shadow-sm">
                    <div className="w-16 h-16 bg-accent/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-8 h-8 text-accent" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-2">Создайте своё расписание</h2>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                        Нажмите на любое время в таймлайне ниже, чтобы добавить слот, или используйте шаблон для массового создания.
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button onClick={() => setShowNewSlot(true)}
                            className="flex items-center gap-2 px-5 py-3 bg-accent text-accent-foreground rounded-2xl font-semibold text-sm shadow-sm hover:bg-accent/90 transition-all active:scale-[0.97]">
                            <Plus className="w-4 h-4" />Создать шаблон
                        </button>
                    </div>
                </div>
            )}

            {/* ── Visual Timeline ── Desktop */}
            <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden hidden md:block">
                <div className="flex">
                    {/* Time gutter */}
                    <div className="w-14 shrink-0 border-r border-border/50 bg-muted/20">
                        <div className="h-10 border-b border-border/50" /> {/* Header spacer */}
                        <div className="relative" style={{ height: (TIMELINE_END - TIMELINE_START) * HOUR_HEIGHT }}>
                            {timelineHours.map(h => (
                                <div
                                    key={h}
                                    className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 leading-none"
                                    style={{ top: (h - TIMELINE_START) * HOUR_HEIGHT - 5 }}
                                >
                                    {h}:00
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Day columns */}
                    <div className="flex-1 grid grid-cols-7 divide-x divide-border/30">
                        {DAY_LABELS.map((day, dayIndex) => {
                            const daySlots = slotsByDay[dayIndex];
                            return (
                                <div key={day} className="flex flex-col min-w-0">
                                    {/* Day header */}
                                    <div className="h-10 flex items-center justify-center border-b border-border/50 bg-muted/20">
                                        <span className="text-xs font-bold text-foreground/70 uppercase tracking-wider">{day}</span>
                                        {daySlots.length > 0 && (
                                            <span className="ml-1.5 w-4 h-4 bg-accent/20 text-accent rounded-full text-[9px] font-bold flex items-center justify-center">
                                                {daySlots.length}
                                            </span>
                                        )}
                                    </div>

                                    {/* Timeline body */}
                                    <div
                                        className="relative cursor-crosshair group/col"
                                        style={{ height: (TIMELINE_END - TIMELINE_START) * HOUR_HEIGHT }}
                                        onMouseLeave={() => setHoveredCell(null)}
                                        onMouseMove={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const y = e.clientY - rect.top;
                                            const time = yToTime(y);
                                            setHoveredCell({ day: dayIndex, time });
                                        }}
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const y = e.clientY - rect.top;
                                            const time = yToTime(y);
                                            handleClickTimeline(dayIndex, time, e);
                                        }}
                                    >
                                        {/* Hour grid lines */}
                                        {timelineHours.map(h => (
                                            <div
                                                key={h}
                                                className="absolute left-0 right-0 border-t border-border/20"
                                                style={{ top: (h - TIMELINE_START) * HOUR_HEIGHT }}
                                            />
                                        ))}
                                        {/* Half-hour dashed lines */}
                                        {timelineHours.map(h => (
                                            <div
                                                key={`${h}-half`}
                                                className="absolute left-2 right-2 border-t border-dashed border-border/10"
                                                style={{ top: (h - TIMELINE_START) * HOUR_HEIGHT + HALF_HOUR }}
                                            />
                                        ))}

                                        {/* Existing slots */}
                                        {daySlots.map(slot => {
                                            const top = timeToY(slot.startTime);
                                            const bottom = timeToY(slot.endTime);
                                            const height = bottom - top;
                                            const isUpcoming = slot.startDate && new Date(slot.startDate) > today;
                                            const dateFrom = slot.startDate ? new Date(slot.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '';
                                            const dateTo = slot.endDate ? new Date(slot.endDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '';

                                            return (
                                                <div
                                                    key={slot.id}
                                                    className={`absolute left-1 right-1 rounded-xl border-2 px-2 py-1.5 overflow-hidden transition-all cursor-pointer hover:shadow-md z-10 group/slot ${
                                                        isUpcoming
                                                            ? 'bg-amber-50/90 border-amber-300/60 hover:border-amber-400'
                                                            : 'bg-primary/8 border-primary/25 hover:border-primary/50'
                                                    }`}
                                                    style={{ top, height: Math.max(height, 28) }}
                                                    onClick={(e) => { e.stopPropagation(); setEditingSlot(slot); }}
                                                    title={`${slot.startTime}–${slot.endTime} · ${slot.duration} мин · ${dateFrom} – ${dateTo}`}
                                                >
                                                    <div className={`text-[11px] font-bold leading-tight ${isUpcoming ? 'text-amber-700' : 'text-primary'}`}>
                                                        {slot.startTime}–{slot.endTime}
                                                    </div>
                                                    {height > 35 && (
                                                        <div className="text-[9px] text-muted-foreground font-medium mt-0.5">
                                                            {slot.duration}′ · {slot.format === 'offline' ? '🏢' : slot.format === 'both' ? '🖥️+🏢' : '🖥️'}
                                                        </div>
                                                    )}
                                                    {/* Date range badge */}
                                                    {height > 60 && dateFrom && dateTo && (
                                                        <div className={`text-[8px] mt-1 px-1.5 py-0.5 rounded-md inline-block font-semibold ${
                                                            isUpcoming ? 'bg-amber-100/80 text-amber-600' : 'bg-primary/10 text-primary/60'
                                                        }`}>
                                                            {dateFrom} – {dateTo}
                                                        </div>
                                                    )}
                                                    {/* Delete button */}
                                                    <button
                                                        className="absolute top-1 right-1 w-5 h-5 bg-white/80 hover:bg-destructive/20 rounded-md flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-all shadow-sm z-20"
                                                        onClick={(e) => { e.stopPropagation(); rmSlot(slot.id); }}
                                                    >
                                                        <X className="w-3 h-3 text-destructive" />
                                                    </button>
                                                </div>
                                            );
                                        })}

                                        {/* Buffer visualization between slots */}
                                        {daySlots.slice(0, -1).map((slot, i) => {
                                            if (settings.sessionBreak <= 0) return null;
                                            const nextSlot = daySlots[i + 1];
                                            const bufferStart = timeToY(slot.endTime);
                                            const bufferEnd = timeToY(nextSlot.startTime);
                                            const bufferHeight = bufferEnd - bufferStart;
                                            if (bufferHeight <= 2) return null;

                                            return (
                                                <div
                                                    key={`buffer-${slot.id}`}
                                                    className="absolute left-2 right-2 bg-orange-100/40 rounded-lg flex items-center justify-center pointer-events-none z-5"
                                                    style={{ top: bufferStart, height: bufferHeight }}
                                                >
                                                    {bufferHeight > 14 && (
                                                        <Coffee className="w-3 h-3 text-orange-300" />
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Hover indicator */}
                                        {hoveredCell && hoveredCell.day === dayIndex && (
                                            <div
                                                className="absolute left-1 right-1 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 flex items-center justify-center pointer-events-none z-5 transition-all"
                                                style={{
                                                    top: timeToY(hoveredCell.time),
                                                    height: (settings.defaultSessionDuration / 60) * HOUR_HEIGHT,
                                                }}
                                            >
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-primary/50">
                                                    <Plus className="w-3 h-3" />
                                                    {hoveredCell.time}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Timeline legend */}
                <div className="px-5 py-3 border-t border-border/50 bg-muted/10 flex items-center gap-5 text-[10px] text-muted-foreground font-medium">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-primary/15 border border-primary/30 rounded" /> Слот</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-50 border border-amber-300/50 rounded" /> Будущий</span>
                    {settings.sessionBreak > 0 && (
                        <span className="flex items-center gap-1.5"><Coffee className="w-3 h-3 text-orange-300" /> Перерыв {settings.sessionBreak}′</span>
                    )}
                    <span className="ml-auto">Кликните на пустое место → новый слот</span>
                </div>
            </div>

            {/* ── Quick-Add Popover ── */}
            {quickSlot && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setQuickSlot(null)} />
                    <div
                        className="fixed z-50 bg-card rounded-2xl border border-border shadow-2xl p-4 w-72 animate-in fade-in slide-in-from-top-2 duration-200"
                        style={{
                            left: Math.min(quickSlot.posX - 144, window.innerWidth - 300),
                            top: Math.min(quickSlot.posY + 8, window.innerHeight - 380),
                        }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <div className="text-sm font-bold text-foreground">
                                    {DAY_LABELS_FULL[quickSlot.day]}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {quickSlot.time} – {addMinutes(quickSlot.time, quickSlot.duration)}
                                </div>
                            </div>
                            <button onClick={() => setQuickSlot(null)} className="p-1 hover:bg-muted rounded-lg transition-colors">
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Duration pills */}
                        <div className="mb-3">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Длительность</label>
                            <div className="flex gap-1">
                                {[50, 60, 80, 90].map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setQuickSlot(q => q ? { ...q, duration: d } : q)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            quickSlot.duration === d
                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                        }`}
                                    >
                                        {d}′
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Format pills */}
                        <div className="mb-3">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Формат</label>
                            <div className="flex gap-1">
                                {[
                                    { v: 'online', l: '🖥️ Онлайн' },
                                    { v: 'offline', l: '🏢 Кабинет' },
                                    { v: 'both', l: '🔄 Оба' },
                                ].map(f => (
                                    <button
                                        key={f.v}
                                        onClick={() => setQuickSlot(q => q ? { ...q, format: f.v } : q)}
                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                            quickSlot.format === f.v
                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                        }`}
                                    >
                                        {f.l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Date range */}
                        <div className="mb-4">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Действует</label>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <input
                                        type="date"
                                        value={quickSlot.startDate}
                                        onChange={e => setQuickSlot(q => q ? { ...q, startDate: e.target.value } : q)}
                                        className="w-full text-xs px-2 py-2 border border-border rounded-xl bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="date"
                                        value={quickSlot.endDate}
                                        onChange={e => setQuickSlot(q => q ? { ...q, endDate: e.target.value } : q)}
                                        className="w-full text-xs px-2 py-2 border border-border rounded-xl bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={confirmQuickSlot}
                            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm active:scale-[0.97]"
                        >
                            Добавить слот
                        </button>
                    </div>
                </>
            )}

            {/* ── Mobile Card View ── */}
            <div className="md:hidden space-y-3">
                {visibleSlots.length === 0 ? (
                    <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-sm">
                        <p className="text-sm text-muted-foreground">Нет окон расписания. Нажмите «Шаблон» для добавления.</p>
                    </div>
                ) : (
                    (() => {
                        const groups = new Map<string, { slots: Slot[]; days: number[] }>();
                        visibleSlots.forEach(slot => {
                            const key = `${slot.startTime}-${slot.endTime}-${slot.duration}-${slot.startDate || ''}-${slot.endDate || ''}-${slot.format || 'online'}`;
                            if (!groups.has(key)) groups.set(key, { slots: [], days: [] });
                            const g = groups.get(key)!;
                            g.slots.push(slot);
                            if (!g.days.includes(slot.dayOfWeek)) g.days.push(slot.dayOfWeek);
                        });
                        return Array.from(groups.entries()).map(([key, group]) => {
                            const sample = group.slots[0];
                            const sortedDays = [...group.days].sort();
                            const daysLabel = sortedDays.map(d => DAY_LABELS[d]).join(', ');
                            const formatLabel = sample.format === 'offline' ? 'Кабинет' : sample.format === 'both' ? 'Онлайн + Кабинет' : 'Онлайн';
                            const isUpcoming = sample.startDate && new Date(sample.startDate) > today;
                            return (
                                <div key={key} className={`rounded-2xl border p-4 shadow-sm ${isUpcoming ? 'bg-amber-50/50 border-amber-200/60' : 'bg-card border-border'}`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isUpcoming ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'}`}>{daysLabel}</span>
                                                <span className="text-xs font-medium text-muted-foreground">{formatLabel}</span>
                                            </div>
                                            <div className="text-base font-bold text-foreground">{sample.startTime} – {sample.endTime}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">{sample.duration} мин</div>
                                            {sample.startDate && sample.endDate && (
                                                <div className={`flex items-center gap-1 text-xs mt-1 ${isUpcoming ? 'text-amber-700' : 'text-muted-foreground'}`}>
                                                    {isUpcoming ? <CalendarCheck className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                                                    {isUpcoming
                                                        ? `с ${new Date(sample.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`
                                                        : `${new Date(sample.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} – ${new Date(sample.endDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`
                                                    }
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-1.5 ml-2">
                                            <button onClick={() => setEditingSlot(sample)} className="p-2 bg-muted/50 rounded-xl hover:bg-muted transition-colors">
                                                <Edit2 className="w-4 h-4 text-muted-foreground" />
                                            </button>
                                            <button onClick={() => { group.slots.forEach(s => rmSlot(s.id)); }} className="p-2 bg-destructive/10 rounded-xl hover:bg-destructive/20 transition-colors">
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        });
                    })()
                )}
            </div>

            {/* ── Expired slots ── */}
            {expiredSlots.length > 0 && (
                <div>
                    <button
                        onClick={() => setShowExpired(v => !v)}
                        className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors py-1"
                    >
                        {showExpired ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        История ({expiredSlots.length})
                    </button>
                    {showExpired && (
                        <div className="mt-2 space-y-1">
                            {expiredSlots.map(slot => (
                                <div key={slot.id} className="flex items-center justify-between px-4 py-2 bg-muted/20 rounded-xl text-sm group">
                                    <span className="text-muted-foreground font-medium">
                                        {DAY_LABELS[slot.dayOfWeek]} {slot.startTime}–{slot.endTime} · {slot.duration}′
                                        {slot.endDate && <span className="ml-2 text-xs opacity-50">до {new Date(slot.endDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>}
                                    </span>
                                    <button onClick={() => rmSlot(slot.id)} className="p-1 rounded-lg hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all">
                                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Time Blocks ── */}
            <div>
                <h2 className="text-lg font-bold mb-3 text-foreground tracking-tight">Блокировки</h2>
                {blocks.length === 0 ? (
                    <div className="bg-card rounded-3xl border border-border p-8 text-center shadow-sm">
                        <div className="w-10 h-10 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-2">
                            <Calendar className="w-5 h-5 text-muted-foreground/40" />
                        </div>
                        <p className="text-muted-foreground text-sm">Нет активных блокировок</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {blocks.map(b => {
                            const Icon = BLOCK_ICONS[b.type] || Coffee;
                            return (
                                <div key={b.id} className="bg-card rounded-2xl border border-border p-4 flex items-start gap-3 shadow-sm hover:shadow-md transition-all group">
                                    <div className={`w-10 h-10 shrink-0 rounded-2xl border-2 bg-transparent flex items-center justify-center ${b.type === 'vacation' ? 'border-accent/30 text-accent' : 'border-primary/30 text-primary'}`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0 pt-0.5">
                                        <div className="font-bold text-sm text-foreground">{BLOCK_LABELS[b.type]}</div>
                                        <div className="text-xs font-medium text-muted-foreground mt-0.5">
                                            {new Date(b.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — {new Date(b.endDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                                        </div>
                                        {b.reason && <div className="text-xs text-foreground/70 mt-1.5 bg-muted/50 p-2 rounded-xl border border-border/50">{b.reason}</div>}
                                    </div>
                                    <button onClick={() => rmBlock(b.id)} className="p-1.5 hover:bg-destructive/10 rounded-xl transition-colors opacity-0 group-hover:opacity-100">
                                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Modals ── */}

            {/* New Slot Template Modal */}
            {showNewSlot && <Modal title="Шаблон расписания" onClose={() => setShowNewSlot(false)} onSubmit={addSlot}>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Действует с"><DatePicker value={newSlot.startDate} onChange={d => setNewSlot(s => ({ ...s, startDate: d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : '' }))} /></Field>
                    <Field label="Действует по"><DatePicker value={newSlot.endDate} onChange={d => setNewSlot(s => ({ ...s, endDate: d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : '' }))} /></Field>
                </div>
                <Field label="Дни недели">
                    <div className="flex flex-wrap gap-2">
                        {DAY_LABELS.map((d, i) => (
                            <button key={d} type="button"
                                onClick={() => setNewSlot(s => ({
                                    ...s,
                                    daysOfWeek: s.daysOfWeek.includes(i) ? s.daysOfWeek.filter(x => x !== i) : [...s.daysOfWeek, i]
                                }))}
                                className={`w-11 h-11 rounded-full text-sm font-semibold transition-all ${newSlot.daysOfWeek.includes(i) ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/50 text-muted-foreground border border-border hover:bg-muted'}`}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Начало"><TimePicker value={newSlot.startTime} onChange={t => setNewSlot(s => ({ ...s, startTime: t }))} /></Field>
                    <Field label="Конец"><TimePicker value={newSlot.endTime} onChange={t => setNewSlot(s => ({ ...s, endTime: t }))} /></Field>
                </div>
                <div className="bg-muted/30 p-4 rounded-2xl space-y-3 border border-border/50">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={newSlot.hasLunch} onChange={e => setNewSlot(s => ({ ...s, hasLunch: e.target.checked }))} className="w-5 h-5 rounded-md text-primary focus:ring-primary border-border accent-primary" />
                        <span className="text-sm font-semibold">Перерыв (Обед)</span>
                    </label>
                    {newSlot.hasLunch && (
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Начало обеда"><TimePicker value={newSlot.lunchStart} onChange={t => setNewSlot(s => ({ ...s, lunchStart: t }))} /></Field>
                            <Field label="Конец обеда"><TimePicker value={newSlot.lunchEnd} onChange={t => setNewSlot(s => ({ ...s, lunchEnd: t }))} /></Field>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Формат">
                        <select value={newSlot.format} onChange={e => setNewSlot(s => ({ ...s, format: e.target.value }))} className="inp bg-white">
                            <option value="online">Онлайн</option>
                            <option value="offline">Кабинет</option>
                            <option value="both">Онлайн + Кабинет</option>
                        </select>
                    </Field>
                    <Field label="Длительность">
                        <select value={newSlot.duration} onChange={e => setNewSlot(s => ({ ...s, duration: Number(e.target.value) }))} className="inp bg-white">
                            <option value={50}>50 мин</option><option value={60}>60 мин</option><option value={80}>80 мин</option><option value={90}>90 мин</option>
                        </select>
                    </Field>
                </div>
                {(newSlot.format === 'offline' || newSlot.format === 'both') && (
                    <Field label="Кабинет">
                        {addresses.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Добавьте кабинет в Настройках</p>
                        ) : (
                            <select value={newSlot.addressId} onChange={e => setNewSlot(s => ({ ...s, addressId: e.target.value }))} className="inp bg-white">
                                <option value="">— Выберите —</option>
                                {addresses.map(a => <option key={a.id} value={a.id}>{a.name} ({a.address})</option>)}
                            </select>
                        )}
                    </Field>
                )}
            </Modal>}

            {/* New Block Modal */}
            {showNewBlock && <Modal title="Блокировка" onClose={() => { setShowNewBlock(false); setIsConfirmingBlock(false); setIntersectingSessions([]); setCancelIntersecting(false); }} onSubmit={addBlock}>
                {!isConfirmingBlock ? (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="С"><DatePicker value={newBlock.startDate} onChange={d => setNewBlock(s => ({ ...s, startDate: d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : '' }))} /></Field>
                            <Field label="По"><DatePicker value={newBlock.endDate} onChange={d => setNewBlock(s => ({ ...s, endDate: d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : '' }))} /></Field>
                        </div>
                        <Field label="Тип">
                            <div className="flex gap-2">
                                {[{ v: 'vacation', l: 'Отпуск' }, { v: 'personal', l: 'Личное' }, { v: 'other', l: 'Другое' }].map(t => (
                                    <button key={t.v} type="button" onClick={() => setNewBlock(s => ({ ...s, type: t.v }))}
                                        className={`flex-1 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${newBlock.type === t.v ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>{t.l}</button>
                                ))}
                            </div>
                        </Field>
                        <Field label="Причина"><input type="text" value={newBlock.reason} onChange={e => setNewBlock(s => ({ ...s, reason: e.target.value }))} placeholder="Необязательно" className="inp" /></Field>
                    </>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 border-2 border-destructive/30 bg-transparent rounded-2xl">
                            <h3 className="text-destructive font-semibold text-sm mb-1">Есть пересечения</h3>
                            <p className="text-sm text-foreground/80">{intersectingSessions.length} сессий попадают в этот период.</p>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-2">
                            {intersectingSessions.map(session => (
                                <div key={session.id} className="text-sm p-3 bg-card border border-border rounded-xl shadow-sm flex justify-between">
                                    <span className="font-medium">{session.clientName}</span>
                                    <span className="text-muted-foreground">{new Date(session.date).toLocaleDateString('ru-RU')} в {session.time}</span>
                                </div>
                            ))}
                        </div>
                        <label className="flex items-start gap-3 cursor-pointer p-3 border border-border rounded-xl bg-card hover:bg-muted/30 transition-colors">
                            <input type="checkbox" checked={cancelIntersecting} onChange={e => setCancelIntersecting(e.target.checked)} className="mt-0.5 w-5 h-5 rounded-md accent-primary" />
                            <div>
                                <span className="text-sm font-semibold block">Отменить и уведомить</span>
                                <span className="text-xs text-muted-foreground">Клиенты получат сообщение в Telegram</span>
                            </div>
                        </label>
                    </div>
                )}
            </Modal>}

            {/* Edit Slot Modal */}
            {editingSlot && <Modal title="Редактировать" onClose={() => setEditingSlot(null)} onSubmit={saveEditSlot}>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Начало"><TimePicker value={editingSlot.startTime} onChange={t => setEditingSlot(s => s ? { ...s, startTime: t } : s)} /></Field>
                    <Field label="Конец"><TimePicker value={editingSlot.endTime} onChange={t => setEditingSlot(s => s ? { ...s, endTime: t } : s)} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Формат">
                        <select value={editingSlot.format || 'online'} onChange={e => setEditingSlot(s => s ? { ...s, format: e.target.value } : s)} className="inp bg-white">
                            <option value="online">Онлайн</option>
                            <option value="offline">Кабинет</option>
                            <option value="both">Онлайн + Кабинет</option>
                        </select>
                    </Field>
                    <Field label="Длительность">
                        <select value={editingSlot.duration} onChange={e => setEditingSlot(s => s ? { ...s, duration: Number(e.target.value) } : s)} className="inp bg-white">
                            <option value={50}>50 мин</option><option value={60}>60 мин</option><option value={80}>80 мин</option><option value={90}>90 мин</option>
                        </select>
                    </Field>
                </div>
                {(editingSlot.format === 'offline' || editingSlot.format === 'both') && (
                    <Field label="Кабинет">
                        {addresses.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Добавьте кабинет в Настройках</p>
                        ) : (
                            <select value={editingSlot.addressId || ''} onChange={e => setEditingSlot(s => s ? { ...s, addressId: e.target.value } : s)} className="inp bg-white">
                                <option value="">— Выберите —</option>
                                {addresses.map(a => <option key={a.id} value={a.id}>{a.name} ({a.address})</option>)}
                            </select>
                        )}
                    </Field>
                )}
            </Modal>}

            <style jsx>{`
                .inp {
                    width: 100%;
                    min-height: 48px;
                    padding: 0 1rem;
                    border: 1px solid hsl(var(--border));
                    border-radius: 0.75rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    outline: none;
                    background-color: hsl(var(--background));
                    color: hsl(var(--foreground));
                    transition: all 0.2s;
                }
                .inp:focus {
                    border-color: hsl(var(--ring));
                    box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
                }
            `}</style>
        </div>
    );
}

function Modal({ title, onClose, onSubmit, children }: { title: string; onClose: () => void; onSubmit: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-5 border-b border-border/50 bg-muted/10">
                    <h2 className="text-lg font-bold tracking-tight">{title}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4 overflow-auto telegram-miniapp-scrollbar-hide">{children}</div>
                <div className="p-5 border-t border-border/50 bg-muted/10 flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-3 min-h-[44px] bg-secondary text-secondary-foreground rounded-xl text-sm font-medium hover:bg-secondary/80 transition-all">Отмена</button>
                    <button onClick={onSubmit} className="flex-1 px-4 py-3 min-h-[44px] bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all shadow-sm">Сохранить</button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div><label className="block text-sm font-semibold mb-1.5 text-foreground/90 ml-0.5">{label}</label>{children}</div>;
}
