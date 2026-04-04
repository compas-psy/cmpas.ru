'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { linkMaxAccount } from '../actions/settings';

function MaxConnectContent() {
    const params = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        const mid = params.get('mid');
        const exp = params.get('exp');
        const sig = params.get('sig');

        if (!mid || !exp || !sig) {
            setStatus('error');
            setErrorMsg('Неверная ссылка. Запросите новую у бота командой /connect.');
            return;
        }

        if (Date.now() > Number(exp)) {
            setStatus('expired');
            setErrorMsg('Ссылка устарела (действует 15 минут). Запросите новую у бота командой /connect.');
            return;
        }

        // Verify signature server-side
        fetch('/api/max/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mid, exp, sig }),
        })
            .then(r => r.json())
            .then(async data => {
                if (!data.valid) {
                    setStatus('error');
                    setErrorMsg('Подпись не прошла проверку. Возможно, ссылка была подменена.');
                    return;
                }
                try {
                    const result = await linkMaxAccount(mid);
                    if (result.success) {
                        setStatus('success');
                        setTimeout(() => router.push('/diary/integrations'), 2500);
                    } else {
                        setStatus('error');
                        setErrorMsg('Ошибка сохранения. Попробуйте ещё раз.');
                    }
                } catch {
                    setStatus('error');
                    setErrorMsg('Вы не авторизованы в КОМПАС. Войдите и перейдите по ссылке снова.');
                }
            })
            .catch(() => {
                setStatus('error');
                setErrorMsg('Ошибка сети. Попробуйте позже.');
            });
    }, [params, router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
            {status === 'loading' && (
                <>
                    <Loader2 className="w-10 h-10 animate-spin text-[#1a4d3a] mb-4" />
                    <p className="text-[#1a4d3a] font-medium">Привязываем MAX аккаунт...</p>
                </>
            )}

            {status === 'success' && (
                <>
                    <CheckCircle2 className="w-14 h-14 text-[#1a4d3a] mb-4" />
                    <h2 className="text-2xl font-semibold text-[#1a4d3a] mb-2">MAX подключён!</h2>
                    <p className="text-gray-600">Теперь вы будете получать уведомления через MAX.</p>
                    <p className="text-sm text-gray-400 mt-2">Перенаправление...</p>
                </>
            )}

            {(status === 'error' || status === 'expired') && (
                <>
                    <XCircle className="w-14 h-14 text-red-500 mb-4" />
                    <h2 className="text-2xl font-semibold text-red-700 mb-2">
                        {status === 'expired' ? 'Ссылка устарела' : 'Ошибка'}
                    </h2>
                    <p className="text-gray-600 max-w-sm">{errorMsg}</p>
                    <button
                        onClick={() => router.push('/diary/integrations')}
                        className="mt-6 px-6 py-3 bg-[#1a4d3a] text-white rounded-xl font-medium hover:bg-[#1a4d3a]/90 transition-colors"
                    >
                        К интеграциям
                    </button>
                </>
            )}
        </div>
    );
}

export default function MaxConnectPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-[#1a4d3a]" />
            </div>
        }>
            <MaxConnectContent />
        </Suspense>
    );
}
