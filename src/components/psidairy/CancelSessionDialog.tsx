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
            <div className="bg-card w-full max-w-sm rounded-2xl shadow-lg border border-border p-6 animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold text-foreground mb-2">Отменить сессию?</h3>
                <p className="text-muted-foreground text-sm mb-4">
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
                        className="flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-colors text-sm hover:bg-[#1e3a2f]/10 dark:hover:bg-[#b89a4e]/10 haptic-light border-[#1e3a2f] text-[#1e3a2f] dark:border-[#b89a4e] dark:text-[#b89a4e] bg-transparent disabled:opacity-50"
                    >
                        Назад
                    </button>
                    <button
                        onClick={handleCancel}
                        disabled={isCancelling}
                        className="flex-1 py-3 px-4 rounded-xl font-medium transition-colors text-sm bg-destructive text-destructive-foreground hover:opacity-90 haptic-light disabled:opacity-50"
                    >
                        {isCancelling ? 'Отмена...' : 'Да, отменить'}
                    </button>
                </div>
            </div>
        </div>
    );
}
