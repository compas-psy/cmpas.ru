import Link from "next/link"
import { ShieldAlert } from "lucide-react"

export default function BlockedPage() {
    return (
        <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4">
            <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-xl p-8 lg:p-10 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
                    <ShieldAlert size={32} />
                </div>

                <h1 className="text-2xl font-bold text-[#1a1a1a] mb-4">
                    Доступ ограничен
                </h1>

                <p className="text-[#1a1a1a]/70 mb-8 leading-relaxed">
                    Ваш аккаунт был заблокирован администратором платформы. Если вы считаете, что произошла ошибка, пожалуйста, обратитесь в службу поддержки.
                </p>

                <Link
                    href="/"
                    className="w-full bg-[#1a4d3a] hover:bg-[#1a4d3a]/90 text-white rounded-2xl px-6 py-4 font-medium transition-colors"
                >
                    Вернуться на главную
                </Link>
            </div>
        </div>
    )
}
