'use client';

import { useState } from 'react';
import { X, Calendar, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    sessionId: string;
    currentDate: string;
    currentTime: string;
    clientName: string;
};

export function RescheduleModal({ isOpen, onClose, onSave, sessionId, currentDate, currentTime, clientName }: Props) {
    const [newDate, setNewDate] = useState(currentDate);
    const [newTime, setNewTime] = useState(currentTime);
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!newDate || !newTime) {
            toast.error('Укажите дату и время');
            return;
        }
        if (newDate === currentDate && newTime === currentTime) {
            toast.error('Выберите другую дату или время');
            return;
        }
        setSaving(true);
        try {
            const { rescheduleSession } = await import('../actions/sessions');
            await rescheduleSession(sessionId, newDate, newTime);
            toast.success('Сессия перенесена');
            onSave();
            onClose();
        } catch (e: any) {
            toast.error(e?.message || 'Ошибка переноса');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-card rounded-3xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold tracking-tight text-foreground">Перенести сессию</h3>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                <div className="bg-muted/30 rounded-2xl p-4 mb-6 border border-border/50">
                    <p className="text-sm font-medium text-muted-foreground">Клиент</p>
                    <p className="font-bold text-foreground">{clientName}</p>
                    <p className="text-sm font-medium text-muted-foreground mt-2">Текущее время</p>
                    <p className="font-semibold text-foreground">{currentDate} в {currentTime}</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-semibold text-foreground/80 ml-1 flex items-center gap-1.5 mb-2">
                            <Calendar className="w-3.5 h-3.5" /> Новая дата
                        </label>
                        <input
                            type="date"
                            value={newDate}
                            onChange={e => setNewDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-4 py-3 min-h-[48px] border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm font-medium transition-all"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-foreground/80 ml-1 flex items-center gap-1.5 mb-2">
                            <Clock className="w-3.5 h-3.5" /> Новое время
                        </label>
                        <input
                            type="time"
                            value={newTime}
                            onChange={e => setNewTime(e.target.value)}
                            className="w-full px-4 py-3 min-h-[48px] border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm font-medium transition-all"
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 min-h-[44px] bg-secondary text-secondary-foreground rounded-xl text-sm font-semibold hover:bg-secondary/80 transition-colors"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 px-4 py-3 min-h-[44px] bg-primary text-primary-foreground rounded-xl text-sm font-semibold shadow-sm hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {saving ? 'Перенос...' : 'Перенести'}
                    </button>
                </div>
            </div>
        </div>
    );
}
