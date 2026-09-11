'use client';

import { useState } from 'react';
import { X, CalendarClock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Почему клиент не пришёл.
 *
 * Кнопка «Причина» открывала общую форму записи — ту, где оплата и заметки
 * по сессии. Причину там ввести было негде: поля не существовало ни на
 * экране, ни в базе. Человек нажимал кнопку, читал заголовок
 * «Редактировать запись» и закрывал её, ничего не сделав.
 *
 * Диалог задаёт ОДИН вопрос и рядом кладёт единственное действие, которое
 * из ответа следует: перенести встречу. Иначе специалисту пришлось бы
 * закрыть это окно, найти ту же строку и нажать соседнюю кнопку — при том,
 * что «не пришёл» и «перенесём» почти всегда одна мысль.
 */

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    onReschedule: () => void;
    sessionId: string;
    /** ISO-дата встречи — для подзаголовка. */
    date: string;
    time: string;
    clientName: string;
    initialReason: string | null;
};

const MAX = 500;

export function NoShowReasonModal({
    isOpen, onClose, onSaved, onReschedule,
    sessionId, date, time, clientName, initialReason,
}: Props) {
    const [reason, setReason] = useState(initialReason ?? '');
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const save = async () => {
        if (saving) return;
        setSaving(true);
        try {
            const { setNoShowReason } = await import('../actions/sessions');
            await setNoShowReason(sessionId, reason);
            toast.success(reason.trim() ? 'Причина сохранена' : 'Причина убрана');
            onSaved();
            onClose();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Не удалось сохранить');
            setSaving(false);
        }
    };

    const when = new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl w-full max-w-lg shadow-floating overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-border/50 bg-sage-50/50">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Почему не пришли</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">{when}, {time} · {clientName}</p>
                    </div>
                    <button onClick={onClose} aria-label="Закрыть" className="p-2 hover:bg-muted rounded-full transition-colors active:scale-95">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label htmlFor="no-show-reason" className="block text-sm font-semibold mb-2 ml-1 text-foreground/90">
                            Причина
                        </label>
                        <textarea
                            id="no-show-reason"
                            value={reason}
                            maxLength={MAX}
                            onChange={e => setReason(e.target.value)}
                            rows={3}
                            autoFocus
                            placeholder="Заболел, предупредил утром"
                            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-[14px] leading-relaxed outline-none focus:ring-2 focus:ring-ring/40 resize-none"
                        />
                        {/* Счётчик появляется только у края: постоянно висящее
                            «0 / 500» превращает свободную строку в задание. */}
                        {reason.length > MAX - 100 && (
                            <p className="text-[12px] text-muted-foreground mt-1 ml-1">{reason.length} / {MAX}</p>
                        )}
                        <p className="text-[12px] text-muted-foreground mt-2 ml-1">
                            Видно только вам. В карточку клиента не попадает и ему не отправляется.
                        </p>
                    </div>

                    {/* Перенос стоит здесь, а не только в строке расписания:
                        «не пришёл» и «перенесём» — почти всегда одна мысль. */}
                    <button
                        onClick={onReschedule}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-sage-50 hover:bg-sage-100 px-4 py-3 text-[14px] font-semibold text-forest-700 transition-colors active:scale-[0.98]"
                    >
                        <CalendarClock className="w-4 h-4" />
                        Перенести встречу
                    </button>
                </div>

                <div className="flex gap-3 p-6 pt-0">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-xl bg-muted hover:bg-secondary px-4 py-3 text-[14px] font-semibold text-foreground transition-colors"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={save}
                        disabled={saving}
                        className="flex-1 rounded-xl bg-forest-800 hover:bg-forest-700 px-4 py-3 text-[14px] font-semibold text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Сохранить
                    </button>
                </div>
            </div>
        </div>
    );
}
