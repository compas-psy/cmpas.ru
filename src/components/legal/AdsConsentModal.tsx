"use client"

import { useState, useEffect } from "react"
import { toggleAdsConsentForUser } from "@/app/diary/actions/settings"
import { ShieldAlert, X } from "lucide-react"

export function AdsConsentModal({ userId }: { userId: string }) {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        // `userId` here only namespaces a non-secret "already prompted on this
        // device" flag — the mutation itself (toggleAdsConsentForUser) derives
        // the real identity from the session, never from this prop.
        const hasPrompted = localStorage.getItem(`ads_prompt_${userId}`)
        if (!hasPrompted) {
            // Slight delay so it doesn't pop up instantly on page load
            const timer = setTimeout(() => setIsOpen(true), 2000)
            return () => clearTimeout(timer)
        }
    }, [userId])

    const handleAccept = async () => {
        setIsLoading(true)
        try {
            await toggleAdsConsentForUser(true)
            localStorage.setItem(`ads_prompt_${userId}`, "true")
            setIsOpen(false)
        } catch (error) {
            console.error("Failed to accept ads:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleDecline = () => {
        localStorage.setItem(`ads_prompt_${userId}`, "true")
        setIsOpen(false)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-full bg-[#f4ebd0] flex items-center justify-center text-[#c9a961]">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <button 
                            onClick={handleDecline}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <h3 className="text-xl font-bold text-[#1a1a1a] mb-2">
                        Хотите получать полезные материалы?
                    </h3>
                    <p className="text-[#1a1a1a] opacity-70 mb-6 text-sm leading-relaxed">
                        Мы иногда отправляем подборки статей по психологии, анонсы супервизий и обучающих программ от наших партнеров. Вы можете согласиться сейчас и изменить это решение позже в настройках профиля.
                    </p>
                    
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleAccept}
                            disabled={isLoading}
                            className="w-full bg-[#1a4d3a] hover:bg-[#133729] text-white rounded-xl py-4 font-medium transition-colors disabled:opacity-50"
                        >
                            {isLoading ? "Сохраняем..." : "Да, получать материалы"}
                        </button>
                        <button
                            onClick={handleDecline}
                            disabled={isLoading}
                            className="w-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 rounded-xl py-4 font-medium transition-colors disabled:opacity-50"
                        >
                            Нет, спасибо
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
