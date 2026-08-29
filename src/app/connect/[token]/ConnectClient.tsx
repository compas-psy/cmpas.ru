'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, ShieldCheck } from 'lucide-react';
import { extractFirstName } from '@/lib/person-name';

export function ConnectClient(props: {
    channel: 'telegram' | 'max' | 'auto';
    smartLink: string;
    telegramLink: string | null;
    maxLink: string | null;
    clientName: string;
    psychologistName: string;
}) {
    const [copied, setCopied] = useState(false);
    const [autoOpened, setAutoOpened] = useState(false);
    const firstName = useMemo(() => extractFirstName(props.clientName) || 'Клиент', [props.clientName]);
    // MAX works in Russia without a VPN; Telegram may require one — prefer MAX
    // whenever the psychologist didn't ask for a specific channel.
    const selectedLink = props.channel === 'telegram'
        ? props.telegramLink
        : props.channel === 'max'
            ? props.maxLink
            : (props.maxLink || props.telegramLink);
    const channelName = props.channel === 'telegram' ? 'Telegram' : props.channel === 'max' ? 'MAX' : null;

    useEffect(() => {
        const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
        if (!mobile || !selectedLink) return;
        const timer = window.setTimeout(() => {
            setAutoOpened(true);
            window.location.assign(selectedLink);
        }, 350);
        return () => window.clearTimeout(timer);
    }, [selectedLink]);

    async function copyLink() {
        await navigator.clipboard.writeText(props.smartLink);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
    }

    const buttonClass = 'w-full min-h-14 rounded-2xl font-semibold flex items-center justify-center gap-2 px-5 active:scale-[0.99] transition-transform';

    return (
        <main className="min-h-dvh bg-[#F5F3EE] text-[#183D33] flex items-center justify-center p-4 sm:p-8">
            <section className="w-full max-w-lg rounded-[28px] bg-white border border-[#DDE4DF] shadow-[0_24px_80px_rgba(24,61,51,0.12)] overflow-hidden">
                <div className="h-2 bg-[#2F6B5A]" />
                <div className="p-6 sm:p-9">
                    <div className="w-14 h-14 rounded-2xl bg-[#E8F1ED] flex items-center justify-center mb-6">
                        <MessageCircle className="w-7 h-7 text-[#2F6B5A]" />
                    </div>

                    <p className="text-sm text-[#6C7B75] mb-2">{firstName}, всё почти готово</p>
                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">
                        {channelName ? `Подключите уведомления в ${channelName}` : 'Куда присылать уведомления?'}
                    </h1>
                    <p className="mt-4 text-[15px] leading-6 text-[#53645D]">
                        ПРАКТИКА будет присылать только подтверждения, напоминания, переносы и отмены встреч со специалистом {props.psychologistName}.
                    </p>

                    <div className="mt-7 space-y-3">
                        {(props.channel === 'auto' || props.channel === 'max') && props.maxLink && (
                            <a href={props.maxLink} className={`${buttonClass} bg-[#2F6B5A] text-white`}>
                                <span className="flex flex-col items-center leading-tight">
                                    <span>Подключить MAX</span>
                                    <span className="text-xs font-normal opacity-80">работает в России без VPN</span>
                                </span>
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        )}
                        {(props.channel === 'max' || props.channel === 'auto') && !props.maxLink && (
                            <div className="rounded-2xl border border-[#E6D8B7] bg-[#FFF9E9] p-4 text-sm text-[#6B5A2D]">
                                Подключение MAX пока не настроено специалистом. Используйте Telegram ниже.
                            </div>
                        )}
                        {(props.channel === 'auto' || props.channel === 'telegram') && props.telegramLink && (
                            <a href={props.telegramLink} className={`${buttonClass} bg-[#2F6B5A] text-white`}>
                                <span className="flex flex-col items-center leading-tight">
                                    <span>Подключить Telegram</span>
                                    <span className="text-xs font-normal opacity-80">может потребоваться VPN в России</span>
                                </span>
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={copyLink}
                        className="mt-3 w-full min-h-12 rounded-2xl border border-[#D6E0DB] bg-white font-medium flex items-center justify-center gap-2 px-5"
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
                    </button>

                    {autoOpened && (
                        <p className="mt-3 text-center text-xs text-[#75847E]">
                            Если приложение не открылось, нажмите кнопку выше.
                        </p>
                    )}

                    <div className="mt-7 pt-5 border-t border-[#E7ECE9] flex gap-3 text-xs leading-5 text-[#6C7B75]">
                        <ShieldCheck className="w-5 h-5 text-[#2F6B5A] shrink-0" />
                        <p>Подключение можно отключить в любой момент. Ссылка одноразовая и не содержит имени, телефона или сведений о консультации.</p>
                    </div>
                </div>
            </section>
        </main>
    );
}
