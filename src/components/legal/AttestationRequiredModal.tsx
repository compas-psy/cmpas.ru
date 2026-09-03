'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { PRACTICE_OPERATOR_ATTESTATION_TEXT } from '@/lib/practice/attestation';

/**
 * Task 5 (PRAKTIKA MVP): shown once, before the FIRST client create/import/
 * booking-activation, when requirePracticeOperatorAttestation() rejects the
 * attempt. Checking the box is a legal attestation ("I am the operator of
 * my clients' personal data..."), not a consent — it is never re-asked
 * unless the wording itself changes version.
 */
export function AttestationRequiredModal({
    open,
    confirming,
    onConfirm,
    onCancel,
}: {
    open: boolean;
    confirming: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const [checked, setChecked] = useState(false);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="p-6">
                    <div className="w-10 h-10 rounded-full bg-[#e8f2ec] flex items-center justify-center text-[#1a4d3a] mb-4">
                        <ShieldCheck className="w-5 h-5" />
                    </div>

                    <h3 className="text-xl font-bold text-[#1a1a1a] mb-2">
                        Прежде чем добавить первого клиента
                    </h3>

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e6dfd1] bg-gray-50 p-4 text-sm text-[#1a1a1a]/80 mb-6">
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setChecked(e.target.checked)}
                            className="mt-0.5 h-5 w-5 shrink-0 rounded border-[#c9a961] accent-[#1a4d3a]"
                        />
                        <span>{PRACTICE_OPERATOR_ATTESTATION_TEXT}</span>
                    </label>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={onConfirm}
                            disabled={!checked || confirming}
                            className="w-full bg-[#1a4d3a] hover:bg-[#133729] text-white rounded-xl py-3 font-medium transition-colors disabled:opacity-50"
                        >
                            {confirming ? 'Подтверждаем...' : 'Подтвердить и продолжить'}
                        </button>
                        <button
                            onClick={onCancel}
                            disabled={confirming}
                            className="w-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 rounded-xl py-3 font-medium transition-colors disabled:opacity-50"
                        >
                            Отмена
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
