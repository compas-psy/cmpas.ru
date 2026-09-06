'use client';

import { useState } from 'react';

export function CancelSessionDialog({
    isOpen,
    onClose,
    onConfirm,
    sessionId,
    sessionDate,
    sessionTime,
    clientName,
    clientId,
    clientToken,
}: any) {
    const [isCancelling, setIsCancelling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleCancel = async () => {
        setIsCancelling(true);
        setError(null);
        try {
            const res = await fetch(`/api/user/diary/bot/client/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, clientId, clientToken, clientName })
            });
            if (res.ok) {
                onConfirm();
                return;
            }
            setError('Не удалось отменить запись по этой ссылке. Попробуйте открыть запись из сообщения специалиста или напишите специалисту напрямую.');
        } catch (e) {
            console.error(e);
            setError('Не удалось отменить запись. Проверьте соединение и попробуйте ещё раз.');
        } finally {
            setIsCancelling(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            {/* Кадр C11: спокойное, но недвусмысленное подтверждение. Токены —
                клиентские (.practice-booking-theme): диалог живёт только на
                клиентской странице «Мои записи», и до этой правки он рисовался
                двумя вписанными в разметку оттенками зелёного и золота вместо
                единых переменных (см. W16–W18 «единые токены вместо трёх
                оттенков»). */}
            <div className="bg-[var(--booking-card)] w-full max-w-sm rounded-[var(--booking-radius-card)] shadow-lg border border-[var(--booking-line)] p-6 animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold text-[var(--booking-ink)] mb-2">Отменить сессию?</h3>
                <p className="text-[var(--booking-muted)] text-sm mb-4">
                    Вы уверены, что хотите отменить запись на {sessionDate} в {sessionTime}? Это действие нельзя отменить.
                </p>
                {error && (
                    <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {error}
                    </div>
                )}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isCancelling}
                        className="flex-1 py-3 px-4 rounded-[var(--booking-radius-card)] border-2 font-medium transition-colors text-sm haptic-light border-[var(--booking-line)] text-[var(--booking-ink)] bg-[var(--booking-card)] hover:border-[var(--booking-accent)] hover:text-[var(--booking-accent)] disabled:opacity-50"
                    >
                        Оставить как есть
                    </button>
                    <button
                        onClick={handleCancel}
                        disabled={isCancelling}
                        className="flex-1 py-3 px-4 rounded-[var(--booking-radius-card)] font-medium transition-colors text-sm bg-destructive text-destructive-foreground hover:opacity-90 haptic-light disabled:opacity-50"
                    >
                        {isCancelling ? 'Отмена...' : 'Да, отменить'}
                    </button>
                </div>
            </div>
        </div>
    );
}
