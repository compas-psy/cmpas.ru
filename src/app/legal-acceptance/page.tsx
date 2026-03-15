import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { checkUserAcceptance, acceptDocumentsByIds } from "@/app/legal/actions"
import Image from "next/image"
import { AcceptButton } from "./AcceptButton"

export default async function LegalAcceptancePage() {
    const session = await auth()
    if (!session?.user?.id) return redirect("/auth")

    const { needsAcceptance } = await checkUserAcceptance(session.user.id)
    if (!needsAcceptance || needsAcceptance.length === 0) {
        return redirect("/diary")
    }

    async function handleAccept() {
        "use server"
        if (!session?.user?.id || !needsAcceptance) return;
        
        await acceptDocumentsByIds(
            session.user.id, 
            needsAcceptance.map((d: { id: string }) => d.id)
        )
        redirect("/diary")
    }

    return (
        <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4">
            <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl w-full max-w-lg text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#faf8f5] flex items-center justify-center overflow-hidden">
                        <Image src="/logo-tree.png" alt="Compas Logo" width={40} height={40} className="object-contain" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-[#1a1a1a] mb-4">
                    Мы обновили правила
                </h1>
                
                <p className="text-[#1a1a1a]/70 mb-8 text-sm leading-relaxed">
                    Для продолжения работы с сервисом необходимо ознакомиться и принять обновленные версии следующих документов:
                </p>

                <div className="flex flex-col gap-3 mb-8 text-left">
                    {needsAcceptance.map((doc: { id: string; type: string; url: string; }) => (
                        <div key={doc.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex justify-between items-center">
                            <span className="font-medium text-[#1a1a1a]">
                                {doc.type === "TERMS" ? "Пользовательское соглашение" : "Политика конфиденциальности"}
                            </span>
                            <a href={`/legal/${doc.type.toLowerCase()}`} target="_blank" className="text-sm font-semibold text-[#c9a961] hover:text-[#b49652] transition-colors underline underline-offset-4">
                                Читать
                            </a>
                        </div>
                    ))}
                </div>

                <form action={handleAccept}>
                    <AcceptButton />
                </form>
            </div>
        </div>
    )
}
