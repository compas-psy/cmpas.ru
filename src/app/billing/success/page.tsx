import Link from 'next/link';
import Image from 'next/image';

export default function BillingSuccessPage() {
    return (
        <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4">
            <div className="w-full max-w-md flex flex-col items-center text-center">
                <Link href="/diary" className="flex items-center gap-3 mb-8 hover:opacity-90 transition-opacity">
                    <Image src="/logo-tree.png" alt="ПРАКТИКА" width={36} height={36} className="object-contain" />
                    <span className="text-xl font-semibold text-[#1a4d3a] tracking-wide">ПРАКТИКА</span>
                </Link>

                <div className="w-full bg-[#1a4d3a] rounded-[32px] shadow-xl p-10 mb-6">
                    <div className="text-[#c9a961] text-6xl mb-4">✓</div>
                    <h1 className="text-2xl font-bold text-white mb-2">Оплата прошла успешно</h1>
                    <p className="text-white/70 text-sm mb-8">
                        Подписка активирована. Спасибо, что выбрали ПРАКТИКУ!
                    </p>
                    <Link
                        href="/diary"
                        className="flex items-center justify-center w-full px-5 py-4 bg-[#c9a961] text-[#1a4d3a] rounded-2xl font-semibold text-sm hover:bg-[#d4b56d] transition-colors"
                    >
                        Вернуться в приложение
                    </Link>
                </div>
            </div>
        </div>
    );
}
