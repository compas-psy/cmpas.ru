'use client';

import { useState } from 'react';
import { acknowledgeSpecialistDocument } from './actions';

/**
 * Явное согласие клиента (152-ФЗ): согласие фиксируется только осознанным
 * действием — сначала отметить чекбокс «Я ознакомлен(а)…», затем нажать кнопку.
 * Кнопка неактивна, пока чекбокс не отмечен; серверный action дополнительно
 * проверяет наличие отметки, поэтому форму нельзя «обойти» напрямую.
 */
export function AcknowledgeForm({
    deliveryId,
    token,
    openedText,
}: {
    deliveryId: string;
    token: string;
    openedText: string | null;
}) {
    const [agreed, setAgreed] = useState(false);

    return (
        <form action={acknowledgeSpecialistDocument} className="rounded-2xl border border-[#e6dfd1] bg-[#faf8f5] p-5 text-sm leading-6">
            <input type="hidden" name="deliveryId" value={deliveryId} />
            <input type="hidden" name="token" value={token} />
            <p className="font-semibold text-[#1f2a24]">Подтверждение требуется отдельным действием</p>
            <p className="mt-1 text-[#5d665f]">
                Открытие документа фиксируется только как просмотр{openedText ? <>: <b>{openedText}</b></> : null}. Согласие будет зафиксировано после нажатия кнопки ниже.
            </p>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#e6dfd1] bg-white p-4 text-[15px] leading-6 text-[#2b332d]">
                <input
                    type="checkbox"
                    name="agree"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#1a4d3a]"
                />
                <span>Я ознакомлен(а) с документом и даю согласие на обработку персональных данных на изложенных условиях.</span>
            </label>

            <button
                type="submit"
                disabled={!agreed}
                className="mt-4 w-full rounded-2xl bg-[#1a4d3a] px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
                Принимаю условия
            </button>
        </form>
    );
}
