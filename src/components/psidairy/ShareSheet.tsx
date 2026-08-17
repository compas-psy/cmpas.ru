'use client';

import { useState } from 'react';
import { Copy, QrCode, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { buildTelegramShareUrl, buildWhatsAppShareUrl, humanizeUrl } from '@/lib/share/buildShareUrls';

type ShareSheetProps = {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    text: string;
    title?: string;
};

async function copyToClipboard(value: string): Promise<boolean> {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value);
            return true;
        }
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
    } catch {
        return false;
    }
}

/** One "Поделиться" bottom sheet, used identically everywhere a booking link is shared. */
export function ShareSheet({ isOpen, onClose, url, text, title = 'Поделиться ссылкой' }: ShareSheetProps) {
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [loadingQr, setLoadingQr] = useState(false);

    if (!isOpen) return null;

    const handleMax = async () => {
        // MAX has no public web share-intent URL — use the OS share sheet where
        // available (covers MAX if the app is installed), copy as an honest fallback.
        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({ title, text, url });
                return;
            } catch {
                return;
            }
        }
        const copied = await copyToClipboard(`${text} ${url}`);
        toast[copied ? 'success' : 'error'](copied ? 'Ссылка скопирована — вставьте её в MAX' : 'Не удалось скопировать ссылку');
    };

    const handleTelegram = () => {
        window.open(buildTelegramShareUrl(url, text), '_blank');
    };

    const handleWhatsApp = () => {
        window.open(buildWhatsAppShareUrl(url, text), '_blank');
    };

    const handleCopy = async () => {
        const copied = await copyToClipboard(url);
        toast[copied ? 'success' : 'error'](copied ? 'Ссылка скопирована' : 'Не удалось скопировать ссылку');
    };

    const handleShowQr = async () => {
        if (qrDataUrl) { setQrDataUrl(null); return; }
        setLoadingQr(true);
        try {
            const QRCode = (await import('qrcode')).default;
            setQrDataUrl(await QRCode.toDataURL(url, { margin: 1, width: 240 }));
        } catch {
            toast.error('Не удалось построить QR-код');
        } finally {
            setLoadingQr(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl border border-border shadow-lg p-5 pb-8 sm:pb-5 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[15px] font-bold text-foreground">{title}</h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center gap-2 bg-sage-50 border border-sage-200 rounded-xl px-3 py-2.5 mb-4">
                    <span className="flex-1 text-[13px] font-medium text-foreground truncate">{humanizeUrl(url)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleMax} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold bg-[#5D5FEF]/10 text-[#5D5FEF] hover:bg-[#5D5FEF]/20 transition-colors">
                        <Send className="w-3.5 h-3.5" /> Max
                    </button>
                    <button onClick={handleTelegram} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold bg-[#2AABEE]/10 text-[#2AABEE] hover:bg-[#2AABEE]/20 transition-colors">
                        <Send className="w-3.5 h-3.5" /> Telegram
                    </button>
                    <button onClick={handleWhatsApp} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors">
                        <Send className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                    <button onClick={handleCopy} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold bg-muted/50 text-foreground hover:bg-muted transition-colors">
                        <Copy className="w-3.5 h-3.5" /> Скопировать
                    </button>
                </div>

                <button
                    onClick={handleShowQr}
                    disabled={loadingQr}
                    className="w-full flex items-center justify-center gap-1.5 mt-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold border border-border hover:bg-sage-50 transition-colors disabled:opacity-60"
                >
                    <QrCode className="w-3.5 h-3.5" /> {qrDataUrl ? 'Скрыть QR' : loadingQr ? 'Строим QR…' : 'Показать QR'}
                </button>

                {qrDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrDataUrl} alt="QR-код ссылки для записи" className="w-40 h-40 mx-auto mt-4 rounded-xl border border-border" />
                )}
            </div>
        </div>
    );
}

type ShareButtonProps = {
    /** A ready URL, or a function resolving one — called only when the sheet is opened,
     * so call sites that fetch a signed link don't hit the server for every item rendered. */
    url: string | (() => Promise<string>);
    text: string;
    label?: string;
    title?: string;
    className?: string;
    icon?: React.ReactNode;
};

/** Trigger + sheet in one, for call sites that just need a "Поделиться" button. */
export function ShareButton({ url, text, label = 'Поделиться', title, className, icon }: ShareButtonProps) {
    const [open, setOpen] = useState(false);
    const [resolvedUrl, setResolvedUrl] = useState<string | null>(typeof url === 'string' ? url : null);
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        if (typeof url === 'string') {
            setOpen(true);
            return;
        }
        setLoading(true);
        try {
            setResolvedUrl(await url());
            setOpen(true);
        } catch {
            toast.error('Не удалось получить ссылку');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button onClick={handleClick} disabled={loading} className={className}>
                {icon}
                {label}
            </button>
            {resolvedUrl && <ShareSheet isOpen={open} onClose={() => setOpen(false)} url={resolvedUrl} text={text} title={title} />}
        </>
    );
}
