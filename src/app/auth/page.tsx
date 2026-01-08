"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import Image from "next/image"

export default function AuthPage() {
    const [email, setEmail] = useState("")
    const [loading, setLoading] = useState(false)

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        await signIn("email", { email, callbackUrl: "/onboarding" })
        setLoading(false)
    }

    const handleYandexSignIn = async () => {
        await signIn("yandex", { callbackUrl: "/onboarding" })
    }

    return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8">
            <div className="flex gap-8 max-w-5xl w-full">
                {/* Left Card - Auth Form */}
                <div className="bg-[#3D5A4D] text-white rounded-3xl p-10 w-[440px] flex flex-col justify-center shadow-2xl">
                    {/* Logo */}
                    <div className="flex items-center gap-2 mb-12">
                        <Image src="/forest.jpg" alt="КОМПАС" width={24} height={24} className="rounded" />
                        <span className="text-lg font-medium tracking-wide">КОМПАС</span>
                    </div>

                    {/* Yandex Button */}
                    <button
                        onClick={handleYandexSignIn}
                        className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white text-neutral-900 rounded-xl font-medium transition-all hover:scale-[1.02] mb-6"
                    >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-red-600">
                            <path d="M13 3h5v18h-2v-6.25c0-1-.03-2.37-.09-4.09h-.11c-.26.88-.54 1.66-.84 2.34l-3.11 7.59h-1.7L6.98 12.91c-.3-.71-.58-1.51-.84-2.41h-.11c-.05 1.34-.09 2.63-.09 3.84V21H4V3h5l2.37 6.25c.45 1.16.82 2.25 1.11 3.28h.11c.34-1.14.72-2.23 1.16-3.28L16.13 3H13z" />
                        </svg>
                        Продолжить с Яндекс
                    </button>

                    {/* Divider */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/20"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-[#3D5A4D] text-white/70">или</span>
                        </div>
                    </div>

                    {/* Email Form */}
                    <form onSubmit={handleEmailSignIn} className="space-y-4">
                        <div>
                            <input
                                id="email"
                                type="email"
                                placeholder="Введите email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-white/30 focus:border-white/30 outline-none transition-all placeholder:text-white/50 text-white"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full px-6 py-3.5 bg-white/90 hover:bg-white text-[#3D5A4D] rounded-xl font-medium transition-all hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? "Отправляем..." : "Продолжить по email"}
                        </button>
                    </form>

                    {/* Footer */}
                    <p className="mt-8 text-center text-xs text-white/60">
                        Продолжая, вы соглашаетесь с <br />
                        <a href="/policy" className="underline hover:text-white/80">политикой конфиденциальности</a>
                    </p>
                </div>

                {/* Right Image */}
                <div className="flex-1 relative rounded-3xl overflow-hidden shadow-2xl min-h-[600px]">
                    <Image
                        src="/forest.jpg"
                        alt="Forest"
                        fill
                        className="object-cover"
                        priority
                    />
                </div>
            </div>
        </div>
    )
}
