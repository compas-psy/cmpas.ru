'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Calendar, Trash2, Palmtree, User, Coffee, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { DatePicker, TimePicker } from '@/components/ui/date-picker';

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
            const { getAvailabilitySlots, getTimeBlocks } = await import('../actions/availability');
            const { getAddresses } = await import('../actions/settings');
            const [s, b, addrs] = await Promise.all([getAvailabilitySlots(), getTimeBlocks(), getAddresses()]);
            setSlots(s.map((x: any) => ({
                ...x,
                startDate: x.startDate ? new Date(x.startDate).toISOString() : null,
                endDate: x.endDate ? new Date(x.endDate).toISOString() : null
            })));
            setBlocks(b.map((x: any) => ({ ...x, startDate: new Date(x.startDate).toISOString(), endDate: new Date(x.endDate).toISOString() })));
            setAddresses(addrs);
        } catch { /* */ }
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
            const { createAvailabilitySlot } = await import('../actions/availability');
            await createAvailabilitySlot(newSlot);
            toast.success('Окна добавлены');
            setShowNewSlot(false);
            setNewSlot(initialSlot);
            fetchData();
        } catch (e: any) {
            console.error('addSlot error:', e);
            toast.error('Ошибка при создании окон: ' + (e?.message || 'Неизвестная ошибка'));
        }
    };

    const rmSlot = async (id: string) => {
        const { deleteAvailabilitySlot } = await import('../actions/availability');
        await deleteAvailabilitySlot(id); toast.success('Удалено'); fetchData();
    };

    const updateSlot = async () => {
        if (!editingSlot) return;
        if (editingSlot.startTime >= editingSlot.endTime) { toast.error('Время начала должно быть раньше времени окончания'); return; }

        try {
            const { updateAvailabilitySlot } = await import('../actions/availability');
            await updateAvailabilitySlot(editingSlot.id, {
                startTime: editingSlot.startTime,
                endTime: editingSlot.endTime,
                duration: editingSlot.duration,
                format: editingSlot.format || 'online',
                addressId: editingSlot.format !== 'online' ? (editingSlot.addressId || null) : null
            });
            toast.success('Окно обновлено');
            setEditingSlot(null);
            fetchData();
        } catch (e: any) {
            console.error('updateSlot error:', e);
            toast.error('Ошибка при обновлении: ' + (e?.message || 'Неизвестная ошибка'));
        }
    };

    const addBlock = async () => {
        if (!newBlock.startDate || !newBlock.endDate) { toast.error('Укажите даты'); return; }
        const { createTimeBlock } = await import('../actions/availability');
        await createTimeBlock(newBlock);
        toast.success('Блокировка добавлена'); setShowNewBlock(false); fetchData();
    };

    const rmBlock = async (id: string) => {
        const { deleteTimeBlock } = await import('../actions/availability');
        await deleteTimeBlock(id); toast.success('Удалено'); fetchData();
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

    const slotsByDay = dayShort.map((_, i) => slots.filter(s => s.dayOfWeek === i));

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

            {/* Weekly Grid */}
            <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
                <div className="grid grid-cols-7 divide-x divide-border">
                    {dayShort.map((day, i) => (
                        <div key={day} className="flex flex-col">
                            <div className="p-4 bg-muted/30 text-center border-b border-border">
                                <span className="text-sm font-semibold text-foreground/80">{day}</span>
                            </div>
                            <div className="p-3 min-h-[200px] space-y-2 bg-background/50">
                                {slotsByDay[i].map(slot => (
                                    <div key={slot.id} className="bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-2xl p-3 group relative transition-colors shadow-sm">
                                        <div className="text-sm font-bold text-primary">{slot.startTime} - {slot.endTime}</div>
                                        <div className="text-xs font-medium text-muted-foreground mt-0.5">{slot.duration} мин</div>
                                        <div className="text-[10px] font-medium text-primary/80 mt-2 bg-primary/10 px-2 py-1 rounded-md inline-block">
                                            {slot.isRecurring && slot.startDate && slot.endDate ? (
                                                `♻ ${new Date(slot.startDate).toLocaleDateString('ru-RU')} - ${new Date(slot.endDate).toLocaleDateString('ru-RU')}`
                                            ) : slot.startDate ? (
                                                `📅 ${new Date(slot.startDate).toLocaleDateString('ru-RU')}`
                                            ) : (
                                                `♻ Постоянно`
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
                                ))}
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
                                    <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center ${b.type === 'vacation' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>
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
            {showNewBlock && <Modal title="Блокировка времени" onClose={() => setShowNewBlock(false)} onSubmit={addBlock}>
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
                <Field label="Причина"><input type="text" value={newBlock.reason} onChange={e => setNewBlock(s => ({ ...s, reason: e.target.value }))} placeholder="Необязательно" className="inp" /></Field>
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
                    border: 1px solidhsl(var(--border)); 
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
