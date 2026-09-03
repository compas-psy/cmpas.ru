'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Plus, X, Calendar, Trash2, Palmtree, User, Coffee, Edit2, Lock, Eye,
    CalendarCheck, RefreshCw, AlertCircle, ChevronDown, ChevronUp,
    Clock, Minus, Shield, Zap, Sparkles, Copy, Layers, EyeOff,
    Tag, MoreHorizontal, Check, Loader2, Monitor, Building2, Shuffle
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
import { useAttestationGate } from '@/components/legal/useAttestationGate';
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
import { ShareButton } from '@/components/psidairy/ShareSheet';
import { humanizeUrl } from '@/lib/share/buildShareUrls';

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

function BookingLinkCard({ psychologistId, isPrivate }: { psychologistId: string; isPrivate: boolean }) {
    // §5.1 (O-260829): human-readable /u/<slug> link instead of the raw id.
    // Starts on the old id-based URL (always valid) and swaps in the
    // slug-based one once resolved/lazily created — no loading flicker either way.
    const [bookingUrl, setBookingUrl] = useState(`https://cmpas.ru/bot/book/${psychologistId}`);

    useEffect(() => {
        let cancelled = false;
        import('../actions/booking-link').then(({ getMyBookingUrl }) => {
            getMyBookingUrl().then(url => { if (!cancelled) setBookingUrl(url); }).catch(() => { });
        });
        return () => { cancelled = true; };
    }, [psychologistId]);

    return (
        <div className={`bg-card border border-border rounded-2xl shadow-card p-5 ${isPrivate ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-2 mb-3">
                <CalendarCheck className="w-4 h-4 text-primary" />
                <div>
                    <h3 className="text-[14px] font-bold text-foreground">Ссылка на самозапись</h3>
                    <p className="text-[11px] text-muted-foreground">
                        {isPrivate ? 'Недоступна в приватном режиме' : 'Поделитесь ссылкой с клиентами'}
                    </p>
                </div>
            </div>
            {isPrivate ? (
                <div className="flex items-center gap-2 bg-muted/30 border border-border/50 rounded-xl px-3 py-2.5">
                    <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-[12px] text-muted-foreground">Включите режим «Просмотр» или «Запись» чтобы активировать ссылку</span>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-2 bg-sage-50 border border-sage-200 rounded-xl px-3 py-2.5">
                        <span className="flex-1 text-[13px] font-medium text-foreground truncate">{humanizeUrl(bookingUrl)}</span>
                    </div>
                    <ShareButton
                        url={bookingUrl}
                        text="Запишитесь на сессию:"
                        icon={<Copy className="w-3.5 h-3.5" />}
                        className="w-full flex items-center justify-center gap-1.5 mt-3 px-3 py-2.5 rounded-xl text-[12px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    />
                </>
            )}
        </div>
    );
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
    const { guard: attestationGuard, modal: attestationModal } = useAttestationGate();
    const [showNewSlot, setShowNewSlot] = useState(false);
    const [showNewBlock, setShowNewBlock] = useState(false);
    const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
    const [showExpired, setShowExpired] = useState(false);
    const [hoveredCell, setHoveredCell] = useState<{ day: number; time: string } | null>(null);

    // Schedule Rules state
    const [showNewRule, setShowNewRule] = useState(false);
    const initialRuleData = {
        name: '', color: RULE_COLORS[0], format: 'online', addressId: '', duration: 50, breakDuration: 15, audienceFilter: 'all', startDate: '', endDate: '',
        daysOfWeek: [0, 1, 2, 3, 4] as number[], startTime: '09:00', endTime: '18:00',
        hasLunch: false, lunchStart: '13:00', lunchEnd: '14:00',
    };
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

    // Auto-load preview when psychologistId becomes available
    useEffect(() => {
        if (psychologistId && !loading && settings.scheduleMode !== 'private') {
            (async () => {
                setPreviewLoading(true);
                try {
                    const now = new Date();
                    const dates = await getAvailableDates(psychologistId, now.getFullYear(), now.getMonth(), true);
                    setPreviewDates(dates);
                } catch { /* silent */ }
                setPreviewLoading(false);
            })();
        }
    }, [psychologistId, loading, settings.scheduleMode]);

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
        if (!newRuleData.startDate || !newRuleData.endDate) { toast.error('Укажите даты действия'); return; }
        if (newRuleData.daysOfWeek.length === 0) { toast.error('Выберите дни недели'); return; }
        if (newRuleData.startTime >= newRuleData.endTime) { toast.error('Некорректное время'); return; }
        if (newRuleData.hasLunch && (newRuleData.lunchStart <= newRuleData.startTime || newRuleData.lunchEnd >= newRuleData.endTime || newRuleData.lunchStart >= newRuleData.lunchEnd)) {
            toast.error('Некорректное время обеда'); return;
        }
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
        if (res.success && res.data?.id) {
            // Now create slots for this rule
            try {
                await createAvailabilitySlot({
                    startDate: newRuleData.startDate,
                    endDate: newRuleData.endDate,
                    daysOfWeek: newRuleData.daysOfWeek,
                    startTime: newRuleData.startTime,
                    endTime: newRuleData.endTime,
                    duration: newRuleData.duration,
                    hasLunch: newRuleData.hasLunch,
                    lunchStart: newRuleData.lunchStart,
                    lunchEnd: newRuleData.lunchEnd,
                    format: newRuleData.format,
                    addressId: newRuleData.addressId || '',
                    scheduleRuleId: res.data.id,
                });
            } catch { /* slots creation failed but rule exists */ }
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
        <div className="space-y-8 pb-12 max-w-[1400px] mx-auto overflow-x-hidden">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Расписание</h1>
                    <p className="text-muted-foreground text-sm mt-1">Гибкие правила доступности и самозаписи</p>
                </div>
            </div>

            {/* Booking link — visible on phones too; on desktop it's already in the sidebar below */}
            {psychologistId && (
                <div className="lg:hidden">
                    <BookingLinkCard psychologistId={psychologistId} isPrivate={settings.scheduleMode === 'private'} />
                </div>
            )}

            {/* Schedule Mode Indicator */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                    { mode: 'private', Icon: Lock, label: 'Приватный', desc: 'Клиенты не видят расписание' },
                    { mode: 'preview', Icon: Eye, label: 'Просмотр', desc: 'Клиенты видят окна, но не могут записаться' },
                    { mode: 'booking', Icon: CalendarCheck, label: 'Запись', desc: 'Клиенты могут записываться самостоятельно' },
                ].map(m => (
                    <button key={m.mode}
                        onClick={async () => {
                            setSavingMode(true);
                            try {
                                await attestationGuard(() => updateSettings({ scheduleMode: m.mode }));
                                setSettingsState(s => ({ ...s, scheduleMode: m.mode }));
                                toast.success('Режим обновлён');
                            } catch (err) {
                                if (!(err instanceof Error && err.message === 'Отменено')) toast.error('Ошибка');
                            }
                            setSavingMode(false);
                        }}
                        disabled={savingMode}
                        className={`p-4 rounded-2xl border text-left transition-all ${settings.scheduleMode === m.mode ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card hover:bg-sage-50'}`}>
                        <div className="flex items-center gap-3">
                            <m.Icon className="w-5 h-5 text-muted-foreground" strokeWidth={1.8} />
                            <div>
                                <div className="text-[14px] font-bold text-foreground">{m.label}</div>
                                <div className="text-[11px] text-muted-foreground">{m.desc}</div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* Left Column */}
                <div className="w-full lg:w-[65%] space-y-6">
                    
                    {/* Section 1: Глобальные лимиты */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <Clock className="w-5 h-5 text-muted-foreground" />
                                <h2 className="text-lg font-bold text-foreground">Глобальные лимиты</h2>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[13px] font-semibold text-muted-foreground mb-2">Длительность сессии</label>
                                <select value={settings.defaultSessionDuration} onChange={e => handleUpdateSettings({ defaultSessionDuration: Number(e.target.value) })} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all">
                                    <option value={50}>50 минут</option><option value={60}>60 минут</option><option value={80}>80 минут</option><option value={90}>90 минут</option>
                                    <option value={120}>120 минут</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[13px] font-semibold text-muted-foreground mb-2">Перерыв между сессиями</label>
                                <select value={settings.sessionBreak} onChange={e => handleUpdateSettings({ sessionBreak: Number(e.target.value) })} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all">
                                    <option value={0}>Без перерыва</option><option value={5}>5 минут</option><option value={10}>10 минут</option><option value={15}>15 минут</option><option value={30}>30 минут</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[13px] font-semibold text-muted-foreground mb-2">Максимум сессий в день</label>
                                <select value={settings.maxSessionsPerDay || 0} onChange={e => handleUpdateSettings({ maxSessionsPerDay: Number(e.target.value) === 0 ? null : Number(e.target.value) })} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all">
                                    <option value={0}>Без лимита</option><option value={2}>2 сессии</option><option value={3}>3 сессии</option><option value={4}>4 сессии</option><option value={5}>5 сессий</option><option value={6}>6 сессий</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Правила доступности */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <Layers className="w-5 h-5 text-muted-foreground" />
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">Правила доступности</h2>
                                    <p className="text-[12px] text-muted-foreground">Правила применяются сверху вниз. Перетаскивайте для изменения порядка.</p>
                                </div>
                            </div>
                            <button onClick={() => setShowNewRule(true)} className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl shadow-sm hover:bg-forest-700 transition-all font-bold text-sm active:scale-95">
                                <Plus className="w-4 h-4" /> Добавить правило
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
                                // Compute active days
                                const activeDays = Array.from(new Set(ruleSlots.map(s => s.dayOfWeek))).sort();
                                // Compute time range from slots
                                const allStarts = ruleSlots.map(s => s.startTime).filter(Boolean);
                                const allEnds = ruleSlots.map(s => s.endTime).filter(Boolean);
                                const minTime = allStarts.length > 0 ? allStarts.sort()[0] : '--:--';
                                const maxTime = allEnds.length > 0 ? allEnds.sort().reverse()[0] : '--:--';
                                // Format label
                                const FormatIcon = rule.format === 'online' ? Monitor : rule.format === 'offline' ? Building2 : Shuffle;
                                const formatLabel = rule.format === 'online' ? 'Онлайн' : rule.format === 'offline' ? 'Офлайн' : 'Гибрид';
                                const audienceLabel = rule.audienceFilter === 'all' ? 'Все клиенты' : rule.audienceFilter === 'new' ? 'Только новые' : 'Только постоянные';
                                // Day range title
                                const dayRangeTitle = activeDays.length > 0
                                    ? activeDays.length === 1
                                        ? DAY_LABELS_FULL[activeDays[0]]
                                        : `${DAY_LABELS_FULL[activeDays[0]]} – ${DAY_LABELS_FULL[activeDays[activeDays.length - 1]]}`
                                    : rule.name;

                                return (
                                    <div key={rule.id} className={`border rounded-2xl overflow-hidden transition-all shadow-sm ${rule.isActive ? 'border-border hover:border-primary/20' : 'border-border/50 opacity-60'}`}>
                                        <div className="p-5 flex flex-col gap-3">
                                            {/* Row 1: icon + format badge + title + time range + duration + break + audience */}
                                            <div className="flex flex-col sm:flex-row items-start gap-3">
                                                {/* Format icon */}
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (rule.color || '#4F46E5') + '15' }}>
                                                    <FormatIcon className="w-5 h-5" style={{ color: rule.color || '#4F46E5' }} strokeWidth={1.8} />
                                                </div>
                                                <div className="flex-1 min-w-0 w-full">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold" style={{ backgroundColor: (rule.color || '#4F46E5') + '20', color: rule.color || '#4F46E5' }}>
                                                            {formatLabel}
                                                        </span>
                                                        <span className="text-[14px] sm:text-[15px] font-bold text-foreground truncate">{dayRangeTitle}</span>
                                                        {!rule.isActive && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive">ОТКЛ</span>}
                                                        {(rule.startDate || rule.endDate) && (
                                                            <span className="text-[11px] text-muted-foreground font-medium">
                                                                {rule.startDate ? new Date(rule.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '…'}
                                                                {' – '}
                                                                {rule.endDate ? new Date(rule.endDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '…'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Row 2: Day chips + time info */}
                                                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                                                        {DAY_LABELS.map((d, i) => (
                                                            <span key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${activeDays.includes(i) ? 'text-primary-foreground' : 'bg-muted/50 text-muted-foreground/50'}`}
                                                                style={activeDays.includes(i) ? { backgroundColor: rule.color || '#4F46E5' } : {}}>
                                                                {d}
                                                            </span>
                                                        ))}
                                                        <span className="text-[11px] text-muted-foreground ml-1 shrink-0">{audienceLabel}</span>
                                                    </div>
                                                    {/* Mobile time/duration info */}
                                                    <div className="flex items-center gap-3 mt-2 text-[12px] text-muted-foreground sm:hidden">
                                                        <span className="font-bold text-foreground tabular-nums">{minTime} – {maxTime}</span>
                                                        <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {rule.duration} мин</span>
                                                        <span className="flex items-center gap-0.5"><Coffee className="w-3 h-3" /> {rule.breakDuration} мин</span>
                                                    </div>
                                                </div>
                                                {/* Right: time + duration + break + toggles */}
                                                <div className="shrink-0 flex items-center gap-2 sm:gap-3 self-start sm:self-center">
                                                    <div className="text-right hidden sm:block">
                                                        <div className="text-[14px] font-bold text-foreground tabular-nums">{minTime} – {maxTime}</div>
                                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 justify-end">
                                                            <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {rule.duration} мин</span>
                                                            <span className="flex items-center gap-0.5"><Coffee className="w-3 h-3" /> {rule.breakDuration} мин</span>
                                                        </div>
                                                    </div>
                                                    {/* Toggle */}
                                                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                                        <input type="checkbox" className="sr-only peer" checked={rule.isActive} onChange={() => handleUpdateActive(rule)} />
                                                        <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                                                    </label>
                                                    {/* Actions */}
                                                    <div className="flex gap-0.5">
                                                        <button onClick={() => setEditingRule(rule)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all" title="Настройки"><Edit2 className="w-4 h-4" /></button>
                                                        <button onClick={() => handleDeleteRule(rule.id)} className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-all" title="Удалить"><Trash2 className="w-4 h-4" /></button>
                                                        <button onClick={() => { setSelectedRuleId(rule.id); setShowNewSlot(true); }} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all" title="Добавить часы"><Plus className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            </div>
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

                {/* Right Column */}
                <div className="hidden lg:block w-full lg:w-[35%] space-y-5 sticky top-8">
                    {/* Card 1: Client Preview */}
                    <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
                        <div className="px-5 pt-5 flex items-center justify-between">
                            <div>
                                <h3 className="text-[15px] font-bold text-foreground">Предпросмотр для клиентов</h3>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Так клиенты видят вашу самозапись</p>
                            </div>
                            <button onClick={openPreview} className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors"><RefreshCw className="w-4 h-4" /></button>
                        </div>
                        <div className="p-5">
                            {settings.scheduleMode === 'private' ? (
                                <div className="text-center py-8 px-4">
                                    <Lock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="text-sm font-bold mb-1">Запись временно закрыта</p>
                                    <p className="text-xs text-muted-foreground">Режим «Приватный»: клиенты не видят расписание</p>
                                </div>
                            ) : (
                                <div>
                                    {/* Mini calendar header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <button onClick={() => {
                                            const d = new Date();
                                            d.setMonth(d.getMonth() - 1);
                                            // simplified: just reload current month
                                            openPreview();
                                        }} className="p-1 hover:bg-muted rounded-lg transition-colors"><ChevronUp className="w-4 h-4 -rotate-90" /></button>
                                        <span className="text-sm font-bold text-foreground">{new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())}</span>
                                        <button onClick={openPreview} className="p-1 hover:bg-muted rounded-lg transition-colors"><ChevronDown className="w-4 h-4 -rotate-90" /></button>
                                    </div>
                                    {/* Day headers */}
                                    <div className="grid grid-cols-7 gap-1 mb-1">
                                        {DAY_LABELS.map(d => (
                                            <div key={d} className="text-center text-[10px] font-bold text-muted-foreground/60">{d}</div>
                                        ))}
                                    </div>
                                    {/* Calendar days */}
                                    <div className="grid grid-cols-7 gap-1 mb-4">
                                        {previewDates.length === 0 ? (
                                            <div className="col-span-7 flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" /></div>
                                        ) : (
                                            previewDates.map(dateStr => {
                                                const [, , d] = dateStr.split('-');
                                                const isSelected = previewSelectedDate === dateStr;
                                                const isToday = dateStr === new Date().toISOString().split('T')[0];
                                                return (
                                                    <button key={dateStr} onClick={() => selectPreviewDate(dateStr)}
                                                        className={`aspect-square flex items-center justify-center rounded-lg text-[12px] font-bold transition-all ${isSelected ? 'bg-primary text-primary-foreground shadow-sm' : isToday ? 'ring-1 ring-primary text-primary bg-primary/5' : 'text-foreground hover:bg-muted'}`}>
                                                        {Number(d)}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                    {/* Selected date times */}
                                    {previewSelectedDate && (
                                        <div>
                                            <p className="text-[13px] font-bold text-foreground mb-2">
                                                {new Date(previewSelectedDate + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}
                                            </p>
                                            {previewLoading ? (
                                                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" /></div>
                                            ) : previewTimes.length === 0 ? (
                                                <p className="text-xs text-muted-foreground text-center py-3">Нет свободных слотов</p>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-2">
                                                    {previewTimes.map(t => (
                                                        <div key={t.time} className="px-3 py-2 bg-sage-50 border border-sage-200 rounded-xl text-center">
                                                            <span className="text-[14px] font-bold text-foreground tabular-nums">{t.time}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <button className="w-full mt-2 text-[12px] text-primary font-semibold hover:underline">Показать все доступные время</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Card 2: Booking Link */}
                    {psychologistId && <BookingLinkCard psychologistId={psychologistId} isPrivate={settings.scheduleMode === 'private'} />}

                    {/* Card 3: Statistics placeholder */}
                    <div className="bg-card border border-border rounded-2xl shadow-card p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[14px] font-bold text-foreground">Статистика самозаписи</h3>
                            <span className="text-[11px] text-muted-foreground bg-muted px-2 py-1 rounded-md font-medium">За 30 дней</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-foreground">—</div>
                                <div className="text-[11px] text-muted-foreground">Просмотры</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-foreground">—</div>
                                <div className="text-[11px] text-muted-foreground">Записи</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-foreground">—</div>
                                <div className="text-[11px] text-muted-foreground">Конверсия</div>
                            </div>
                        </div>
                        <a href="/diary/analytics" className="block mt-4 text-[12px] text-primary font-semibold hover:underline text-center">Перейти к аналитике →</a>
                    </div>
                </div>
            </div>


{/* ── Modals ── */}

            {/* New Rule Modal — unified: rule + days + time + lunch */}
            {showNewRule && <Modal title="Новое правило" onClose={() => setShowNewRule(false)} onSubmit={handleCreateRule}>
                <Field label="Название">
                    <input type="text" value={newRuleData.name} onChange={e => setNewRuleData(d => ({ ...d, name: e.target.value }))} placeholder="Основное расписание" className="inp" autoFocus />
                </Field>
                <Field label="Цвет">
                    <div className="flex gap-2 flex-wrap">
                        {RULE_COLORS.map(c => (
                            <button key={c} type="button" onClick={() => setNewRuleData(d => ({ ...d, color: c }))}
                                className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center ${newRuleData.color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'}`}
                                style={{ backgroundColor: c }}>
                                {newRuleData.color === c && <Check className="w-4 h-4 text-white" />}
                            </button>
                        ))}
                    </div>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Действует с"><DatePicker value={newRuleData.startDate} onChange={d => setNewRuleData(s => ({ ...s, startDate: d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : '' }))} /></Field>
                    <Field label="Действует по"><DatePicker value={newRuleData.endDate} onChange={d => setNewRuleData(s => ({ ...s, endDate: d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : '' }))} /></Field>
                </div>
                <Field label="Дни недели">
                    <div className="flex flex-wrap gap-2">
                        {DAY_LABELS.map((d, i) => (
                            <button key={i} type="button" onClick={() => setNewRuleData(s => ({ ...s, daysOfWeek: s.daysOfWeek.includes(i) ? s.daysOfWeek.filter(x => x !== i) : [...s.daysOfWeek, i].sort() }))}
                                className={`w-11 h-11 rounded-full text-sm font-semibold transition-all ${newRuleData.daysOfWeek.includes(i) ? 'text-white shadow-md' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                                style={newRuleData.daysOfWeek.includes(i) ? { backgroundColor: newRuleData.color } : {}}>
                                {d}
                            </button>
                        ))}
                    </div>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Начало рабочего дня"><TimePicker value={newRuleData.startTime} onChange={t => setNewRuleData(s => ({ ...s, startTime: t }))} /></Field>
                    <Field label="Конец рабочего дня"><TimePicker value={newRuleData.endTime} onChange={t => setNewRuleData(s => ({ ...s, endTime: t }))} /></Field>
                </div>
                <div className="bg-muted/30 p-4 rounded-2xl space-y-3 border border-border/50">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={newRuleData.hasLunch} onChange={e => setNewRuleData(s => ({ ...s, hasLunch: e.target.checked }))} className="w-5 h-5 rounded border-border accent-primary" />
                        <span className="text-sm font-semibold">Перерыв (Обед)</span>
                    </label>
                    {newRuleData.hasLunch && (
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Начало обеда"><TimePicker value={newRuleData.lunchStart} onChange={t => setNewRuleData(s => ({ ...s, lunchStart: t }))} /></Field>
                            <Field label="Конец обеда"><TimePicker value={newRuleData.lunchEnd} onChange={t => setNewRuleData(s => ({ ...s, lunchEnd: t }))} /></Field>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Формат">
                        <select value={newRuleData.format} onChange={e => setNewRuleData(s => ({ ...s, format: e.target.value }))} className="inp bg-white">
                            <option value="online">Онлайн</option><option value="offline">Кабинет</option><option value="both">Онлайн + Кабинет</option>
                        </select>
                    </Field>
                    <Field label="Аудитория">
                        <select value={newRuleData.audienceFilter} onChange={e => setNewRuleData(s => ({ ...s, audienceFilter: e.target.value }))} className="inp bg-white">
                            <option value="all">Все клиенты</option><option value="regular">Только постоянные</option><option value="new">Только новые</option>
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

            {/* Edit Rule Modal — unified like create */}
            {editingRule && (() => {
                const ruleSlots = slots.filter(s => s.scheduleRuleId === editingRule.id && !(s.endDate && new Date(s.endDate) < today));
                const activeDays = Array.from(new Set(ruleSlots.map(s => s.dayOfWeek))).sort();
                const allStarts = ruleSlots.map(s => s.startTime).filter(Boolean).sort();
                const allEnds = ruleSlots.map(s => s.endTime).filter(Boolean).sort().reverse();
                const minTime = allStarts[0] || '09:00';
                const maxTime = allEnds[0] || '18:00';
                return (
                <Modal title="Редактировать правило" onClose={() => setEditingRule(null)} onSubmit={handleSaveEditRule}>
                <Field label="Название">
                    <input type="text" value={editingRule.name} onChange={e => setEditingRule(r => r ? { ...r, name: e.target.value } : r)} className="inp" />
                </Field>
                <Field label="Цвет">
                    <div className="flex gap-2 flex-wrap">
                        {RULE_COLORS.map(c => (
                            <button key={c} type="button" onClick={() => setEditingRule(r => r ? { ...r, color: c } : r)}
                                className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center ${editingRule.color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'}`}
                                style={{ backgroundColor: c }}>
                                {editingRule.color === c && <Check className="w-4 h-4 text-white" />}
                            </button>
                        ))}
                    </div>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Действует с"><DatePicker value={editingRule.startDate ? new Date(editingRule.startDate).toISOString().split('T')[0] : ''} onChange={d => setEditingRule(r => r ? { ...r, startDate: d } : r)} /></Field>
                    <Field label="Действует по"><DatePicker value={editingRule.endDate ? new Date(editingRule.endDate).toISOString().split('T')[0] : ''} onChange={d => setEditingRule(r => r ? { ...r, endDate: d } : r)} /></Field>
                </div>
                <Field label="Дни недели">
                    <div className="flex flex-wrap gap-2">
                        {DAY_LABELS.map((d, i) => (
                            <button key={i} type="button"
                                className={`w-11 h-11 rounded-full text-sm font-semibold transition-all ${activeDays.includes(i) ? 'text-white shadow-md' : 'bg-muted/50 text-muted-foreground'}`}
                                style={activeDays.includes(i) ? { backgroundColor: editingRule.color || '#4F46E5' } : {}}
                                disabled
                                title="Дни определяются рабочими часами">
                                {d}
                            </button>
                        ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Дни определяются рабочими часами ниже</p>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Рабочее время">
                        <div className="text-sm font-bold text-foreground tabular-nums">{minTime} – {maxTime}</div>
                        <p className="text-[11px] text-muted-foreground">Редактируется через рабочие часы</p>
                    </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Формат">
                        <select value={editingRule.format} onChange={e => setEditingRule(r => r ? { ...r, format: e.target.value } : r)} className="inp bg-white">
                            <option value="online">Онлайн</option><option value="offline">Кабинет</option><option value="both">Онлайн + Кабинет</option>
                        </select>
                    </Field>
                    <Field label="Аудитория">
                        <select value={editingRule.audienceFilter} onChange={e => setEditingRule(r => r ? { ...r, audienceFilter: e.target.value } : r)} className="inp bg-white">
                            <option value="all">Все клиенты</option><option value="regular">Только постоянные</option><option value="new">Только новые</option>
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
                    <Field label="Перерыв между слотами (мин)">
                        <input type="number" min={0} max={120} value={editingRule.breakDuration} onChange={e => setEditingRule(r => r ? { ...r, breakDuration: Number(e.target.value) } : r)} className="inp" />
                    </Field>
                </div>
                {/* Current slots */}
                <div className="border-t border-border/50 pt-4 mt-2">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-foreground">Рабочие часы</span>
                        <button type="button" onClick={() => { setEditingRule(null); setSelectedRuleId(editingRule.id); setShowNewSlot(true); }} className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"><Plus className="w-3 h-3" />Добавить</button>
                    </div>
                    {ruleSlots.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3 bg-muted/20 rounded-xl">Нет слотов. Нажмите «Добавить».</p>
                    ) : (
                        <div className="space-y-2">
                            {DAY_LABELS.map((dayName, dayIndex) => {
                                const daySlots = ruleSlots.filter(s => s.dayOfWeek === dayIndex).sort((a, b) => a.startTime.localeCompare(b.startTime));
                                const seen = new Set<string>();
                                const uniqueSlots = daySlots.filter(s => { const key = `${s.startTime}-${s.endTime}`; if (seen.has(key)) return false; seen.add(key); return true; });
                                if (uniqueSlots.length === 0) return null;
                                return (
                                    <div key={dayIndex} className="flex items-center gap-2">
                                        <span className="w-7 text-[11px] font-bold text-muted-foreground uppercase shrink-0">{dayName}</span>
                                        <div className="flex flex-wrap gap-1.5 flex-1">
                                            {uniqueSlots.map(s => (
                                                <div key={s.id} className="flex items-center gap-1 px-2 py-1 bg-muted/30 border border-border/50 rounded-lg text-[12px] font-bold group/es">
                                                    <span className="tabular-nums">{s.startTime}–{s.endTime}</span>
                                                    <button type="button" onClick={() => rmSlot(s.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover/es:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Modal>);
            })()}

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
                    <div className="bg-card rounded-2xl w-full max-w-md shadow-floating overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-5 border-b border-border/50 bg-sage-50/50">
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
                                                            <div className="text-[10px] text-muted-foreground">{t.format === 'offline' ? 'Кабинет' : 'Онлайн'}</div>
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
            {attestationModal}
        </div>
    );
}

function Modal({ title, onClose, onSubmit, children }: { title: string; onClose: () => void; onSubmit: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl w-full max-w-lg shadow-floating flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-5 border-b border-border/50 bg-sage-50/50 rounded-t-2xl">
                    <h2 className="text-lg font-bold tracking-tight">{title}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4 overflow-auto telegram-miniapp-scrollbar-hide">{children}</div>
                <div className="p-5 border-t border-border/50 bg-sage-50/50 flex gap-3 rounded-b-2xl">
                    <button onClick={onClose} className="flex-1 px-4 py-3 min-h-[44px] bg-secondary text-secondary-foreground rounded-xl text-sm font-medium hover:bg-secondary/80 transition-all">Отмена</button>
                    <button onClick={onSubmit} className="flex-1 px-4 py-3 min-h-[44px] bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-forest-700 transition-all shadow-sm">Сохранить</button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div><label className="block text-sm font-semibold mb-1.5 text-foreground/90 ml-0.5">{label}</label>{children}</div>;
}
