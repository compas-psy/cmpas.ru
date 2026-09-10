import { Link2Off, Clock, HelpCircle } from 'lucide-react';
import type { PublicInviteProblem } from '@/lib/channel-binding';

/**
 * Ссылка не открылась — экран объясняет почему и что делать.
 *
 * Живой случай 09.09.2026: клиент открыл настоящую ссылку и увидел голое
 * «Страница не найдена». Он написал специалисту «чего-то не грузится бот» —
 * то есть решил, что сломан бот. На деле ссылка уже сработала (её открыл сам
 * специалист, проверяя). Из прежнего экрана этого было не понять никому.
 *
 * Поэтому здесь три вещи и ровно в этом порядке: что произошло, почему это
 * не поломка, и один следующий шаг. Просить клиента «связаться с
 * поддержкой» нечестно — ссылку выдаёт специалист, к нему и надо.
 */
const COPY: Record<PublicInviteProblem, {
    icon: typeof Link2Off;
    title: string;
    body: string;
    next: string;
}> = {
    used: {
        icon: Link2Off,
        title: 'Эта ссылка уже сработала',
        body: 'Ссылка одноразовая: по ней подключаются один раз, и она гаснет. Возможно, уведомления уже подключены — проверьте чат с ботом.',
        next: 'Если чата с ботом нет, попросите специалиста прислать новую ссылку — это займёт у него несколько секунд.',
    },
    expired: {
        icon: Clock,
        title: 'Срок ссылки истёк',
        body: 'Ссылка действует трое суток — так безопаснее: старая ссылка, попавшая не в те руки, ничего не откроет.',
        next: 'Попросите специалиста прислать новую — это займёт у него несколько секунд.',
    },
    not_found: {
        icon: HelpCircle,
        title: 'Такой ссылки нет',
        body: 'Скорее всего, адрес скопировался не целиком: у этих ссылок длинный хвост, и мессенджеры иногда обрезают его при пересылке.',
        next: 'Откройте ссылку из сообщения специалиста целиком или попросите прислать её ещё раз.',
    },
};

export function InviteProblem({ problem }: { problem: PublicInviteProblem }) {
    const { icon: Icon, title, body, next } = COPY[problem];

    return (
        <main className="min-h-dvh bg-[#F5F3EE] text-[#183D33] flex items-center justify-center p-4 sm:p-8">
            <section className="w-full max-w-lg rounded-[28px] bg-white border border-[#DDE4DF] shadow-[0_24px_80px_rgba(24,61,51,0.12)] overflow-hidden">
                <div className="h-2 bg-[#C9A961]" />
                <div className="p-6 sm:p-9">
                    <div className="w-14 h-14 rounded-2xl bg-[#FBF3E2] flex items-center justify-center mb-6">
                        <Icon className="w-7 h-7 text-[#9A7322]" />
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">{title}</h1>
                    <p className="mt-4 text-[15px] leading-6 text-[#53645D]">{body}</p>

                    <div className="mt-6 rounded-2xl bg-[#F5F3EE] p-4 text-[15px] leading-6 text-[#183D33]">
                        {next}
                    </div>

                    {/* Ничего не сломалось — и это стоит сказать прямо: человек
                        пришёл сюда, решив, что сломан бот. */}
                    <p className="mt-6 text-[13px] leading-5 text-[#6C7B75]">
                        Ваши записи и напоминания это не затрагивает — они остаются в силе.
                    </p>
                </div>
            </section>
        </main>
    );
}
