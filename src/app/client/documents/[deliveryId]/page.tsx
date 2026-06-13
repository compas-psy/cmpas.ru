import { notFound } from 'next/navigation';
import { getDocumentDelivery } from '@/lib/client-workflow';

export const dynamic = 'force-dynamic';

function openFileUrl(fileUrl: string) {
    if (fileUrl.startsWith('/api/diary/documents/file/')) return fileUrl;
    if (fileUrl.startsWith('/uploads/client-documents/')) {
        return fileUrl.replace('/uploads/client-documents/', '/api/diary/documents/file/');
    }
    return fileUrl;
}

export default async function ClientDocumentPage({ params, searchParams }: { params: Promise<{ deliveryId: string }>; searchParams: Promise<{ t?: string }> }) {
    const { deliveryId } = await params;
    const { t: token } = await searchParams;

    let delivery;
    try {
        delivery = await getDocumentDelivery(deliveryId, token);
    } catch {
        notFound();
    }

    const openedText = delivery.openedAt
        ? new Date(delivery.openedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : null;

    return (
        <main className="min-h-screen bg-[#faf8f5] px-4 py-8 text-[#1f2a24]">
            <div className="mx-auto max-w-2xl rounded-3xl border border-[#e6dfd1] bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-6 border-b border-[#e6dfd1] pb-5">
                    <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#1a4d3a]">КОМПАС · документ специалиста</p>
                    <h1 className="text-2xl font-bold leading-tight tracking-tight">{delivery.documentTitle}</h1>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-[#5d665f]">
                        <dt className="text-[#8a8f88]">Специалист</dt>
                        <dd className="font-semibold text-[#1f2a24]">{delivery.psychologistName || 'специалист'}</dd>
                        <dt className="text-[#8a8f88]">Клиент</dt>
                        <dd className="font-semibold text-[#1f2a24]">{delivery.clientName}</dd>
                        <dt className="text-[#8a8f88]">Версия</dt>
                        <dd className="font-semibold text-[#1f2a24]">{delivery.documentVersion}</dd>
                    </dl>
                </div>

                {delivery.documentContent ? (
                    <article className="mb-6 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-[#e6dfd1] bg-[#faf8f5] p-5 text-[15px] leading-7 text-[#2b332d]">{delivery.documentContent}</article>
                ) : delivery.fileUrl ? (
                    <a href={openFileUrl(delivery.fileUrl)} target="_blank" rel="noreferrer" className="mb-6 flex items-center gap-3 rounded-2xl border border-[#e6dfd1] bg-[#faf8f5] p-5 text-sm font-semibold text-[#1a4d3a] transition-colors hover:bg-[#f1ede4]">
                        📄 Открыть файл документа{delivery.fileName ? `: ${delivery.fileName}` : ''}
                    </a>
                ) : (
                    <section className="mb-6 rounded-2xl border border-[#e6dfd1] bg-[#faf8f5] p-5 text-sm leading-6">Текст документа недоступен. Обратитесь к специалисту.</section>
                )}

                <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm leading-6 text-green-800">
                    <p className="font-semibold">✓ Согласие зафиксировано</p>
                    <p className="mt-1 text-green-700">
                        Открыв этот документ, вы подтвердили ознакомление и согласие с его условиями.
                        {openedText ? <> Дата: <b>{openedText}</b>.</> : null}
                    </p>
                </div>
            </div>
        </main>
    );
}
