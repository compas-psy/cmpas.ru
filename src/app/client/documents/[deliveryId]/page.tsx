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

    return (
        <main className="min-h-screen bg-[#f7f5ef] px-4 py-6 text-[#1f2a24] sm:py-10">
            <div className="mx-auto max-w-3xl rounded-[28px] border border-[#ded7c8] bg-white p-5 shadow-sm sm:p-8">
                <div className="mb-6 border-b border-[#ebe5d8] pb-5">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#1a4d3a]">КОМПАС · документ специалиста</p>
                    <h1 className="break-words text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{delivery.documentTitle}</h1>
                    <div className="mt-4 grid gap-2 rounded-2xl bg-[#faf8f5] p-4 text-sm leading-6 text-[#5d665f]">
                        <p>Клиент: <b className="text-[#1f2a24]">{delivery.clientName}</b></p>
                        <p>Специалист: <b className="text-[#1f2a24]">{delivery.psychologistName || 'специалист'}</b></p>
                        <p>Версия: <b className="text-[#1f2a24]">{delivery.documentVersion}</b></p>
                    </div>
                </div>

                {delivery.documentContent ? (
                    <section className="mb-6 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-[#e6dfd1] bg-[#faf8f5] p-5 text-sm leading-7">
                        {delivery.documentContent}
                    </section>
                ) : delivery.fileUrl ? (
                    <a href={openFileUrl(delivery.fileUrl)} target="_blank" rel="noreferrer" className="mb-6 block rounded-2xl border border-[#d7eadf] bg-[#f1fbf5] p-5 text-sm font-semibold leading-6 text-[#1a4d3a] underline underline-offset-4">
                        Открыть файл документа{delivery.fileName ? `: ${delivery.fileName}` : ''}
                    </a>
                ) : (
                    <section className="mb-6 rounded-2xl border border-[#e6dfd1] bg-[#faf8f5] p-5 text-sm leading-6">Текст документа недоступен. Обратитесь к специалисту.</section>
                )}

                <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm leading-6 text-green-800">
                    <b>Документ принят.</b><br />Факт открытия и принятия условий зафиксирован у специалиста.
                </div>
            </div>
        </main>
    );
}
