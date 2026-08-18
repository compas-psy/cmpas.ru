import { getClientRescheduleSession } from './actions';
import { RescheduleClient } from './RescheduleClient';

export const dynamic = 'force-dynamic';

function ErrorCard({ title, text }: { title: string; text: string }) {
    return (
        <main className="min-h-screen bg-[#faf8f5] px-4 py-8 text-[#1f2a24]">
            <div className="mx-auto max-w-md rounded-3xl border border-[#e6dfd1] bg-white p-6 shadow-sm sm:p-8 text-center">
                <h1 className="text-xl font-bold text-[#D4183D] mb-2">{title}</h1>
                <p className="text-sm text-[#5d665f]">{text}</p>
            </div>
        </main>
    );
}

export default async function ClientReschedulePage({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ t?: string }> }) {
    const { sessionId } = await params;
    const { t: token } = await searchParams;

    if (!token) {
        return <ErrorCard title="Ссылка недействительна" text="Попросите специалиста отправить новое уведомление." />;
    }

    let session;
    try {
        session = await getClientRescheduleSession(sessionId, token);
    } catch (e) {
        return <ErrorCard title="Ссылка недействительна" text={e instanceof Error ? e.message : 'Сессия не найдена или ссылка устарела.'} />;
    }

    if (session.status === 'cancelled') {
        return <ErrorCard title="Сессия отменена" text="Эта встреча уже отменена, перенести её нельзя. Свяжитесь со специалистом, чтобы записаться заново." />;
    }

    return <RescheduleClient sessionId={sessionId} token={token} initial={session} />;
}
