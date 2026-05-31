import { notFound } from 'next/navigation';
import { getDocumentDelivery } from '@/lib/client-workflow';
import { acknowledgeSpecialistDocument } from './actions';

export const dynamic = 'force-dynamic';

export default async function ClientDocumentPage({
    params,
    searchParams,
}: {
    params: Promise<{ deliveryId: string }>;
    searchParams: Promise<{ t?: string }>;
}) {
    const { deliveryId } = await params;
    const { t: token } = await searchParams;

    let delivery;
    try {
        delivery = await getDocumentDelivery(deliveryId, token);
    } catch {
        notFound();
    }

    return (
        <main className="min-h-screen bg-[#faf8f5] px-4 py-8 text-[#1f2a24]">
            <div className="mx-auto max-w-3xl rounded-3xl border border-[#d9d2c2] bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-6 border-b border-[#e6dfd1] pb-5">
                    <p className="mb-2 text-sm font-semibold text-[#1a4d3a]">КОМПАС · документ специалиста</p>
                    <h1 className="text-2xl font-bold tracking-tight">{delivery.documentTitle}</h1>
                    <p className="mt-2 text-sm leading-6 text-[#5d665f]">
                        Клиент: <b>{delivery.clientName}</b><br />
                        Специалист: <b>{delivery.psychologistName || 'специалист'}</b><br />
                        Версия документа: <b>{delivery.documentVersion}</b>
                    </p>
                </div>

                <section className="mb-6 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-[#e6dfd1] bg-[#faf8f5] p-5 text-sm leading-6">
                    {delivery.documentContent}
                </section>

                {delivery.acknowledgedAt ? (
                    <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-800">
                        Ознакомление уже зафиксировано.
                    </div>
                ) : (
                    <form action={acknowledgeSpecialistDocument} className="space-y-4">
                        <input type="hidden" name="deliveryId" value={deliveryId} />
                        <input type="hidden" name="token" value={token || ''} />
                        <label className="flex items-start gap-3 rounded-2xl border border-[#e6dfd1] p-4 text-sm leading-6">
                            <input required type="checkbox" className="mt-1 h-4 w-4" />
                            <span>
                                Подтверждаю, что получил(а) и ознакомился(лась) с документом специалиста. Понимаю, что оплата консультации является акцептом условий, указанных в документе.
                            </span>
                        </label>
                        <button className="w-full rounded-2xl bg-[#1a4d3a] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95">
                            Подтвердить ознакомление
                        </button>
                    </form>
                )}
            </div>
        </main>
    );
}
