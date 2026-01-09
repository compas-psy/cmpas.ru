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
        <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8 bg-white">
            <div className="flex w-full max-w-[1200px] gap-8 items-center justify-center">

                {/* Left Side - Auth Card */}
                <div className="w-full max-w-[420px] flex flex-col gap-6">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 text-[#3D5A4D]">
                            <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L2 22H22L12 2Z" /> {/* Placeholder tree/compass icon to be replaced or use Image */}
                            </svg>
                        </div>
                        <span className="text-[#1F2937] text-lg font-semibold tracking-wide">
                            КОМПАС
                        </span>
                    </div>

                    <div className="bg-[#2E453B] rounded-[24px] p-8 shadow-xl">
                        {/* Yandex Button */}
                        <button
                            onClick={handleYandexSignIn}
                            className="w-full h-14 bg-white rounded-[16px] flex items-center justify-center gap-3 mb-6 hover:bg-gray-50 transition-all active:scale-[0.98]"
                        >
                            <Image
                                src="/yandex-logo.png"
                                alt="Яндекс"
                                width={24}
                                height={24}
                                className="object-contain"
                            />
                            <span className="text-[#1F2937] text-base font-medium">
                                Продолжить с Яндекс
                            </span>
                        </button>

                        {/* Divider */}
                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/20"></div>
                            </div>
                            <div className="relative flex justify-center">
                                <span className="px-4 bg-[#2E453B] text-white/60 text-sm uppercase tracking-wider font-medium">
                                    ИЛИ
                                </span>
                            </div>
                        </div>

                        {/* Email Form */}
                        <form onSubmit={handleEmailSignIn} className="space-y-4">
                            <input
                                type="email"
                                placeholder="Введите email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-14 px-5 bg-white/5 border border-white/10 rounded-[16px] text-white placeholder:text-white/40 outline-none focus:border-white/30 focus:bg-white/10 transition-all text-base"
                            />

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 bg-white/10 border border-white/10 hover:bg-white/20 rounded-[16px] text-white text-base font-medium transition-all disabled:opacity-50 active:scale-[0.98]"
                            >
                                {loading ? "Отправляем..." : "Продолжить по email"}
                            </button>
                        </form>

                        {/* Footer */}
                        <div className="mt-8 text-center px-4">
                            <p className="text-white/40 text-xs leading-relaxed">
                                Продолжая, вы соглашаетесь с<br />
                                <a href="/policy" className="hover:text-white/60 transition-colors border-b border-transparent hover:border-white/60 pb-0.5">
                                    политикой конфиденциальности
                                </a>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Side - Image */}
                <div className="hidden lg:block w-[600px] h-[600px] relative rounded-[32px] overflow-hidden shadow-2xl">
                    <Image
                        src="/forest.jpg"
                        alt="Atmospheric forest"
                        fill
                        className="object-cover"
                        priority
                        sizes="600px"
                    />
                </div>
            </div>
        </div>
    )
}
