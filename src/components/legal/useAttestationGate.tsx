'use client';

import { useCallback, useState } from 'react';
import { attestPracticeOperator } from '@/app/diary/actions/attestation';
import { ATTESTATION_REQUIRED_CODE } from '@/lib/practice/attestation';
import { AttestationRequiredModal } from './AttestationRequiredModal';

/**
 * Wrap any client-creating/importing action with `guard(...)`. If it throws
 * the ATTESTATION_REQUIRED error, this shows the attestation modal instead
 * of failing — once the psychologist confirms, the SAME action is retried
 * automatically and `guard(...)` resolves with its eventual result, exactly
 * as if it had succeeded on the first try.
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

    const handleConfirm = useCallback(async () => {
        if (!pending) return;
        setConfirming(true);
        try {
            await attestPracticeOperator();
            const { retry } = pending;
            setPending(null);
            retry();
        } catch (err) {
            pending.reject(err);
            setPending(null);
        } finally {
            setConfirming(false);
        }
    }, [pending]);

    const handleCancel = useCallback(() => {
        if (!pending) return;
        pending.reject(new Error('Отменено'));
        setPending(null);
    }, [pending]);

    const modal = (
        <AttestationRequiredModal
            open={!!pending}
            confirming={confirming}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
    );

    return { guard, modal };
}
