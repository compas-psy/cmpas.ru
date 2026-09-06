import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { checkUserAcceptance, acceptDocumentsByIds, toggleAdsConsent, getAdsConsentStatus } from "@/app/legal/actions"
import Image from "next/image"
import { AcceptButton } from "./AcceptButton"
import { getActiveLegalDocument, legalDocTitle, normalizeLegalDocUrl } from "@/lib/legal-documents"

type LegalDoc = { id: string; type: string; url: string; version: string }

export default async function LegalAcceptancePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
    const session = await auth()
    if (!session?.user?.id) return redirect("/auth")

    const [{ needsAcceptance }, adsDoc, adsStatusRaw, query] = await Promise.all([
        checkUserAcceptance(),
        getActiveLegalDocument("ADS"),
        getAdsConsentStatus(),
        searchParams,
    ])

    const requiredDocs = (needsAcceptance || []) as LegalDoc[]
    if (requiredDocs.length === 0) {
        return redirect("/diary")
    }
    const adsAccepted = Boolean((adsStatusRaw as { isAccepted?: boolean }).isAccepted)
    const showAds = Boolean(adsDoc && !adsAccepted)

    async function handleAccept(formData: FormData) {
        "use server"
        if (!session?.user?.id || !requiredDocs) return

        const acceptedRequired = requiredDocs.every((doc) => formData.get(`accept_${doc.id}`) === "yes")
        if (!acceptedRequired) {
            redirect("/legal-acceptance?error=required")
        }

        await acceptDocumentsByIds(requiredDocs.map((doc) => doc.id))

        if (adsDoc && formData.get("accept_ads") === "yes") {
            await toggleAdsConsent(true)
        }

        redirect("/diary")
    }

    return (
        <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4">
            <div className="bg-white p-8 md:p-12 rounded-2xl shadow-xl w-full max-w-lg text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#faf8f5] flex items-center justify-center overflow-hidden">
                        <Image src="/logo-tree.png" alt="Compas Logo" width={40} height={40} className="object-contain" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-[#1a1a1a] mb-4">Мы обновили правила</h1>

                <p className="text-[#1a1a1a]/70 mb-8 text-sm leading-relaxed">
                    Для продолжения работы с сервисом необходимо ознакомиться и явно принять обязательные документы. Согласие на рекламу — отдельно и необязательно.
                </p>

                <form action={handleAccept} className="text-left">
                    <div className="flex flex-col gap-3 mb-6">
                        {requiredDocs.map((doc) => (
                            <label
                                key={doc.id}
                                className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e6dfd1] bg-gray-50 p-4 text-sm text-[#1a1a1a]/80"
                            >
                                <input
                                    required
                                    type="checkbox"
                                    name={`accept_${doc.id}`}
                                    value="yes"
                                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-[#c9a961] accent-[#1a4d3a]"
                                />
                                <span>
                                    Я принимаю{' '}
                                    <a
                                        href={normalizeLegalDocUrl(doc.url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-semibold text-[#1a4d3a] underline underline-offset-2 hover:text-[#c9a961]"
                                    >
                                        {legalDocTitle(doc.type)}
                                    </a>{' '}
                                    <span className="text-[#1a1a1a]/40">(версия {doc.version})</span>
                                </span>
                            </label>
                        ))}

                        {showAds && adsDoc ? (
                            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e6dfd1] bg-[#faf8f5] p-4 text-sm text-[#1a1a1a]/80">
                                <input
                                    type="checkbox"
                                    name="accept_ads"
                                    value="yes"
                                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-[#c9a961] accent-[#1a4d3a]"
                                />
                                <span>
                                    Согласен(на) получать{' '}
                                    <a
                                        href={normalizeLegalDocUrl(adsDoc.url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-semibold text-[#1a4d3a] underline underline-offset-2 hover:text-[#c9a961]"
                                    >
                                        рекламные и информационные сообщения
                                    </a>{' '}
                                    от CMPAS{' '}
                                    <span className="text-[#1a1a1a]/40">(необязательно, версия {adsDoc.version})</span>
                                </span>
                            </label>
                        ) : null}
                    </div>

                    {query.error === "required" ? (
                        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                            Для продолжения отметьте все обязательные документы.
                        </p>
                    ) : null}

                    <p className="text-xs text-[#1a1a1a]/50 mb-4 leading-relaxed text-center">
                        Принятие будет зафиксировано в журнале сервиса с версией документа и датой.
                    </p>

                    <AcceptButton />
                </form>
            </div>
        </div>
    )
}
