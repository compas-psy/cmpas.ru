import { notFound } from 'next/navigation';
import { getDocumentDelivery } from '@/lib/client-workflow';
import { notifyDocumentDeliveryEvent } from '@/lib/document-delivery-notifications';
import { acknowledgeSpecialistDocument } from './actions';

export const dynamic = 'force-dynamic';

function openFileUrl(fileUrl: string) {
    if (fileUrl.startsWith('/api/diary/documents/file/')) return fileUrl;
    if (fileUrl.startsWith('/uploads/client-documents/')) {
        return fileUrl.replace('/uploads/client-documents/', '/api/diary/documents/file/');
    }
    return fileUrl;
}

function formatDate(value: Date | string | null) {
    if (!value) return null;
    return new Date(value).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default async function ClientDocumentPage({ params, searchParams }: { params: Promise<{ deliveryId: string }>; searchParams: Promise<{ t?: string; error?: string }> }) {
    const { deliveryId } = await params;
    const { t: token, error } = await searchParams;

    let delivery;
    try {
        delivery = await getDocumentDelivery(deliveryId, token);
        await notifyDocumentDeliveryEvent(deliveryId, 'opened');
    } catch {
        notFound();
    }

    const openedText = formatDate(delivery.openedAt);
    const acknowledgedText = formatDate(delivery.acknowledgedAt);
    const acknowledged = Boolean(delivery.acknowledgedAt);

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
                    <article className="mb-6 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-[#e6dfd1] bg-[#faf8f5] p-5 text-[16px] leading-7 text-[#2b332d]">{delivery.documentContent}</article>
                ) : delivery.fileUrl ? (
                    <a href={openFileUrl(delivery.fileUrl)} target="_blank" rel="noreferrer" className="mb-6 flex items-center gap-3 rounded-2xl border border-[#e6dfd1] bg-[#faf8f5] p-5 text-base font-semibold text-[#1a4d3a] transition-colors hover:bg-[#f1ede4]">
                        📄 Открыть файл документа{delivery.fileName ? `: ${delivery.fileName}` : ''}
                    </a>
                ) : (
                    <section className="mb-6 rounded-2xl border border-[#e6dfd1] bg-[#faf8f5] p-5 text-base leading-6">Текст документа недоступен. Обратитесь к специалисту.</section>
                )}

                {acknowledged ? (
                    <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-base leading-6 text-green-800">
                        <p className="font-semibold">✓ Принято</p>
                        <p className="mt-1 text-green-700">
                            Вы подтвердили ознакомление и согласие с условиями документа.
                            {acknowledgedText ? <> Дата: <b>{acknowledgedText}</b>. Версия: <b>{delivery.documentVersion}</b>.</> : null}
                        </p>
                    </div>
                ) : (
                    <form action={acknowledgeSpecialistDocument} className="rounded-2xl border border-[#e6dfd1] bg-[#faf8f5] p-5 text-base leading-6">
                        <input type="hidden" name="deliveryId" value={delivery.id} />
                        <input type="hidden" name="token" value={token || ''} />
                        <p className="font-semibold text-[#1f2a24]">Подтверждение требуется отдельным действием</p>
                        <p className="mt-1 text-[#5d665f]">
                            Открытие документа фиксируется только как просмотр{openedText ? <>: <b>{openedText}</b></> : null}. Согласие будет зафиксировано только после отметки чекбокса и нажатия кнопки ниже.
                        </p>
                        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#e6dfd1] bg-white p-4 text-[#2b332d]">
                            <input
                                required
                                type="checkbox"
                                name="accepted"
                                value="yes"
                                className="mt-1 h-5 w-5 rounded border-[#c9a961] accent-[#1a4d3a]"
                            />
                            <span>
                                Я ознакомлен(а) с полным текстом документа и даю согласие на обработку персональных данных на указанных условиях.
                            </span>
                        </label>
                        {error === 'accepted_required' ? (
                            <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                                Для фиксации согласия отметьте чекбокс.
                            </p>
                        ) : null}
                        <button type="submit" className="mt-4 min-h-12 w-full rounded-2xl bg-[#1a4d3a] px-5 py-3 text-base font-bold text-white transition-opacity hover:opacity-95 active:scale-[0.99]">
                            Принимаю условия
                        </button>
                    </form>
                )}
            </div>
        </main>
    );
}
