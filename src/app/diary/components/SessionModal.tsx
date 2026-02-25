
import { useState, useEffect } from 'react';
import { X, User, Calendar as CalendarIcon, Clock, Video, MapPin, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { DatePicker, TimePicker } from '@/components/ui/date-picker';

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
        time: '10:00',
        duration: 50,
        type: 'individual',
        format: 'online',
        notes: '',
        status: 'confirmed'
    });
    const [loading, setLoading] = useState(false);

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
                setFormData({
                    clientId: initialClient?.id || '',
                    date: initialDate ? initialDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
                    time: '10:00',
                    duration: 50,
                    type: 'individual',
                    format: 'online',
                    notes: '',
                    status: 'confirmed'
                });
            }
        }
    }, [isOpen, editSession, initialDate, initialClient]);

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
                    // Note: Full update might need more fields in updateSession action if we want to change time/date too. 
                    // For now user requested "fill notes". We can assume basic updates. 
                    // But let's check if updateSession supports other fields. The action takes "data".
                });
                toast.success('Запись обновлена');
            } else {
                const { createSession } = await import('../actions/sessions');
                await createSession(formData);
                toast.success('Запись создана');
            }
            onSave();
            onClose();
        } catch (e) {
            toast.error('Ошибка сохранении');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

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

                    {/* Read-only info if editing, or editable if new */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className={editSession ? 'opacity-50 pointer-events-none' : ''}>
                            <DatePicker
                                label="Дата"
                                value={formData.date}
                                onChange={date => {
                                    if (date) {
                                        const offset = date.getTimezoneOffset();
                                        const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
                                        setFormData(s => ({ ...s, date: adjustedDate.toISOString().split('T')[0] }));
                                    }
                                }}
                            />
                        </div>
                        <div className={editSession ? 'opacity-50 pointer-events-none' : ''}>
                            <TimePicker
                                label="Время"
                                value={formData.time}
                                onChange={time => setFormData(s => ({ ...s, time }))}
                            />
                        </div>
                    </div>

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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-2 ml-1 text-foreground/90">Длительность</label>
                                    <select value={formData.duration} onChange={e => setFormData(s => ({ ...s, duration: Number(e.target.value) }))}
                                        className="w-full px-4 py-3 min-h-[48px] border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 bg-background text-sm font-medium transition-all">
                                        <option value={50}>50 мин</option>
                                        <option value={60}>60 мин</option>
                                        <option value={80}>80 мин</option>
                                        <option value={90}>90 мин</option>
                                    </select>
                                </div>
                            </div>
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
                    <button onClick={handleSubmit} disabled={loading} className="flex-1 px-4 py-3 min-h-[44px] bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50 active:scale-[0.98]">
                        {loading ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </div>
    );
}
