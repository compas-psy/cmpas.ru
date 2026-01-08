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
        try {
            await signIn("nodemailer", { email, callbackUrl: "/psidairy" })
        } catch (error) {
            console.error("Email sign-in error:", error)
        }
        setLoading(false)
    }

    const handleYandexSignIn = async () => {
        try {
            await signIn("yandex", { callbackUrl: "/psidairy" })
        } catch (error) {
            console.error("Yandex sign-in error:", error)
        }
    }

    return (
        <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-6">
            {/* Logo at top */}
            <div className="mb-8 flex items-center gap-2">
                <Image
                    src="/logo-tree.png"
                    alt="КОМПАС"
                    width={24}
                    height={24}
                    className="object-contain"
                />
                <span className="text-[#1F2937] text-base font-normal" style={{ fontFamily: 'sans-serif' }}>
                    КОМПАС
                </span>
            </div>

            <div className="flex gap-6 w-full max-w-[1000px]">
                {/* Left Side - Auth Card */}
                <div className="w-[420px]">
                    <div className="bg-[#3D5A4D] rounded-3xl p-8 shadow-lg">
                        {/* Yandex Button */}
                        <button
                            onClick={handleYandexSignIn}
                            className="w-full h-12 bg-white rounded-2xl flex items-center justify-center gap-2 mb-4 hover:bg-gray-50 transition-colors"
                        >
                            <Image
                                src="/yandex-logo.png"
                                alt="Яндекс"
                                width={20}
                                height={20}
                                className="object-contain"
                            />
                            <span className="text-[#1F2937] text-sm font-medium" style={{ fontFamily: 'sans-serif' }}>
                                Продолжить с Яндекс
                            </span>
                        </button>

                        {/* Divider */}
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/30"></div>
                            </div>
                            <div className="relative flex justify-center">
                                <span className="px-3 bg-[#3D5A4D] text-white/80 text-sm" style={{ fontFamily: 'sans-serif' }}>
                                    или
                                </span>
                            </div>
                        </div>

                        {/* Email Form */}
                        <form onSubmit={handleEmailSignIn} className="space-y-3">
                            <input
                                type="email"
                                placeholder="Введите email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-12 px-4 bg-white/10 border border-white/30 rounded-2xl text-white placeholder:text-white/60 outline-none focus:border-white/50 transition-colors text-sm"
                                style={{ fontFamily: 'sans-serif' }}
                            />

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 bg-white/10 border border-white/30 hover:bg-white/20 rounded-2xl text-white text-sm font-medium transition-colors disabled:opacity-50"
                                style={{ fontFamily: 'sans-serif' }}
                            >
                                {loading ? "Отправляем..." : "Продолжить по email"}
                            </button>
                        </form>

                        {/* Footer */}
                        <div className="mt-6 text-center">
                            <p className="text-white/70 text-xs leading-relaxed" style={{ fontFamily: 'sans-serif' }}>
                                Продолжая, вы соглашаетесь с условиями<br />
                                <a href="/policy" className="underline hover:text-white/90 transition-colors">
                                    политикой конфиденциальности
                                </a>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Side - Image */}
                <div className="flex-1 relative rounded-3xl overflow-hidden" style={{ minHeight: '500px' }}>
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
