import { CheckCircle2, Clock3, Link2Off, ShieldCheck, TriangleAlert } from 'lucide-react';

const copy = {
    ok: {
        title: 'Уведомления подключены',
        text: 'Готово. Подтверждения, напоминания, переносы и отмены встреч будут приходить в выбранный мессенджер.',
        Icon: CheckCircle2,
    },
    used: {
        title: 'Ссылка уже использована',
        text: 'Канал, вероятно, уже подключён. Если сообщения не приходят, попросите специалиста отправить новую ссылку.',
        Icon: Link2Off,
    },
    expired: {
        title: 'Срок действия ссылки истёк',
        text: 'Попросите специалиста отправить новое приглашение. Это защищает вашу карточку от случайной привязки.',
        Icon: Clock3,
    },
    invalid: {
        title: 'Не удалось подтвердить Telegram',
        text: 'Закройте страницу и повторите подключение по сообщению от специалиста.',
        Icon: TriangleAlert,
    },
    error: {
        title: 'Подключение не завершено',
        text: 'Попробуйте снова или попросите специалиста отправить новую ссылку.',
        Icon: TriangleAlert,
    },
} as const;

export default async function ConnectSuccessPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; channel?: string }>;
}) {
    const params = await searchParams;
    const status = params.status && params.status in copy ? params.status as keyof typeof copy : 'error';
    const item = copy[status];
    const Icon = item.Icon;

    return (
        <main className="min-h-dvh bg-[#F5F3EE] text-[#183D33] flex items-center justify-center p-4">
            <section className="w-full max-w-md rounded-[28px] bg-white border border-[#DDE4DF] shadow-[0_24px_80px_rgba(24,61,51,0.12)] p-7 sm:p-9 text-center">
                <div className="w-16 h-16 rounded-full bg-[#E8F1ED] flex items-center justify-center mx-auto">
                    <Icon className="w-8 h-8 text-[#2F6B5A]" />
                </div>
                <h1 className="mt-5 text-2xl font-semibold tracking-tight">{item.title}</h1>
                <p className="mt-3 text-[15px] leading-6 text-[#60716A]">{item.text}</p>
                <div className="mt-7 pt-5 border-t border-[#E7ECE9] flex items-start gap-3 text-left text-xs leading-5 text-[#71807A]">
                    <ShieldCheck className="w-5 h-5 text-[#2F6B5A] shrink-0" />
                    <p>КОМПАС использует подключение только для сервисных сообщений, связанных с вашими записями.</p>
                </div>
                <p className="mt-5 text-xs text-[#85918C]">Эту страницу можно закрыть.</p>
            </section>
        </main>
    );
}
