"use client"

import Image from "next/image"

export default function VerifyRequestPage() {
    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8 bg-white">
            <div className="flex w-full max-w-[1200px] gap-8 items-center justify-center">

                {/* Left Side - Message Card */}
                <div className="w-full max-w-[420px] flex flex-col gap-6">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 text-[#3D5A4D]">
                            <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L2 22H22L12 2Z" />
                            </svg>
                        </div>
                        <span className="text-[#1F2937] text-lg font-semibold tracking-wide">
                            КОМПАС
                        </span>
                    </div>

                    <div className="bg-[#2E453B] rounded-[24px] p-8 shadow-xl text-center">
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>

                        <h1 className="text-2xl font-semibold text-white mb-4">
                            Проверьте почту
                        </h1>

                        <p className="text-white/80 text-base mb-8 leading-relaxed">
                            Мы отправили вам ссылку для входа.<br />
                            Проверьте свою почту и перейдите по ссылке.
                        </p>

                        <div className="bg-white/5 rounded-[16px] p-4 border border-white/10">
                            <p className="text-sm text-white/50">
                                💡 Ссылка действительна 24 часа.<br />
                                Не пришло? Проверьте папку "Спам".
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
