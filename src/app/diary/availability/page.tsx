'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Plus, X, Calendar, Trash2, Palmtree, User, Coffee, Edit2, Lock, Eye,
    CalendarCheck, RefreshCw, AlertCircle, ChevronDown, ChevronUp,
    Clock, Minus, Shield, Zap, Sparkles, Copy, Layers, EyeOff,
    Tag, MoreHorizontal, Check, Loader2
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
import {
    getScheduleRules,
    createScheduleRule,
    updateScheduleRule,
    deleteScheduleRule,
    cloneScheduleRule,
    migrateOrphanSlots,
} from '../actions/schedule-rules';
import { RULE_COLORS } from '../actions/schedule-constants';
import {
    getAvailableDates,
    getAvailableTimes,
} from '@/app/bot/actions';

type ScheduleRule = {
    id: string; name: string; priority: number; isActive: boolean;
    color: string | null; slotCount: number;
    format: string; addressId: string | null; duration: number; breakDuration: number; audienceFilter: string;
    startDate: Date | null; endDate: Date | null;
    slots: { id: string; dayOfWeek: number; startTime: string; endTime: string; format: string; startDate: Date | null; endDate: Date | null }[];
};
type Slot = {
    id: string; dayOfWeek: number; startTime: string; endTime: string;
    duration: number; isRecurring: boolean; startDate?: string | null;
    endDate?: string | null; format?: string; addressId?: string | null;
    scheduleRuleId?: string | null;
    scheduleRule?: { id: string; name: string; color: string | null } | null;
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
    const [rules, setRules] = useState<ScheduleRule[]>([]);
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

    // Schedule Rules state
    const [showNewRule, setShowNewRule] = useState(false);
    const initialRuleData = { name: '', color: RULE_COLORS[0], format: 'online', addressId: '', duration: 50, breakDuration: 15, audienceFilter: 'all', startDate: '', endDate: '' };
    const [newRuleData, setNewRuleData] = useState(initialRuleData);
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
    const [editingRule, setEditingRule] = useState<ScheduleRule | null>(null);
    const [showCloneModal, setShowCloneModal] = useState<ScheduleRule | null>(null);
    const [cloneData, setCloneData] = useState({ name: '', startDate: '', endDate: '' });

    // Client preview
    const [showPreview, setShowPreview] = useState(false);
    const [previewDates, setPreviewDates] = useState<string[]>([]);
    const [previewSelectedDate, setPreviewSelectedDate] = useState<string | null>(null);
    const [previewTimes, setPreviewTimes] = useState<{ time: string; format: string }[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [psychologistId, setPsychologistId] = useState<string | null>(null);

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
            const [slotsRes, blocksRes, addrs, settingsRes, rulesRes] = await Promise.all([
                getAvailabilitySlots(),
                getTimeBlocks(),
                getAddresses(),
                getSettings(),
                getScheduleRules(),
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
                setPsychologistId(d.psychologistId || null);
            }
            if (rulesRes.success && rulesRes.data) {
                setRules(rulesRes.data);
            }
        } catch (e: any) {
            console.error('fetchData error:', e);
            toast.error('Ошибка при загрузке данных');
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Auto-migrate orphan slots on first load
    useEffect(() => {
        if (!loading && slots.length > 0 && rules.length === 0) {
            migrateOrphanSlots().then(res => {
                if (res.success && res.migrated && res.migrated > 0) {
                    fetchData();
                }
            });
        }
    }, [loading, slots.length, rules.length, fetchData]);

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

    const visibleSlots = useMemo(() => {
        const base = [...activeSlots, ...upcomingSlots];
        if (selectedRuleId === 'ad-hoc') return base.filter(s => s.scheduleRuleId === null);
        if (selectedRuleId) return base.filter(s => s.scheduleRuleId === selectedRuleId);
        return base;
    }, [activeSlots, upcomingSlots, selectedRuleId]);

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
                scheduleRuleId: selectedRuleId === 'ad-hoc' ? null : (selectedRuleId || (rules.length > 0 ? rules[0].id : null)),
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

    // Template slot creation
    const addSlot = async () => {
        if (!newSlot.startDate || !newSlot.endDate) { toast.error('Укажите даты'); return; }
        if (new Date(newSlot.endDate) < new Date(newSlot.startDate)) { toast.error('Дата окончания раньше начала'); return; }
        if (newSlot.daysOfWeek.length === 0) { toast.error('Выберите хотя бы один день'); return; }
        if (newSlot.startTime >= newSlot.endTime) { toast.error('Некорректное время'); return; }
        if (newSlot.hasLunch && (newSlot.lunchStart <= newSlot.startTime || newSlot.lunchEnd >= newSlot.endTime || newSlot.lunchStart >= newSlot.lunchEnd)) {
            toast.error('Некорректное время обеда'); return;
        }
        try {
            const res = await createAvailabilitySlot({
                ...newSlot,
                scheduleRuleId: selectedRuleId === 'ad-hoc' ? null : (selectedRuleId || (rules.length > 0 ? rules[0].id : null)),
            });
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

    // ── Schedule Rules Actions ──

    const handleCreateRule = async () => {
        if (!newRuleData.name.trim()) { toast.error('Введите название'); return; }
        const payload: any = { 
            name: newRuleData.name.trim(), 
            color: newRuleData.color,
            format: newRuleData.format,
            duration: newRuleData.duration,
            breakDuration: newRuleData.breakDuration,
            audienceFilter: newRuleData.audienceFilter,
            addressId: newRuleData.addressId || null,
        };
        if (newRuleData.startDate) payload.startDate = new Date(newRuleData.startDate);
        if (newRuleData.endDate) payload.endDate = new Date(newRuleData.endDate);
        
        const res = await createScheduleRule(payload);
        if (res.success) {
            toast.success('Правило создано');
            setShowNewRule(false);
            setNewRuleData(initialRuleData);
            fetchData();
        } else toast.error(res.error || 'Ошибка');
    };

    const handleDeleteRule = async (id: string) => {
        const res = await deleteScheduleRule(id);
        if (res.success) {
            toast.success('Правило удалено');
            if (selectedRuleId === id) setSelectedRuleId(null);
            fetchData();
        } else toast.error(res.error || 'Ошибка');
    };

    const handleCloneRule = async () => {
        if (!showCloneModal) return;
        if (!cloneData.name || !cloneData.startDate || !cloneData.endDate) { toast.error('Заполните все поля'); return; }
        const res = await cloneScheduleRule(showCloneModal.id, cloneData);
        if (res.success) {
            toast.success('Правило клонировано');
            setShowCloneModal(null);
            setCloneData({ name: '', startDate: '', endDate: '' });
            fetchData();
        } else toast.error(res.error || 'Ошибка');
    };

    const handleSaveEditRule = async () => {
        if (!editingRule) return;
        const payload: any = {
            name: editingRule.name,
            color: editingRule.color,
            isActive: editingRule.isActive,
            format: editingRule.format,
            duration: editingRule.duration,
            breakDuration: editingRule.breakDuration,
            audienceFilter: editingRule.audienceFilter,
            addressId: editingRule.addressId || null,
        };
        if (editingRule.startDate) payload.startDate = new Date(editingRule.startDate);
        else payload.startDate = null;
        if (editingRule.endDate) payload.endDate = new Date(editingRule.endDate);
        else payload.endDate = null;

        const res = await updateScheduleRule(editingRule.id, payload);
        if (res.success) {
            toast.success('Обновлено');
            setEditingRule(null);
            fetchData();
        } else toast.error(res.error || 'Ошибка');
    };

    // ── Client Preview ──
    const openPreview = async () => {
        if (!psychologistId) {
            toast.error('ID не найден');
            return;
        }
        setShowPreview(true);
        setPreviewLoading(true);
        try {
            const now = new Date();
            const dates = await getAvailableDates(psychologistId, now.getFullYear(), now.getMonth(), true);
            setPreviewDates(dates);
        } catch { toast.error('Ошибка загрузки превью'); }
        setPreviewLoading(false);
    };

    const selectPreviewDate = async (dateStr: string) => {
        if (!psychologistId) return;
        setPreviewSelectedDate(dateStr);
        setPreviewLoading(true);
        try {
            const times = await getAvailableTimes(psychologistId, dateStr, true);
            setPreviewTimes(times);
        } catch { setPreviewTimes([]); }
        setPreviewLoading(false);
    };

    // ── Helpers ──

    const getSlotColor = (slot: Slot): string => {
        return slot.scheduleRule?.color || '#4F46E5';
    };

    // ── Render ──

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    );
    const handleUpdateActive = async (rule: ScheduleRule) => {
        try {
            const res = await updateScheduleRule(rule.id, { isActive: !rule.isActive });
            if (res.success) fetchData();
            else toast.error("Ошибка обновления");
        } catch { toast.error("Ошибка обновления"); }
    };

    return (
        <div className="space-y-8 pb-12 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Настройки расписания</h1>
                    <p className="text-muted-foreground text-sm mt-1">Режимы записи, правила и интеграции в одном месте</p>
                </div>
                <div className="flex gap-2 self-start md:hidden">
                    <button onClick={openPreview} className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-2xl text-foreground hover:bg-muted transition-all text-sm font-semibold shadow-sm active:scale-[0.97] min-h-[44px]">
                        <Eye className="w-4 h-4" />Как видит клиент
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* Left Column */}
                <div className="w-full lg:w-[65%] space-y-6">
                    
                    {/* Section 1: Режим записи для клиентов */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-card overflow-hidden relative">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-foreground">Режим записи</h2>
                                <p className="text-sm text-muted-foreground">Формат взаимодействия с клиентским календарем</p>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4">
                            {/* Private */}
                            <button
                                onClick={() => handleUpdateSettings({ scheduleMode: 'private' })}
                                className={`flex-1 flex flex-col p-5 rounded-2xl border transition-all text-left group ${settings.scheduleMode === 'private' ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20' : 'bg-background hover:bg-muted/50 border-border'}`}
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${settings.scheduleMode === 'private' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:bg-muted-foreground/20'}`}><Lock className="w-4 h-4" /></div>
                                    <span className="font-bold text-foreground">Приватный</span>
                                </div>
                                <span className="text-xs text-muted-foreground leading-relaxed">Клиенты не видят календарь. Запись только с вашего подтверждения.</span>
                            </button>
                            {/* Readonly */}
                            <button
                                onClick={() => handleUpdateSettings({ scheduleMode: 'readonly' })}
                                className={`flex-1 flex flex-col p-5 rounded-2xl border transition-all text-left group ${settings.scheduleMode === 'readonly' ? 'bg-amber-500/5 border-amber-500 shadow-sm ring-1 ring-amber-500/20' : 'bg-background hover:bg-muted/50 border-border'}`}
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${settings.scheduleMode === 'readonly' ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground group-hover:bg-muted-foreground/20'}`}><Eye className="w-4 h-4" /></div>
                                    <span className="font-bold text-foreground">Просмотр</span>
                                </div>
                                <span className="text-xs text-muted-foreground leading-relaxed">Окна видны, но для брони кленту нужно написать вам сообщение.</span>
                            </button>
                            {/* Open */}
                            <button
                                onClick={() => handleUpdateSettings({ scheduleMode: 'booking' })}
                                className={`flex-1 flex flex-col p-5 rounded-2xl border transition-all text-left group ${settings.scheduleMode === 'booking' ? 'bg-green-500/5 border-green-500 shadow-sm ring-1 ring-green-500/20' : 'bg-background hover:bg-muted/50 border-border'}`}
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${settings.scheduleMode === 'booking' ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground group-hover:bg-muted-foreground/20'}`}><Check className="w-4 h-4" /></div>
                                    <span className="font-bold text-foreground">Открыто</span>
                                </div>
                                <span className="text-xs text-muted-foreground leading-relaxed">Автоматическая самостоятельная запись в свободные слоты.</span>
                            </button>
                        </div>
                    </div>

                    {/* Section 2: Глобальные настройки */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-foreground">Глобальные лимиты</h2>
                                <p className="text-sm text-muted-foreground">Применяются для всех шаблонов по умолчанию</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-foreground/90 mb-2">Длительность сессии (мин)</label>
                                <select value={settings.defaultSessionDuration} onChange={e => handleUpdateSettings({ defaultSessionDuration: Number(e.target.value) })} className="w-full bg-background border border-border rounded-xl px-4 py-3 min-h-[48px] text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all">
                                    <option value={50}>50 минут</option><option value={60}>60 минут (1 час)</option><option value={80}>80 минут</option><option value={90}>90 минут (1.5 часа)</option>
                                    <option value={120}>120 минут (2 часа)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-foreground/90 mb-2">Перерыв между сессиями (мин)</label>
                                <select value={settings.sessionBreak} onChange={e => handleUpdateSettings({ sessionBreak: Number(e.target.value) })} className="w-full bg-background border border-border rounded-xl px-4 py-3 min-h-[48px] text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all">
                                    <option value={0}>Без перерыва</option><option value={5}>5 минут</option><option value={10}>10 минут</option><option value={15}>15 минут</option><option value={30}>30 минут</option>
                                </select>
                            </div>
                            {/* Removed buffer and horizon settings because they might not be part of the UI but we can keep maxSessions */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-foreground/90 mb-2">Максимум сессий в день</label>
                                <select value={settings.maxSessionsPerDay || 0} onChange={e => handleUpdateSettings({ maxSessionsPerDay: Number(e.target.value) === 0 ? null : Number(e.target.value) })} className="w-full bg-background border border-border rounded-xl px-4 py-3 min-h-[48px] text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all">
                                    <option value={0}>Без лимита</option><option value={2}>2 сессии</option><option value={3}>3 сессии</option><option value={4}>4 сессии</option><option value={5}>5 сессий</option><option value={6}>6 сессий</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Шаблоны расписания */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                    <Layers className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold tracking-tight text-foreground">Правила работы</h2>
                                    <p className="text-sm text-muted-foreground">Шаблоны ваших регулярных часов</p>
                                </div>
                            </div>
                            <button onClick={() => setShowNewRule(true)} className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl shadow-sm hover:bg-primary/90 transition-all font-semibold text-sm active:scale-95">
                                <Plus className="w-4 h-4" /> Шаблон
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {rules.length === 0 && (
                                <div className="p-8 border border-dashed border-border rounded-2xl text-center">
                                    <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                                    <h3 className="font-bold text-foreground mb-1">Нет активных правил</h3>
                                    <p className="text-sm text-muted-foreground">Настройте свои рабочие часы, создав первый шаблон</p>
                                </div>
                            )}
                            {rules.map(rule => {
                                const ruleSlots = slots.filter(s => s.scheduleRuleId === rule.id && !(s.endDate && new Date(s.endDate) < today));
                                return (
                                    <div key={rule.id} className="border border-border rounded-2xl overflow-hidden hover:border-primary/20 transition-all shadow-sm group">
                                        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/5">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (rule.color || '#4F46E5') + '20', color: rule.color || '#4F46E5' }}>                                                    <Layers className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-lg text-foreground flex items-center gap-2 truncate">
                                                        {rule.name}
                                                        {!rule.isActive && <span className="bg-destructive/10 text-destructive text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0">ОТКЛЮЧЕНО</span>}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground font-medium mt-0.5 truncate">
                                                        {rule.format === 'online' ? 'Онлайн' : rule.format === 'offline' ? 'Офлайн' : 'Смешанный'} • {rule.duration} мин
                                                        {rule.endDate && ` • До ${new Date(rule.endDate).toLocaleDateString()}`}
                                                    </div>
                                                </div>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-card rounded-xl border border-border p-1 shadow-sm shrink-0">
                                                    <button onClick={() => setEditingRule(rule)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all" title="Настройки"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => { setShowCloneModal(rule); setCloneData({ name: `${rule.name} (копия)`, startDate: '', endDate: '' }); }} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all" title="Копировать"><Copy className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDeleteRule(rule.id)} className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-all" title="Удалить"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                                <div className="shrink-0 ml-2">
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" className="sr-only peer" checked={rule.isActive} onChange={() => handleUpdateActive(rule)} />
                                                        <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-5 border-t border-border/50 bg-background">
                                            <div className="space-y-3">
                                                {DAY_LABELS.map((dayName, dayIndex) => {
                                                    const daySlots = ruleSlots.filter(s => s.dayOfWeek === dayIndex).sort((a,b)=>a.startTime.localeCompare(b.startTime));
                                                    if (daySlots.length === 0) return null;
                                                    return (
                                                        <div key={dayIndex} className="flex gap-4 items-start">
                                                            <div className="w-8 font-semibold text-sm text-foreground uppercase pt-1 shrink-0">{dayName}</div>
                                                            <div className="flex-1 flex flex-wrap gap-2">
                                                                {daySlots.map(s => (
                                                                    <div key={s.id} className="group/slot flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 border border-border/50 rounded-lg text-sm font-bold hover:border-border transition-all">
                                                                        <span>{s.startTime} – {s.endTime}</span>
                                                                        <button onClick={() => setEditingSlot(s)} className="text-muted-foreground hover:text-foreground md:opacity-0 group-hover/slot:opacity-100 transition-opacity"><Edit2 className="w-3.5 h-3.5" /></button>
                                                                        <button onClick={() => rmSlot(s.id)} className="text-muted-foreground hover:text-destructive md:opacity-0 group-hover/slot:opacity-100 transition-opacity"><X className="w-3.5 h-3.5" /></button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {ruleSlots.length === 0 && <div className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-xl">Часы работы не заданы</div>}
                                            </div>
                                            <button onClick={() => { setSelectedRuleId(rule.id); setShowNewSlot(true); }} className="mt-4 w-full py-2 border border-dashed border-border rounded-xl text-sm font-semibold text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all flex items-center justify-center gap-2">
                                                <Plus className="w-4 h-4" />Добавить часы
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Section 4: Блокировки */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                                    <Palmtree className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold tracking-tight text-foreground">Отпуска и блокировки</h2>
                                    <p className="text-sm text-muted-foreground">Временное скрытие слотов</p>
                                </div>
                            </div>
                            <button onClick={() => setShowNewBlock(true)} className="flex items-center gap-1.5 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-xl shadow-sm hover:bg-secondary/80 transition-all font-semibold text-sm active:scale-95">
                                <Plus className="w-4 h-4" /> Добавить
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {blocks.length === 0 && (
                                <div className="col-span-full p-6 text-center text-sm font-medium text-muted-foreground">Нет активных блоков</div>
                            )}
                            {blocks.map(block => {
                                const b = new Date(block.startDate);
                                const e = new Date(block.endDate);
                                const Icon = BLOCK_ICONS[block.type] || Coffee;
                                return (
                                    <div key={block.id} className="p-4 bg-background border border-border rounded-2xl shadow-sm flex items-center justify-between gap-3 group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-8 h-8 bg-muted text-muted-foreground rounded-xl flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></div>
                                            <div className="truncate">
                                                <div className="text-sm font-bold text-foreground truncate">{BLOCK_LABELS[block.type] || 'Блок'}</div>
                                                <div className="text-xs text-muted-foreground">{b.toLocaleDateString()} — {e.toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                        <button onClick={() => rmBlock(block.id)} className="p-2 bg-muted/50 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all shrink-0 md:opacity-0 group-hover:opacity-100">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Column: Client Preview */}
                <div className="hidden lg:block w-full lg:w-[35%] sticky top-8">
                    <div className="bg-gradient-to-b from-card to-card/50 border border-border rounded-[32px] p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
                        <div className="relative z-10 space-y-6">
                            {/* App Header simulation */}
                            <div className="flex items-center justify-between border-b border-border/50 pb-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border text-muted-foreground">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-foreground">Запись на прием</div>
                                        <div className="text-[10px] text-muted-foreground">{settings.scheduleMode === 'private' ? 'Приватный режим' : 'Календарь'}</div>
                                    </div>
                                </div>
                                <button onClick={openPreview} className="text-primary hover:bg-primary/5 p-2 rounded-xl transition-colors"><RefreshCw className="w-4 h-4" /></button>
                            </div>

                            {/* App Body simulation */}
                            <div className="min-h-[300px]">
                                {settings.scheduleMode === 'private' ? (
                                    <div className="text-center py-12 px-4">
                                        <Lock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                                        <h3 className="font-bold text-lg mb-2">Запись временно закрыта</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">Прямо сейчас онлайн бронирование недоступно. Свяжитесь со специалистом лично.</p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-sm font-bold text-foreground mb-3">Свободные даты</p>
                                        <div className="grid grid-cols-7 gap-1 mb-6">
                                            {previewDates.length === 0 ? (
                                                <div className="col-span-7 flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" /></div>
                                            ) : (
                                                previewDates.map(dateStr => {
                                                    const [, m, d] = dateStr.split('-');
                                                    const isSelected = previewSelectedDate === dateStr;
                                                    return (
                                                        <button key={dateStr} onClick={() => selectPreviewDate(dateStr)} className={`aspect-square flex items-center justify-center rounded-xl text-xs font-bold transition-all ${isSelected ? 'bg-primary text-primary-foreground shadow-md scale-105' : 'bg-muted/30 text-muted-foreground hover:bg-muted/80'}`}>
                                                            {Number(d)}
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                        {previewSelectedDate && (
                                            <div>
                                                <p className="text-sm font-bold text-foreground mb-3">Время сессии</p>
                                                {previewLoading ? (
                                                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" /></div>
                                                ) : previewTimes.length === 0 ? (
                                                    <div className="text-center py-4 text-sm text-muted-foreground">Нет слотов на эту дату</div>
                                                ) : (
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {previewTimes.map(t => (
                                                            <div key={t.time} className="p-3 bg-background border border-border rounded-xl text-center shadow-sm cursor-pointer hover:border-primary/50 transition-colors">
                                                                <div className="text-sm font-bold text-foreground">{t.time}</div>
                                                                <div className="text-[10px] text-muted-foreground mt-1">{t.format === 'offline' ? 'Кабинет' : 'Онлайн'}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>


{/* ── Modals ── */}

            {/* New Rule Modal */}
            {showNewRule && <Modal title="Новое правило" onClose={() => setShowNewRule(false)} onSubmit={handleCreateRule}>
                <Field label="Название">
                    <input type="text" value={newRuleData.name} onChange={e => setNewRuleData(d => ({ ...d, name: e.target.value }))} placeholder="Основное расписание" className="inp" autoFocus />
                </Field>
                <Field label="Цвет">
                    <div className="flex gap-2 flex-wrap">
                        {RULE_COLORS.map(c => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setNewRuleData(d => ({ ...d, color: c }))}
                                className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center ${newRuleData.color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'}`}
                                style={{ backgroundColor: c }}
                            >
                                {newRuleData.color === c && <Check className="w-4 h-4 text-white" />}
                            </button>
                        ))}
                    </div>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Действует с"><DatePicker value={newRuleData.startDate} onChange={d => setNewRuleData(s => ({ ...s, startDate: d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : '' }))} /></Field>
                    <Field label="Действует по"><DatePicker value={newRuleData.endDate} onChange={d => setNewRuleData(s => ({ ...s, endDate: d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : '' }))} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Формат">
                        <select value={newRuleData.format} onChange={e => setNewRuleData(s => ({ ...s, format: e.target.value }))} className="inp bg-white">
                            <option value="online">Онлайн</option>
                            <option value="offline">Кабинет</option>
                            <option value="both">Онлайн + Кабинет</option>
                        </select>
                    </Field>
                    <Field label="Аудитория">
                        <select value={newRuleData.audienceFilter} onChange={e => setNewRuleData(s => ({ ...s, audienceFilter: e.target.value }))} className="inp bg-white">
                            <option value="all">Все клиенты</option>
                            <option value="regular">Только мои постоянные</option>
                            <option value="new">Только новые (извне)</option>
                        </select>
                    </Field>
                </div>
                {(newRuleData.format === 'offline' || newRuleData.format === 'both') && (
                    <Field label="Кабинет">
                        <select value={newRuleData.addressId} onChange={e => setNewRuleData(s => ({ ...s, addressId: e.target.value }))} className="inp bg-white">
                            <option value="">— Выберите —</option>
                            {addresses.map(a => <option key={a.id} value={a.id}>{a.name} ({a.address})</option>)}
                        </select>
                    </Field>
                )}
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Длительность (мин)">
                        <input type="number" min={15} max={180} value={newRuleData.duration} onChange={e => setNewRuleData(s => ({ ...s, duration: Number(e.target.value) }))} className="inp" />
                    </Field>
                    <Field label="Перерыв между слотами (мин)">
                        <input type="number" min={0} max={120} value={newRuleData.breakDuration} onChange={e => setNewRuleData(s => ({ ...s, breakDuration: Number(e.target.value) }))} className="inp" />
                    </Field>
                </div>
            </Modal>}

            {/* Edit Rule Modal */}
            {editingRule && <Modal title="Редактировать правило" onClose={() => setEditingRule(null)} onSubmit={handleSaveEditRule}>
                <Field label="Название">
                    <input type="text" value={editingRule.name} onChange={e => setEditingRule(r => r ? { ...r, name: e.target.value } : r)} className="inp" />
                </Field>
                <Field label="Цвет">
                    <div className="flex gap-2 flex-wrap">
                        {RULE_COLORS.map(c => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setEditingRule(r => r ? { ...r, color: c } : r)}
                                className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center ${editingRule.color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'}`}
                                style={{ backgroundColor: c }}
                            >
                                {editingRule.color === c && <Check className="w-4 h-4 text-white" />}
                            </button>
                        ))}
                    </div>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Действует с"><DatePicker value={editingRule.startDate ? new Date(editingRule.startDate).toISOString().split('T')[0] : ''} onChange={d => setEditingRule(r => r ? { ...r, startDate: d } : r)} /></Field>
                    <Field label="Действует по"><DatePicker value={editingRule.endDate ? new Date(editingRule.endDate).toISOString().split('T')[0] : ''} onChange={d => setEditingRule(r => r ? { ...r, endDate: d } : r)} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Формат">
                        <select value={editingRule.format} onChange={e => setEditingRule(r => r ? { ...r, format: e.target.value } : r)} className="inp bg-white">
                            <option value="online">Онлайн</option>
                            <option value="offline">Кабинет</option>
                            <option value="both">Онлайн + Кабинет</option>
                        </select>
                    </Field>
                    <Field label="Аудитория">
                        <select value={editingRule.audienceFilter} onChange={e => setEditingRule(r => r ? { ...r, audienceFilter: e.target.value } : r)} className="inp bg-white">
                            <option value="all">Все клиенты</option>
                            <option value="regular">Только мои постоянные</option>
                            <option value="new">Только новые (извне)</option>
                        </select>
                    </Field>
                </div>
                {(editingRule.format === 'offline' || editingRule.format === 'both') && (
                    <Field label="Кабинет">
                        <select value={editingRule.addressId || ''} onChange={e => setEditingRule(r => r ? { ...r, addressId: e.target.value } : r)} className="inp bg-white">
                            <option value="">— Выберите —</option>
                            {addresses.map(a => <option key={a.id} value={a.id}>{a.name} ({a.address})</option>)}
                        </select>
                    </Field>
                )}
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Длительность (мин)">
                        <input type="number" min={15} max={180} value={editingRule.duration} onChange={e => setEditingRule(r => r ? { ...r, duration: Number(e.target.value) } : r)} className="inp" />
                    </Field>
                    <Field label="Перерыв (мин)">
                        <input type="number" min={0} max={120} value={editingRule.breakDuration} onChange={e => setEditingRule(r => r ? { ...r, breakDuration: Number(e.target.value) } : r)} className="inp" />
                    </Field>
                </div>
            </Modal>}

            {/* Clone Rule Modal */}
            {showCloneModal && <Modal title={`Клонировать: ${showCloneModal.name}`} onClose={() => setShowCloneModal(null)} onSubmit={handleCloneRule}>
                <Field label="Название нового правила">
                    <input type="text" value={cloneData.name} onChange={e => setCloneData(d => ({ ...d, name: e.target.value }))} className="inp" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Действует с"><DatePicker value={cloneData.startDate} onChange={d => setCloneData(cd => ({ ...cd, startDate: d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : '' }))} /></Field>
                    <Field label="Действует по"><DatePicker value={cloneData.endDate} onChange={d => setCloneData(cd => ({ ...cd, endDate: d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : '' }))} /></Field>
                </div>
                <div className="bg-muted/30 p-3 rounded-xl border border-border/50 text-sm text-muted-foreground">
                    <div className="font-semibold text-foreground mb-1">Будет скопировано:</div>
                    {showCloneModal.slotCount} слотов ({showCloneModal.slots.slice(0, 3).map(s => `${DAY_LABELS[s.dayOfWeek]} ${s.startTime}`).join(', ')}{showCloneModal.slotCount > 3 ? '...' : ''})
                </div>
            </Modal>}

            {/* Client Preview Modal */}
            {showPreview && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-5 border-b border-border/50 bg-muted/10">
                            <div className="flex items-center gap-2">
                                <Eye className="w-5 h-5 text-primary" />
                                <h2 className="text-lg font-bold tracking-tight">Глазами клиента</h2>
                            </div>
                            <button onClick={() => { setShowPreview(false); setPreviewSelectedDate(null); setPreviewDates([]); setPreviewTimes([]); }} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-5 overflow-auto telegram-miniapp-scrollbar-hide">
                            {previewLoading && !previewSelectedDate ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : previewDates.length === 0 ? (
                                <div className="text-center py-8">
                                    <EyeOff className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="text-sm text-muted-foreground font-semibold">Нет доступных дат</p>
                                    <p className="text-xs text-muted-foreground mt-1">Клиент увидит пустой календарь. Добавьте слоты!</p>
                                </div>
                            ) : (
                                <>
                                    <p className="text-xs text-muted-foreground mb-3 font-medium">Доступные даты этого месяца:</p>
                                    <div className="grid grid-cols-7 gap-1.5 mb-4">
                                        {previewDates.map(dateStr => {
                                            const [, m, d] = dateStr.split('-');
                                            const isSelected = previewSelectedDate === dateStr;
                                            return (
                                                <button
                                                    key={dateStr}
                                                    onClick={() => selectPreviewDate(dateStr)}
                                                    className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                                                        isSelected
                                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                                            : 'bg-accent/10 text-accent hover:bg-accent/20'
                                                    }`}
                                                >
                                                    {Number(d)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {previewSelectedDate && (
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-2 font-medium">
                                                Доступные слоты на {new Date(previewSelectedDate + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}:
                                            </p>
                                            {previewLoading ? (
                                                <div className="flex items-center justify-center py-6">
                                                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                                </div>
                                            ) : previewTimes.length === 0 ? (
                                                <p className="text-sm text-muted-foreground text-center py-4">Все слоты заняты</p>
                                            ) : (
                                                <div className="grid grid-cols-3 gap-2">
                                                    {previewTimes.map(t => (
                                                        <div key={t.time} className="px-3 py-2.5 bg-accent/5 border border-accent/20 rounded-xl text-center">
                                                            <div className="text-sm font-bold text-foreground">{t.time}</div>
                                                            <div className="text-[10px] text-muted-foreground">{t.format === 'offline' ? '🏢 Кабинет' : '🖥️ Онлайн'}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

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
                {/* Rule indicator */}
                {rules.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: (selectedRuleId ? rules.find(r => r.id === selectedRuleId)?.color : rules[0]?.color) || '#4F46E5' }} />
                        Правило: <span className="font-semibold text-foreground">{selectedRuleId ? rules.find(r => r.id === selectedRuleId)?.name : rules[0]?.name}</span>
                    </div>
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
            <div className="bg-card rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
