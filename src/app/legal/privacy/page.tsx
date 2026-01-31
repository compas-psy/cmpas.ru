import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Политика конфиденциальности | Ежедневник Психолога",
    description: "Политика конфиденциальности сайта cmpas.ru",
}

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-[#faf8f5]">
            {/* Header */}
            <header className="bg-[#1a4d3a] py-6">
                <div className="container mx-auto px-4">
                    <Link
                        href="/"
                        className="flex items-center gap-3 hover:opacity-90 transition-opacity w-fit"
                    >
                        <Image
                            src="/logo-tree.png"
                            alt="Compas Logo"
                            width={32}
                            height={32}
                            className="object-contain"
                        />
                        <span className="text-xl font-semibold text-white tracking-wide">
                            ЕЖЕДНЕВНИК ПСИХОЛОГА
                        </span>
                    </Link>
                </div>
            </header>

            {/* Content */}
            <main className="container mx-auto px-4 py-12 max-w-4xl">
                <h1 className="text-3xl font-bold text-[#1a4d3a] mb-8">
                    Политика конфиденциальности
                </h1>

                {/* PDF Embed */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <iframe
                        src="/legal/privacy-policy.pdf"
                        className="w-full h-[800px]"
                        title="Политика конфиденциальности"
                    />
                </div>

                {/* Download Link */}
                <div className="mt-6 text-center">
                    <a
                        href="/legal/privacy-policy.pdf"
                        download
                        className="inline-flex items-center gap-2 text-[#1a4d3a] hover:text-[#c9a961] transition-colors"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Скачать PDF
                    </a>
                </div>

                {/* Back Link */}
                <div className="mt-8 text-center">
                    <Link
                        href="/"
                        className="text-sm text-[#1a4d3a]/60 hover:text-[#1a4d3a] transition-colors"
                    >
                        ← Вернуться на главную
                    </Link>
                </div>
            </main>
        </div>
    )
}
