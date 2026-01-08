"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import Link from "next/link"

export default function AuthPage() {
    const [email, setEmail] = useState("")
    const [loading, setLoading] = useState(false)

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        await signIn("email", { email, callbackUrl: "/psidairy" })
        setLoading(false)
    }

    const handleYandexSignIn = async () => {
        await signIn("yandex", { callbackUrl: "/psidairy" })
    }

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">
            <Link href="/psidairy" className="absolute top-8 left-8 text-neutral-500 hover:text-neutral-900 transition-colors">
                ← На главную
            </Link>

            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-neutral-100">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-serif text-neutral-900 mb-2">Вход в Compas</h1>
                    <p className="text-neutral-500 text-sm">Войдите, чтобы управлять заказами</p>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={handleYandexSignIn}
                        className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#FC3F1D] hover:bg-[#E63411] text-white rounded-xl font-medium transition-all transform hover:scale-[1.01]"
                    >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                            <path d="M10.966 21H18V12.185h-2.188c-3.15 0-3.605 2.193-3.633 4.293L10.966 21zm-7.662 0h4.298l4.47-11.233-1.66-3.79H6.84L2.146 18.06l-.506-1.92H.39l.758 2.65c.348 1.127 1.06 1.77 1.944 1.88.073.007.143.022.214.03l-.002.3z" />
                        </svg>
                        Войти через Яндекс ID
                    </button>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-neutral-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-neutral-500">или через почту</span>
                        </div>
                    </div>

                    <form onSubmit={handleEmailSignIn} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="sr-only">Email</label>
                            <input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] outline-none transition-all placeholder:text-neutral-400 text-neutral-900"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-medium transition-all transform hover:scale-[1.01] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? "Отправляем ссылку..." : "Получить код входа"}
                        </button>
                    </form>
                </div>

                <p className="mt-8 text-center text-xs text-neutral-400">
                    Продолжая, вы соглашаетесь с <Link href="/policy" className="underline hover:text-neutral-600">политикой конфиденциальности</Link>
                </p>
            </div>
        </div>
    )
}
