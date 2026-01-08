export default function VerifyRequestPage() {
    return (
        <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl p-10 shadow-lg max-w-md text-center">
                <div className="mb-6">
                    <div className="w-16 h-16 bg-[#3D5A4D]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-[#3D5A4D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-semibold text-[#1F2937] mb-2">
                        Проверьте почту
                    </h1>
                    <p className="text-[#6B7280] text-sm">
                        Мы отправили вам ссылку для входа.<br />
                        Проверьте свою почту и перейдите по ссылке.
                    </p>
                </div>

                <div className="bg-[#F9FAFB] rounded-xl p-4">
                    <p className="text-xs text-[#6B7280]">
                        💡 Ссылка действительна в течение 24 часов.<br />
                        Не получили письмо? Проверьте папку "Спам".
                    </p>
                </div>
            </div>
        </div>
    )
}
