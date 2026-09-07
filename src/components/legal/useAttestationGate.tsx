'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { attestPracticeOperator } from '@/app/diary/actions/attestation';
import { ATTESTATION_REQUIRED_CODE } from '@/lib/practice/attestation';
import { AttestationRequiredModal } from './AttestationRequiredModal';

/**
 * Wrap any client-creating/importing action with `guard(...)`. If it throws
 * the ATTESTATION_REQUIRED error, this shows the attestation modal instead
 * of failing — once the psychologist confirms, the SAME action is retried
 * automatically and `guard(...)` resolves with its eventual result, exactly
 * as if it had succeeded on the first try.
 *
 * `openStandalone()` — то же окно, но без действия за спиной: человек
 * пришёл подтвердить и ничего больше не начинал. Понадобилось, когда бот
 * стал отвечать на пересланный контакт «подтвердите в кабинете» и давать
 * ссылку: по ссылке открывалась страница клиентов, где не спрашивают
 * ничего. Обещание, которое некому выполнить, — хуже отказа, потому что
 * человек считает виноватым себя.
 */
export function useAttestationGate() {
    const [pending, setPending] = useState<{
        retry: () => void;
        reject: (err: unknown) => void;
    } | null>(null);
    const [confirming, setConfirming] = useState(false);

    const guard = useCallback(<T,>(action: () => Promise<T>): Promise<T> => {
        return new Promise<T>((resolve, reject) => {
            action().then(resolve).catch((err: unknown) => {
                if (err instanceof Error && err.message === ATTESTATION_REQUIRED_CODE) {
                    setPending({
                        retry: () => guard(action).then(resolve, reject),
                        reject,
                    });
                    return;
                }
                reject(err);
            });
        });
    }, []);

    // Открыть окно само по себе. `pending === null` при открытом окне и
    // означает «действия за спиной нет»: подтвердили — записали и закрыли,
    // отменили — просто закрыли, некому отказывать.
    const [standalone, setStandalone] = useState(false);
    const openStandalone = useCallback(() => setStandalone(true), []);

    const handleConfirm = useCallback(async () => {
        setConfirming(true);
        try {
            await attestPracticeOperator();
            if (pending) {
                const { retry } = pending;
                setPending(null);
                retry();
            } else {
                setStandalone(false);
            }
        } catch (err) {
            if (pending) {
                pending.reject(err);
                setPending(null);
            } else {
                // Отдельного окна ждать нечему: некому отказать и нечего
                // повторить. Молча закрыть — соврать, что подтвердили,
                // поэтому говорим вслух и оставляем окно открытым.
                console.error('[attestation] запись подтверждения не прошла:', err);
                toast.error('Не удалось записать подтверждение. Попробуйте ещё раз.');
            }
        } finally {
            setConfirming(false);
        }
    }, [pending]);

    const handleCancel = useCallback(() => {
        if (pending) {
            pending.reject(new Error('Отменено'));
            setPending(null);
            return;
        }
        setStandalone(false);
    }, [pending]);

    const modal = (
        <AttestationRequiredModal
            open={!!pending || standalone}
            confirming={confirming}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
    );

    return { guard, modal, openStandalone };
}
