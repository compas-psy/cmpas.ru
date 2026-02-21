'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Calendar, Trash2, Palmtree, User, Coffee } from 'lucide-react';
import { toast } from 'sonner';
import { DatePicker, TimePicker } from '@/components/ui/date-picker';

type Slot = { id: string; dayOfWeek: number; startTime: string; endTime: string; duration: number; isRecurring: boolean; startDate?: string | null; endDate?: string | null; format?: string; };
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
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-semibold">Расписание</h1>
                    <p className="text-muted-foreground text-sm mt-1">Управляйте своей доступностью</p>
                </div>
                <div className="flex gap-2 self-start">
                    <button onClick={() => setShowNewSlot(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium">
                        <Plus className="w-4 h-4" />Новое окно
                    </button>
                    <button onClick={() => setShowNewBlock(true)} className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors text-sm font-medium">
                        <Calendar className="w-4 h-4" />Блокировка
                    </button>
                </div>
            </div>

            {/* Weekly Grid */}
            <div className="bg-white rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-7">
                    {dayShort.map((day, i) => (
                        <div key={day} className="border-r last:border-r-0 border-border">
                            <div className="p-3 bg-muted/30 text-center border-b border-border">
                                <span className="text-xs font-medium text-muted-foreground">{day}</span>
                            </div>
                            <div className="p-2 min-h-[120px] space-y-1">
                                {slotsByDay[i].map(slot => (
                                    <div key={slot.id} className="bg-primary/10 rounded p-2 group relative">
                                        <div className="text-xs font-medium text-primary">{slot.startTime} - {slot.endTime}</div>
                                        <div className="text-xs text-muted-foreground">{slot.duration} мин</div>
                                        <div className="text-xs text-primary/60 mt-1">
                                            {slot.isRecurring && slot.startDate && slot.endDate ? (
                                                `♻ С ${new Date(slot.startDate).toLocaleDateString('ru-RU')} по ${new Date(slot.endDate).toLocaleDateString('ru-RU')}`
                                            ) : slot.startDate ? (
                                                `📅 ${new Date(slot.startDate).toLocaleDateString('ru-RU')}`
                                            ) : (
                                                `♻ Постоянно` // For old slots
                                            )}
                                        </div>
                                        <button onClick={() => rmSlot(slot.id)} className="absolute top-1 right-1 p-0.5 bg-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10">
                                            <Trash2 className="w-3 h-3 text-destructive" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Time Blocks */}
            <div>
                <h2 className="text-lg font-semibold mb-3">Блокировки времени</h2>
                {blocks.length === 0 ? (
                    <div className="bg-white rounded-lg border border-border p-8 text-center"><p className="text-muted-foreground text-sm">Нет блокировок</p></div>
                ) : (
                    <div className="space-y-2">
                        {blocks.map(b => {
                            const Icon = blockIcons[b.type] || Coffee;
                            return (
                                <div key={b.id} className="bg-white rounded-lg border border-border p-4 flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${b.type === 'vacation' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{blockLabels[b.type]}</div>
                                        <div className="text-xs text-muted-foreground">{new Date(b.startDate).toLocaleDateString('ru-RU')} — {new Date(b.endDate).toLocaleDateString('ru-RU')}</div>
                                        {b.reason && <div className="text-xs text-muted-foreground mt-0.5">{b.reason}</div>}
                                    </div>
                                    <button onClick={() => rmBlock(b.id)} className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4 text-destructive" /></button>
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
                                className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${newSlot.daysOfWeek.includes(i) ? 'bg-primary text-white' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
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

                <div className="bg-muted/30 p-4 rounded-lg space-y-4 border border-border/50">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={newSlot.hasLunch} onChange={e => setNewSlot(s => ({ ...s, hasLunch: e.target.checked }))} className="w-4 h-4 rounded text-primary focus:ring-primary border-border" />
                        <span className="text-sm font-medium">Добавить перерыв (Обед)</span>
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

            <style jsx>{`.inp { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--color-border); border-radius: 0.5rem; font-size: 0.875rem; outline: none; } .inp:focus { box-shadow: 0 0 0 2px rgba(26,77,58,0.1); }`}</style>
        </div>
    );
}

function Modal({ title, onClose, onSubmit, children }: { title: string; onClose: () => void; onSubmit: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-semibold">{title}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">{children}</div>
                <div className="p-6 border-t border-border flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">Отмена</button>
                    <button onClick={onSubmit} className="flex-1 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">Добавить</button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div><label className="block text-sm font-medium mb-2">{label}</label>{children}</div>;
}
