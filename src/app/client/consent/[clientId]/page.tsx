import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getActiveConsentVersion, verifyClientActionToken } from '@/lib/client-workflow';
import { acceptClientConsent } from './actions';

export const dynamic = 'force-dynamic';

export default async function ClientConsentPage({
    params,
    searchParams,
}: {
    params: Promise<{ clientId: string }>;
    searchParams: Promise<{ psy?: string; t?: string }>;
}) {
    const { clientId } = await params;
    const { psy: psychologistId, t: token } = await searchParams;

    if (!clientId || !psychologistId || !verifyClientActionToken(psychologistId, clientId, token)) {
        notFound();
    }

    const client = await db.diaryClient.findFirst({
        where: { id: clientId, psychologistId },
        include: { psychologist: { include: { psychologistSettings: true } } },
    });
    if (!client) notFound();

    const consent = await getActiveConsentVersion();
    const psyName = client.psychologist.psychologistSettings?.fullName || client.psychologist.name || 'специалист';
    const alreadyAccepted = !!client.consentDate && client.consentVersion === consent.version;

    return (
        <main className="min-h-screen bg-[#faf8f5] px-4 py-8 text-[#1f2a24]">
            <div className="mx-auto max-w-2xl rounded-3xl border border-[#d9d2c2] bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-6">
                    <p className="mb-2 text-sm font-semibold text-[#1a4d3a]">КОМПАС · документы клиента</p>
                    <h1 className="text-2xl font-bold tracking-tight">Информированное согласие</h1>
                    <p className="mt-2 text-sm leading-6 text-[#5d665f]">
                        Клиент: <b>{client.name}</b><br />
                        Специалист: <b>{psyName}</b>
                    </p>
                </div>

                {alreadyAccepted ? (
                    <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-800">
                        Согласие уже подтверждено. Версия документа: <b>{client.consentVersion}</b>.
                    </div>
                ) : (
                    <>
                        <section className="mb-6 max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-[#e6dfd1] bg-[#faf8f5] p-5 text-sm leading-6">
                            {consent.text}
                        </section>

                        <form action={acceptClientConsent} className="space-y-4">
                            <input type="hidden" name="clientId" value={clientId} />
                            <input type="hidden" name="psychologistId" value={psychologistId} />
                            <input type="hidden" name="token" value={token || ''} />
                            <label className="flex items-start gap-3 rounded-2xl border border-[#e6dfd1] p-4 text-sm leading-6">
                                <input name="confirmed" required type="checkbox" className="mt-1 h-4 w-4" />
                                <span>
                                    Подтверждаю, что ознакомился/ознакомилась с текстом согласия и добровольно даю согласие на обработку персональных данных для организации и проведения консультаций.
                                </span>
                            </label>
                            <button className="w-full rounded-2xl bg-[#1a4d3a] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95">
                                Подтвердить согласие
                            </button>
                        </form>
                    </>
                )}
            </div>
        </main>
    );
}
