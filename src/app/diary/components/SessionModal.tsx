
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-auto">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-semibold">{editSession ? 'Редактировать запись' : 'Новая запись'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    {!editSession && (
                        <div>
                            <label className="block text-sm font-medium mb-2"><User className="w-4 h-4 inline mr-1" />Клиент</label>
                            <select
                                value={formData.clientId}
                                onChange={e => setFormData(s => ({ ...s, clientId: e.target.value }))}
                                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
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
                            <label className="block text-sm font-medium mb-2"><FileText className="w-4 h-4 inline mr-1" />Заметки по сессии</label>
                            <textarea
                                value={formData.notes}
                                onChange={e => setFormData(s => ({ ...s, notes: e.target.value }))}
                                rows={6}
                                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                                placeholder="Ход сессии, домашнее задание, наблюдения..."
                            />
                        </div>
                    )}

                    {!editSession && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Длительность</label>
                                    <select value={formData.duration} onChange={e => setFormData(s => ({ ...s, duration: Number(e.target.value) }))}
                                        className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
                                        <option value={50}>50 мин</option>
                                        <option value={60}>60 мин</option>
                                        <option value={80}>80 мин</option>
                                        <option value={90}>90 мин</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Тип</label>
                                <div className="flex gap-2">
                                    {[{ v: 'individual', l: 'Индивид.' }, { v: 'couple', l: 'Парная' }, { v: 'family', l: 'Семейная' }].map(t => (
                                        <button key={t.v} type="button" onClick={() => setFormData(s => ({ ...s, type: t.v }))}
                                            className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${formData.type === t.v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}>
                                            {t.l}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Формат</label>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setFormData(s => ({ ...s, format: 'online' }))}
                                        className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors flex items-center justify-center gap-2 ${formData.format === 'online' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}>
                                        <Video className="w-4 h-4" />Онлайн
                                    </button>
                                    <button type="button" onClick={() => setFormData(s => ({ ...s, format: 'offline' }))}
                                        className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors flex items-center justify-center gap-2 ${formData.format === 'offline' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}>
                                        <MapPin className="w-4 h-4" />Офлайн
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <div className="p-6 border-t border-border flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                        Отмена
                    </button>
                    <button onClick={handleSubmit} disabled={loading} className="flex-1 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50">
                        {loading ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </div>
    );
}
