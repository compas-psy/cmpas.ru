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
        <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-6">
            <div className="w-full max-w-[1152px] flex gap-6">
                {/* Left Side - Auth Card */}
                <div className="w-[448px] flex flex-col">
                    {/* Logo */}
                    <div className="flex items-center gap-2 mb-8">
                        <div className="w-6 h-6 bg-[#3D5A4D] rounded"></div>
                        <span className="text-[#1F2937] text-base font-normal" style={{ fontFamily: 'Segoe UI' }}>
                            КОМПАС
                        </span>
                    </div>

                    {/* Auth Container */}
                    <div className="bg-[#3D5A4D] rounded-3xl p-10 shadow-[0px_8px_16px_rgba(0,0,0,0.1)]">
                        {/* Yandex Button */}
                        <button
                            onClick={handleYandexSignIn}
                            className="w-full h-12 bg-white rounded-2xl flex items-center justify-center gap-2 mb-6 hover:bg-gray-50 transition-colors"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M13 3H8V13H10V9.75C10 8.75 10.03 7.37 10.09 5.91H10.2C10.46 6.79 10.74 7.57 11.04 8.25L13.15 13H15L12.89 8.25C12.59 7.57 12.31 6.77 12.05 5.94H11.94C11.88 7.28 11.84 8.57 11.84 9.5V13H14V3H13Z" fill="#FC3F1D" />
                            </svg>
                            <span className="text-[#1F2937] text-sm font-medium" style={{ fontFamily: 'Segoe UI' }}>
                                Продолжить с Яндекс
                            </span>
                        </button>

                        {/* Divider */}
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/20"></div>
                            </div>
                            <div className="relative flex justify-center">
                                <span className="px-2 bg-[#3D5A4D] text-white/70 text-sm" style={{ fontFamily: 'Segoe UI' }}>
                                    или
                                </span>
                            </div>
                        </div>

                        {/* Email Input */}
                        <form onSubmit={handleEmailSignIn} className="space-y-4">
                            <input
                                type="email"
                                placeholder="Введите email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-white/50 outline-none focus:border-white/40 transition-colors"
                                style={{ fontFamily: 'Segoe UI', fontSize: '14px' }}
                            />

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 bg-white/90 hover:bg-white rounded-2xl text-[#3D5A4D] text-sm font-medium transition-colors disabled:opacity-50"
                                style={{ fontFamily: 'Segoe UI' }}
                            >
                                {loading ? "Отправляем..." : "Продолжить по email"}
                            </button>
                        </form>

                        {/* Footer */}
                        <div className="mt-8 text-center">
                            <p className="text-white/70 text-xs" style={{ fontFamily: 'Segoe UI' }}>
                                Продолжая, вы соглашаетесь с <br />
                                <a href="/policy" className="underline hover:text-white/90 transition-colors">
                                    политикой конфиденциальности
                                </a>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Side - Image */}
                <div className="flex-1 relative rounded-3xl overflow-hidden" style={{ height: '560px' }}>
                    <Image
                        src="/forest.jpg"
                        alt="Forest landscape"
                        fill
                        className="object-cover"
                        priority
                    />
                </div>
            </div>
        </div>
    )
}
