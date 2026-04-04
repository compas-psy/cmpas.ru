'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Calendar, Trash2, Palmtree, User, Coffee, Edit2, Lock, Eye, CalendarCheck, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
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
    checkBlockIntersections
} from '../actions/availability';
import { getAddresses, getSettings, updateSettings } from '../actions/settings';

type Slot = { id: string; dayOfWeek: number; startTime: string; endTime: string; duration: number; isRecurring: boolean; startDate?: string | null; endDate?: string | null; format?: string; addressId?: string | null; };
type Block = { id: string; startDate: string; endDate: string; type: string; reason: string | null };
type Address = { id: string; name: string; address: string };

const dayShort = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const blockLabels: Record<string, string> = { vacation: 'Отпуск', personal: 'Личное', other: 'Другое' };
const blockIcons: Record<string, typeof Palmtree> = { vacation: Palmtree, personal: User, other: Coffee };

export default function AvailabilityPage() {
    const [slots, setSlots] = useState<Slot[]>([]);
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [showNewSlot, setShowNewSlot] = useState(false);
    const [showNewBlock, setShowNewBlock] = useState(false);
    const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
    const [loading, setLoading] = useState(true);
    const [scheduleMode, setScheduleMode] = useState<string>('private');
    const [savingMode, setSavingMode] = useState(false);
    const [showExpired, setShowExpired] = useState(false);
    const initialSlot = {
        startDate: '', endDate: '',
        daysOfWeek: [] as number[],
        startTime: '09:00', endTime: '18:00', duration: 50,
        hasLunch: false, lunchStart: '13:00', lunchEnd: '14:00',
        format: 'online', addressId: ''
    };
    const [newSlot, setNewSlot] = useState(initialSlot);
    const [newBlock, setNewBlock] = useState({ startDate: '', endDate: '', type: 'vacation', reason: '' });

    const fetchData = useCallback(async () => {
        try {
            const [slotsRes, blocksRes, addrs] = await Promise.all([
                getAvailabilitySlots(),
                getTimeBlocks(),
                getAddresses()
            ]);

            if (slotsRes.success && slotsRes.data) {
                setSlots(slotsRes.data.map((x: any) => ({
                    ...x,
                    startDate: x.startDate ? new Date(x.startDate).toISOString() : null,
                    endDate: x.endDate ? new Date(x.endDate).toISOString() : null
                })));
            } else if (!slotsRes.success) {
                toast.error(slotsRes.error || 'Ошибка при загрузке окон');
            }

            if (blocksRes.success && blocksRes.data) {
                setBlocks(blocksRes.data.map((x: any) => ({
                    ...x,
                    startDate: new Date(x.startDate).toISOString(),
                    endDate: new Date(x.endDate).toISOString()
                })));
            } else if (!blocksRes.success) {
                toast.error(blocksRes.error || 'Ошибка при загрузке блокировок');
            }

            if (addrs.success && addrs.data) {
                setAddresses(addrs.data);
            } else if (!addrs.success) {
                toast.error(addrs.error || 'Ошибка при загрузке адресов');
            }

            // Fetch schedule mode
            try {
                const settingsRes = await getSettings();
                if (settingsRes.success && settingsRes.data) {
                    setScheduleMode((settingsRes.data as any).scheduleMode || 'private');
                }
            } catch { }
        } catch (e: any) {
            console.error('fetchData error:', e);
            toast.error('Ошибка при загрузке данных: ' + (e?.message || 'Неизвестная ошибка'));
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const addSlot = async () => {
        if (!newSlot.startDate || !newSlot.endDate) { toast.error('Укажите даты'); return; }
        if (new Date(newSlot.endDate) < new Date(newSlot.startDate)) { toast.error('Дата окончания не может быть раньше даты начала'); return; }
        if (newSlot.daysOfWeek.length === 0) { toast.error('Выберите хотя бы один день недели'); return; }
        if (newSlot.startTime >= newSlot.endTime) { toast.error('Время начала должно быть раньше времени окончания'); return; }
        if (newSlot.hasLunch && (newSlot.lunchStart <= newSlot.startTime || newSlot.lunchEnd >= newSlot.endTime || newSlot.lunchStart >= newSlot.lunchEnd)) {
            toast.error('Некорректное время обеда'); return;
        }

        try {
            const res = await createAvailabilitySlot(newSlot);
            if (res.success) {
                toast.success('Окна добавлены');
                setShowNewSlot(false);
                setNewSlot(initialSlot);
                fetchData();
            } else {
                toast.error(res.error || 'Ошибка при создании окон');
            }
        } catch (e: any) {
            console.error('addSlot error:', e);
            toast.error('Критическая ошибка при создании окон');
        }
    };

    const rmSlot = async (id: string) => {
        try {
            const res = await deleteAvailabilitySlot(id);
            if (res.success) {
                toast.success('Удалено');
                fetchData();
            } else {
                toast.error(res.error || 'Ошибка при удалении');
            }
        } catch (e: any) {
            toast.error('Критическая ошибка при удалении');
        }
    };

    const updateSlot = async () => {
        if (!editingSlot) return;
        if (editingSlot.startTime >= editingSlot.endTime) { toast.error('Время начала должно быть раньше времени окончания'); return; }

        try {
            const res = await updateAvailabilitySlot(editingSlot.id, {
                startTime: editingSlot.startTime,
                endTime: editingSlot.endTime,
                duration: editingSlot.duration,
                format: editingSlot.format || 'online',
                addressId: editingSlot.format !== 'online' ? (editingSlot.addressId || null) : null
            });
            if (res.success) {
                toast.success('Окно обновлено');
                setEditingSlot(null);
                fetchData();
            } else {
                toast.error(res.error || 'Ошибка при обновлении');
            }
        } catch (e: any) {
            console.error('updateSlot error:', e);
            toast.error('Критическая ошибка при обновлении');
        }
    };

    const [intersectingSessions, setIntersectingSessions] = useState<{ id: string, date: Date, time: string, clientName: string }[]>([]);
    const [cancelIntersecting, setCancelIntersecting] = useState(false);
    const [isConfirmingBlock, setIsConfirmingBlock] = useState(false);

    const addBlock = async () => {
        if (!newBlock.startDate || !newBlock.endDate) { toast.error('Укажите даты'); return; }

        try {
            if (!isConfirmingBlock) {
                const res = await checkBlockIntersections(newBlock.startDate, newBlock.endDate);
                if (res.success && res.data && res.data.length > 0) {
                    setIntersectingSessions(res.data.map((x: any) => ({
                        ...x,
                        date: new Date(x.date)
                    })));
                    setIsConfirmingBlock(true);
                    return;
                } else if (!res.success) {
                    toast.error(res.error || 'Ошибка при проверке пересечений');
                    return;
                }
            }

            const res = await createTimeBlock({
                ...newBlock,
                cancelIntersectingSessions: cancelIntersecting
            });

            if (res.success) {
                toast.success('Блокировка добавлена');
                setShowNewBlock(false);
                setIsConfirmingBlock(false);
                setIntersectingSessions([]);
                setCancelIntersecting(false);
                fetchData();
            } else {
                toast.error(res.error || 'Ошибка при добавлении блокировки');
            }
        } catch (e: any) {
            toast.error('Критическая ошибка при добавлении блокировки');
        }
    };

    const rmBlock = async (id: string) => {
        try {
            const res = await deleteTimeBlock(id);
            if (res.success) {
                toast.success('Удалено');
                fetchData();
            } else {
                toast.error(res.error || 'Ошибка при удалении');
            }
        } catch (e: any) {
            toast.error('Критическая ошибка при удалении');
        }
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const activeSlots = slots.filter(s => {
        if (s.endDate && new Date(s.endDate) < today) return false;
        if (s.startDate && new Date(s.startDate) > today) return false;
        return true;
    });
    const upcomingSlots = slots.filter(s => s.startDate && new Date(s.startDate) > today);
    const expiredSlots = slots.filter(s => s.endDate && new Date(s.endDate) < today);

    // Nearest expiry of currently active slots
    const nearestExpiry = activeSlots
        .filter(s => s.endDate)
        .map(s => new Date(s.endDate!))
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    const daysUntilExpiry = nearestExpiry ? Math.ceil((nearestExpiry.getTime() - today.getTime()) / 86400000) : null;

    const visibleSlots = [...activeSlots, ...upcomingSlots];
    const slotsByDay = dayShort.map((_, i) => visibleSlots.filter(s => s.dayOfWeek === i));
    const expiredByDay = dayShort.map((_, i) => expiredSlots.filter(s => s.dayOfWeek === i));

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Расписание</h1>
                    <p className="text-muted-foreground text-base mt-2">Управляйте своей доступностью и слотами</p>
                </div>
                <div className="flex gap-3 self-start">
                    <button onClick={() => setShowNewBlock(true)} className="flex items-center gap-2 px-5 py-2.5 bg-card border border-border rounded-xl text-foreground hover:bg-muted transition-all text-sm font-semibold shadow-sm active:scale-[0.98] min-h-[44px]">
                        <Calendar className="w-4 h-4" />Блокировка
                    </button>
                    <button onClick={() => setShowNewSlot(true)} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all text-sm font-semibold shadow-sm active:scale-[0.98] min-h-[44px]">
                        <Plus className="w-4 h-4" />Новое окно
                    </button>
                </div>
            </div>

            {/* Schedule Mode Toggle */}
            <div className="bg-card rounded-3xl border border-border p-5 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl border-2 border-accent/30 text-accent bg-transparent flex items-center justify-center">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold tracking-tight text-foreground">Режим записи</h2>
                        <p className="text-xs text-muted-foreground">Как клиенты взаимодействуют с вашим расписанием через Telegram</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {[
                        { value: 'private', label: 'Приватный', desc: 'Только вы видите расписание', Icon: Lock },
                        { value: 'readonly', label: 'Просмотр', desc: 'Клиенты видят, но не могут записаться', Icon: Eye },
                        { value: 'booking', label: 'Запись', desc: 'Клиенты могут записаться сами', Icon: CalendarCheck },
                    ].map(m => (
                        <button
                            key={m.value}
                            disabled={savingMode}
                            onClick={async () => {
                                setSavingMode(true);
                                try {
                                    await updateSettings({ scheduleMode: m.value });
                                    setScheduleMode(m.value);
                                    toast.success(`Режим изменён: ${m.label}`);
                                } catch { toast.error('Ошибка'); }
                                setSavingMode(false);
                            }}
                            className={`p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${scheduleMode === m.value
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border hover:border-primary/30'
                                }`}
                        >
                            <m.Icon className={`w-4 h-4 mb-2 ${scheduleMode === m.value ? 'text-primary' : 'text-muted-foreground'}`} />
                            <div className="font-bold text-sm mb-0.5">{m.label}</div>
                            <div className="text-xs text-muted-foreground">{m.desc}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Status banner — no active slots */}
            {activeSlots.length === 0 && slots.length > 0 && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-amber-800">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-semibold">Активного расписания нет — истёк срок действия. Добавьте новые окна.</span>
                    <button onClick={() => setShowNewSlot(true)} className="ml-auto text-xs font-bold bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap">+ Новое окно</button>
                </div>
            )}
            {/* Expiry warning — active slots expire soon */}
            {activeSlots.length > 0 && daysUntilExpiry !== null && daysUntilExpiry <= 14 && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-amber-800">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-semibold">
                        Расписание действует ещё {daysUntilExpiry} {daysUntilExpiry === 1 ? 'день' : daysUntilExpiry < 5 ? 'дня' : 'дней'} — до {nearestExpiry!.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                    </span>
                    <button onClick={() => setShowNewSlot(true)} className="ml-auto text-xs font-bold bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap">Продлить</button>
                </div>
            )}

            {/* Weekly Grid — Desktop */}
            <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm hidden md:block">
                <div className="grid grid-cols-7 divide-x divide-border">
                    {dayShort.map((day, i) => (
                        <div key={day} className="flex flex-col">
                            <div className="p-4 bg-muted/30 text-center border-b border-border">
                                <span className="text-sm font-semibold text-foreground/80">{day}</span>
                            </div>
                            <div className="p-3 min-h-[200px] space-y-2 bg-background/50">
                                {slotsByDay[i].map(slot => {
                                    const isUpcoming = slot.startDate && new Date(slot.startDate) > today;
                                    return (
                                        <div key={slot.id} className={`border rounded-2xl p-3 group relative transition-colors shadow-sm ${isUpcoming ? 'bg-amber-50/50 border-amber-200/50 hover:bg-amber-50' : 'bg-primary/5 hover:bg-primary/10 border-primary/10'}`}>
                                            <div className={`text-sm font-bold ${isUpcoming ? 'text-amber-700' : 'text-primary'}`}>{slot.startTime} – {slot.endTime}</div>
                                            <div className="text-xs font-medium text-muted-foreground mt-0.5">{slot.duration} мин</div>
                                            <div className={`text-[10px] font-medium mt-2 px-2 py-1 rounded-md inline-flex items-center gap-1 ${isUpcoming ? 'bg-amber-100/70 text-amber-700' : 'bg-primary/10 text-primary/80'}`}>
                                                {isUpcoming ? (
                                                    <><CalendarCheck className="w-2.5 h-2.5" />с {new Date(slot.startDate!).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</>
                                                ) : slot.endDate ? (
                                                    <><RefreshCw className="w-2.5 h-2.5" />{new Date(slot.startDate!).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} – {new Date(slot.endDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</>
                                                ) : (
                                                    <><RefreshCw className="w-2.5 h-2.5" />Постоянно</>
                                                )}
                                            </div>
                                            <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setEditingSlot(slot)} className="p-1.5 bg-card border border-border rounded-lg hover:bg-muted transition-colors shadow-sm">
                                                    <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                                                </button>
                                                <button onClick={() => rmSlot(slot.id)} className="p-1.5 bg-card border border-border rounded-lg hover:bg-destructive/10 transition-colors shadow-sm group/btn">
                                                    <Trash2 className="w-3.5 h-3.5 text-destructive group-hover/btn:text-destructive" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {slotsByDay[i].length === 0 && (
                                    <div className="h-full flex items-center justify-center pt-8">
                                        <span className="text-xs text-muted-foreground/50 font-medium">Нет слотов</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Expired slots section */}
            {expiredSlots.length > 0 && (
                <div>
                    <button
                        onClick={() => setShowExpired(v => !v)}
                        className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors py-1"
                    >
                        {showExpired ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        История расписания ({expiredSlots.length} {expiredSlots.length === 1 ? 'окно' : expiredSlots.length < 5 ? 'окна' : 'окон'})
                    </button>
                    {showExpired && (
                        <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm hidden md:block mt-3 opacity-60">
                            <div className="grid grid-cols-7 divide-x divide-border">
                                {dayShort.map((day, i) => (
                                    <div key={day} className="flex flex-col">
                                        <div className="p-3 bg-muted/20 text-center border-b border-border">
                                            <span className="text-xs font-semibold text-muted-foreground">{day}</span>
                                        </div>
                                        <div className="p-3 min-h-[120px] space-y-2">
                                            {expiredByDay[i].map(slot => (
                                                <div key={slot.id} className="bg-muted/30 border border-border/50 rounded-xl p-3 group relative">
                                                    <div className="text-sm font-bold text-muted-foreground">{slot.startTime} – {slot.endTime}</div>
                                                    <div className="text-[10px] text-muted-foreground/70 mt-1">
                                                        {slot.endDate && new Date(slot.endDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </div>
                                                    <button onClick={() => rmSlot(slot.id)} className="absolute top-2 right-2 p-1 rounded-lg hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all">
                                                        <Trash2 className="w-3 h-3 text-destructive" />
                                                    </button>
                                                </div>
                                            ))}
                                            {expiredByDay[i].length === 0 && (
                                                <div className="h-full flex items-center justify-center pt-4">
                                                    <span className="text-xs text-muted-foreground/30">—</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Weekly Slots — Mobile (Card Layout) */}
            <div className="md:hidden space-y-3">
                {slots.length === 0 ? (
                    <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-sm">
                        <p className="text-sm text-muted-foreground">Нет окон расписания. Нажмите «Новое окно» для добавления.</p>
                    </div>
                ) : (
                    /* Group unique slot configs — active + upcoming only */
                    (() => {
                        // Group slots by startTime-endTime-duration-startDate-endDate-format
                        const groups = new Map<string, { slots: Slot[]; days: number[] }>();
                        visibleSlots.forEach(slot => {
                            const key = `${slot.startTime}-${slot.endTime}-${slot.duration}-${slot.startDate || ''}-${slot.endDate || ''}-${slot.format || 'online'}`;
                            if (!groups.has(key)) {
                                groups.set(key, { slots: [], days: [] });
                            }
                            const g = groups.get(key)!;
                            g.slots.push(slot);
                            if (!g.days.includes(slot.dayOfWeek)) g.days.push(slot.dayOfWeek);
                        });
                        return Array.from(groups.entries()).map(([key, group]) => {
                            const sample = group.slots[0];
                            const sortedDays = [...group.days].sort();
                            const daysLabel = sortedDays.map(d => dayShort[d]).join(', ');
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

            {/* Time Blocks */}
            <div className="mt-8">
                <h2 className="text-xl font-semibold mb-4 text-foreground tracking-tight">Блокировки времени</h2>
                {blocks.length === 0 ? (
                    <div className="bg-card rounded-3xl border border-border p-10 text-center shadow-sm">
                        <div className="w-12 h-12 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <Calendar className="w-6 h-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-muted-foreground text-sm font-medium">Нет активных блокировок расписания</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {blocks.map(b => {
                            const Icon = blockIcons[b.type] || Coffee;
                            return (
                                <div key={b.id} className="bg-card rounded-2xl border border-border p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-all group">
                                    <div className={`w-12 h-12 shrink-0 rounded-2xl border-2 bg-transparent flex items-center justify-center ${b.type === 'vacation' ? 'border-accent/30 text-accent' : 'border-primary/30 text-primary'}`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0 pt-0.5">
                                        <div className="font-bold text-base text-foreground truncate">{blockLabels[b.type]}</div>
                                        <div className="text-sm font-medium text-muted-foreground mt-1">
                                            {new Date(b.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — {new Date(b.endDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                                        </div>
                                        {b.reason && <div className="text-sm text-foreground/70 mt-2 bg-muted/50 p-2 rounded-xl border border-border/50">{b.reason}</div>}
                                    </div>
                                    <button onClick={() => rmBlock(b.id)} className="p-2 bg-background border border-border hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive rounded-xl transition-colors opacity-0 group-hover:opacity-100">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* New Slot Modal */}
            {showNewSlot && <Modal title="Новые окна" onClose={() => setShowNewSlot(false)} onSubmit={addSlot}>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Действует с"><DatePicker value={newSlot.startDate} onChange={d => setNewSlot(s => ({ ...s, startDate: d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : '' }))} /></Field>
                    <Field label="Действует по"><DatePicker value={newSlot.endDate} onChange={d => setNewSlot(s => ({ ...s, endDate: d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : '' }))} /></Field>
                </div>
                <Field label="Дни недели">
                    <div className="flex flex-wrap gap-2">
                        {dayShort.map((d, i) => (
                            <button
                                key={d} type="button"
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
                    <Field label="Начало раб. дня"><TimePicker value={newSlot.startTime} onChange={t => setNewSlot(s => ({ ...s, startTime: t }))} /></Field>
                    <Field label="Конец раб. дня"><TimePicker value={newSlot.endTime} onChange={t => setNewSlot(s => ({ ...s, endTime: t }))} /></Field>
                </div>

                <div className="bg-muted/30 p-5 rounded-2xl space-y-4 border border-border/50">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={newSlot.hasLunch} onChange={e => setNewSlot(s => ({ ...s, hasLunch: e.target.checked }))} className="w-5 h-5 rounded-md text-primary focus:ring-primary border-border accent-primary" />
                        <span className="text-sm font-semibold">Добавить перерыв (Обед)</span>
                    </label>
                    {newSlot.hasLunch && (
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Начало обеда"><TimePicker value={newSlot.lunchStart} onChange={t => setNewSlot(s => ({ ...s, lunchStart: t }))} /></Field>
                            <Field label="Конец обеда"><TimePicker value={newSlot.lunchEnd} onChange={t => setNewSlot(s => ({ ...s, lunchEnd: t }))} /></Field>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Режим работы">
                        <select value={newSlot.format} onChange={e => setNewSlot(s => ({ ...s, format: e.target.value }))} className="inp bg-white">
                            <option value="online">Только Онлайн</option>
                            <option value="offline">Только Кабинет</option>
                            <option value="both">Онлайн + Кабинет</option>
                        </select>
                    </Field>
                    <Field label="Длительность (мин)">
                        <select value={newSlot.duration} onChange={e => setNewSlot(s => ({ ...s, duration: Number(e.target.value) }))} className="inp bg-white">
                            <option value={50}>50 мин</option><option value={60}>60 мин</option><option value={80}>80 мин</option><option value={90}>90 мин</option>
                        </select>
                    </Field>
                </div>
                {(newSlot.format === 'offline' || newSlot.format === 'both') && (
                    <Field label="Кабинет">
                        {addresses.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Сначала добавьте кабинет в Настройках → Офлайн кабинеты</p>
                        ) : (
                            <select value={newSlot.addressId} onChange={e => setNewSlot(s => ({ ...s, addressId: e.target.value }))} className="inp bg-white">
                                <option value="">— Выберите кабинет —</option>
                                {addresses.map(a => <option key={a.id} value={a.id}>{a.name} ({a.address})</option>)}
                            </select>
                        )}
                    </Field>
                )}
                <div className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    * Укажите период действия расписания, выберите нужные дни недели и часы работы. Система автоматически создаст доступные слоты на все подходящие даты.
                </div>
            </Modal>}

            {/* New Block Modal */}
            {showNewBlock && <Modal title="Блокировка времени" onClose={() => { setShowNewBlock(false); setIsConfirmingBlock(false); setIntersectingSessions([]); setCancelIntersecting(false); }} onSubmit={addBlock}>
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
                                        className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${newBlock.type === t.v ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>{t.l}</button>
                                ))}
                            </div>
                        </Field>
                        <Field label="Причина"><input type="text" value={newBlock.reason} onChange={e => setNewBlock(s => ({ ...s, reason: e.target.value }))} placeholder="Необязательно (увидят клиенты)" className="inp" /></Field>
                    </>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 border-2 border-destructive/30 bg-transparent rounded-2xl">
                            <h3 className="text-destructive font-semibold text-sm mb-2">Внимание! Есть пересечения</h3>
                            <p className="text-sm text-foreground/80">
                                В выбранный период попадают уже запланированные сессии ({intersectingSessions.length} шт.).
                            </p>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                            {intersectingSessions.map(session => (
                                <div key={session.id} className="text-sm p-3 bg-card border border-border rounded-xl shadow-sm flex justify-between items-center">
                                    <div>
                                        <div className="font-medium text-foreground">{session.clientName}</div>
                                    </div>
                                    <div className="text-muted-foreground">
                                        {new Date(session.date).toLocaleDateString('ru-RU')} в {session.time}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="pt-2">
                            <label className="flex items-start gap-3 cursor-pointer p-3 border border-border rounded-xl bg-card hover:bg-muted/30 transition-colors">
                                <input type="checkbox" checked={cancelIntersecting} onChange={e => setCancelIntersecting(e.target.checked)} className="mt-0.5 w-5 h-5 rounded-md text-primary focus:ring-primary border-border accent-primary" />
                                <div>
                                    <span className="text-sm font-semibold block text-foreground">Отменить записи и уведомить клиентов</span>
                                    <span className="text-xs text-muted-foreground">Клиентам будет отправлено сообщение в Telegram с вашей причиной. Если галочка не стоит, сессии останутся в календаре, но время будет заблокировано для новых.</span>
                                </div>
                            </label>
                        </div>
                    </div>
                )}
            </Modal>}

            {/* Edit Slot Modal */}
            {editingSlot && <Modal title="Редактировать окно" onClose={() => setEditingSlot(null)} onSubmit={updateSlot}>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Начало"><TimePicker value={editingSlot.startTime} onChange={t => setEditingSlot(s => s ? { ...s, startTime: t } : s)} /></Field>
                    <Field label="Конец"><TimePicker value={editingSlot.endTime} onChange={t => setEditingSlot(s => s ? { ...s, endTime: t } : s)} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Режим работы">
                        <select value={editingSlot.format || 'online'} onChange={e => setEditingSlot(s => s ? { ...s, format: e.target.value } : s)} className="inp bg-white">
                            <option value="online">Только Онлайн</option>
                            <option value="offline">Только Кабинет</option>
                            <option value="both">Онлайн + Кабинет</option>
                        </select>
                    </Field>
                    <Field label="Длительность (мин)">
                        <select value={editingSlot.duration} onChange={e => setEditingSlot(s => s ? { ...s, duration: Number(e.target.value) } : s)} className="inp bg-white">
                            <option value={50}>50 мин</option><option value={60}>60 мин</option><option value={80}>80 мин</option><option value={90}>90 мин</option>
                        </select>
                    </Field>
                </div>
                {(editingSlot.format === 'offline' || editingSlot.format === 'both') && (
                    <Field label="Кабинет">
                        {addresses.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Сначала добавьте кабинет в Настройках → Офлайн кабинеты</p>
                        ) : (
                            <select value={editingSlot.addressId || ''} onChange={e => setEditingSlot(s => s ? { ...s, addressId: e.target.value } : s)} className="inp bg-white">
                                <option value="">— Выберите кабинет —</option>
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
                <div className="flex items-center justify-between p-6 border-b border-border/50 bg-muted/10">
                    <h2 className="text-xl font-bold tracking-tight">{title}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-5 overflow-auto telegram-miniapp-scrollbar-hide">{children}</div>
                <div className="p-6 border-t border-border/50 bg-muted/10 flex gap-4">
                    <button onClick={onClose} className="flex-1 px-4 py-3 min-h-[44px] bg-secondary text-secondary-foreground rounded-xl text-sm font-medium hover:bg-secondary/80 transition-all">Отмена</button>
                    <button onClick={onSubmit} className="flex-1 px-4 py-3 min-h-[44px] bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all shadow-sm">Сохранить</button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div><label className="block text-sm font-semibold mb-2 text-foreground/90 ml-1">{label}</label>{children}</div>;
}
