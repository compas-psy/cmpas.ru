export default function ConsentDonePage() {
    return (
        <main className="min-h-screen bg-[#faf8f5] px-4 py-8 text-[#1f2a24]">
            <div className="mx-auto max-w-xl rounded-3xl border border-[#d9d2c2] bg-white p-8 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">✓</div>
                <h1 className="text-2xl font-bold tracking-tight">Согласие подтверждено</h1>
                <p className="mt-3 text-sm leading-6 text-[#5d665f]">
                    Спасибо. Информация зафиксирована в карточке клиента у специалиста.
                </p>
            </div>
        </main>
    );
}
