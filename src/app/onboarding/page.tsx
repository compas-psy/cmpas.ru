"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { parseClientLines, type ParsedClient } from "@/lib/clients/parse"

const METHODS = [
    "Схема-терапия",
    "КПТ",
    "Гештальт-терапия",
    "Психоанализ",
    "EMDR",
    "Семейная системная терапия",
    "Экзистенциальная терапия",
    "Коучинг",
]

type StepKey = "profile" | "schedule" | "documents" | "messenger" | "firstClient" | "finish"

const STEPS: Array<{ key: StepKey; title: string }> = [
    { key: "profile", title: "Профиль" },
    { key: "schedule", title: "Расписание" },
    { key: "documents", title: "Документы" },
    { key: "messenger", title: "Мессенджер" },
    { key: "firstClient", title: "Первый клиент" },
    { key: "finish", title: "Финиш" },
]

export default function OnboardingPage() {
    const router = useRouter()
    const [stepIndex, setStepIndex] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [clientsText, setClientsText] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [docDraft, setDocDraft] = useState({
        title: "Договор / информированное согласие",
        version: new Date().toISOString().slice(0, 10),
        content: "",
        sendOnNewClient: true,
        sendOnFirstSession: true,
        requiresAcknowledgement: true,
    })
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        methods: [] as string[],
        customMethod: "",
        timezone: "Europe/Moscow",
        workDays: [true, true, true, true, true, false, false],
        startTime: "09:00",
        endTime: "18:00",
        defaultSessionDuration: 50,
        sessionBreak: 15,
        hasLunchBreak: false,
        lunchStartTime: "13:00",
        lunchEndTime: "14:00",
        basePrice: 0,
        cancellationHours: 24,
        cancellationFee: 50,
        cancellationText: "Отмена сессии возможна не позднее чем за 24 часа.",
    })

    const current = STEPS[stepIndex]
    const parsedClients = useMemo<ParsedClient[]>(() => parseClientLines(clientsText), [clientsText])
    const validParsedClients = parsedClients.filter(p => p.valid)
    const hasProfile = formData.name.trim() && (formData.methods.length > 0 || formData.customMethod.trim())

    useEffect(() => {
        fetch("/api/user/profile", { cache: "no-store" })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return
                const settings = data.psychologistSettings || {}
                setFormData(prev => ({
                    ...prev,
                    name: data.name || prev.name,
                    email: data.email || prev.email,
                    methods: Array.isArray(settings.methods) ? settings.methods : prev.methods,
                    timezone: settings.timezone || prev.timezone,
                    defaultSessionDuration: settings.defaultSessionDuration || prev.defaultSessionDuration,
                    sessionBreak: settings.sessionBreak ?? prev.sessionBreak,
                    basePrice: settings.basePrice || prev.basePrice,
                    cancellationHours: settings.cancellationHours ?? prev.cancellationHours,
                    cancellationFee: settings.cancellationFee ?? prev.cancellationFee,
                    cancellationText: settings.cancellationText || prev.cancellationText,
                }))
            })
            .catch(() => undefined)
    }, [])

    const nextStep = () => setStepIndex(i => Math.min(i + 1, STEPS.length - 1))
    const prevStep = () => setStepIndex(i => Math.max(i - 1, 0))

    const toggleMethod = (method: string) => {
        setFormData(prev => ({
            ...prev,
            methods: prev.methods.includes(method) ? prev.methods.filter(item => item !== method) : [...prev.methods, method],
        }))
    }

    const toggleWorkDay = (index: number) => {
        const workDays = [...formData.workDays]
        workDays[index] = !workDays[index]
        setFormData(prev => ({ ...prev, workDays }))
    }

    async function saveDocumentIfNeeded() {
        if (!docDraft.title.trim() || !docDraft.content.trim()) return
        const res = await fetch("/api/onboarding/client-document", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(docDraft),
        })
        if (!res.ok) throw new Error("Не удалось сохранить документ")
    }

    async function saveClientsIfNeeded() {
        if (validParsedClients.length === 0) return
        const { bulkCreateClients } = await import("@/app/diary/actions/clients")
        await bulkCreateClients(validParsedClients.map(p => ({ name: p.name, phone: p.phone, email: p.email })))
    }

    async function submitProfile() {
        const methods = [...formData.methods]
        if (formData.customMethod.trim()) methods.push(formData.customMethod.trim())
        const res = await fetch("/api/user/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: formData.name,
                methods,
                timezone: formData.timezone,
                workDays: formData.workDays,
                startTime: formData.startTime,
                endTime: formData.endTime,
                defaultSessionDuration: formData.defaultSessionDuration,
                sessionBreak: formData.sessionBreak,
                hasLunchBreak: formData.hasLunchBreak,
                lunchStartTime: formData.lunchStartTime,
                lunchEndTime: formData.lunchEndTime,
                basePrice: formData.basePrice,
                cancellationHours: formData.cancellationHours,
                cancellationFee: formData.cancellationFee,
                cancellationText: formData.cancellationText,
            }),
        })
        if (!res.ok) throw new Error("Не удалось сохранить профиль")
    }

    async function completeOnboarding() {
        setIsSubmitting(true)
        setError(null)
        try {
            await saveDocumentIfNeeded()
            await saveClientsIfNeeded()
            await submitProfile()
            router.refresh()
            router.push("/diary")
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось завершить настройку")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main className="min-h-screen bg-[#faf8f5] p-4 lg:p-8">
            <section className="mx-auto flex min-h-[640px] max-w-5xl overflow-hidden rounded-[40px] bg-white shadow-2xl">
                <aside className="hidden w-[38%] bg-[#1a4d3a] p-10 text-white md:block">
                    <div className="mb-10 text-xl font-medium tracking-[0.22em]">КОМПАС</div>
                    <h1 className="mb-4 text-3xl font-bold leading-tight">Настройка практики без лишних шагов</h1>
                    <p className="text-white/70">Профиль, расписание, документы, мессенджер и первый клиент — ровно то, что нужно для старта беты.</p>
                    <div className="mt-10 space-y-3">
                        {STEPS.map((item, index) => (
                            <div key={item.key} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${index <= stepIndex ? "bg-white/14" : "bg-white/6 text-white/50"}`}>
                                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#c9a961] text-sm font-bold text-[#1a4d3a]">{index + 1}</span>
                                <span className="text-sm font-medium">{item.title}</span>
                            </div>
                        ))}
                    </div>
                </aside>

                <div className="flex flex-1 flex-col bg-[#1a4d3a] p-6 text-white md:bg-white md:text-[#16271d] lg:p-10">
                    <div className="mb-8 flex gap-2">
                        {STEPS.map((item, index) => (
                            <div key={item.key} className={`h-1 flex-1 rounded-full ${index <= stepIndex ? "bg-[#c9a961]" : "bg-white/20 md:bg-[#e6dfd1]"}`} />
                        ))}
                    </div>

                    <div className="flex-1">
                        {current.key === "profile" && (
                            <StepCard title="Профиль практики" subtitle="Email берём из учётной записи. Остальное можно изменить позже в настройках.">
                                <Field label="Имя и фамилия">
                                    <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input" placeholder="Анна Иванова" />
                                </Field>
                                <Field label="Email">
                                    <input value={formData.email} readOnly className="input opacity-70" placeholder="email из входа" />
                                </Field>
                                <Field label="Методы">
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {METHODS.map(method => (
                                            <button key={method} type="button" onClick={() => toggleMethod(method)} className={`rounded-2xl border px-3 py-2 text-left text-sm ${formData.methods.includes(method) ? "border-[#c9a961] bg-[#c9a961]/18" : "border-white/20 bg-white/10 md:border-[#e6dfd1] md:bg-[#faf8f5]"}`}>
                                                {method}
                                            </button>
                                        ))}
                                    </div>
                                    <input value={formData.customMethod} onChange={e => setFormData({ ...formData, customMethod: e.target.value })} className="input mt-3" placeholder="Другой метод" />
                                </Field>
                            </StepCard>
                        )}

                        {current.key === "schedule" && (
                            <StepCard title="Расписание и условия" subtitle="Эти поля реально сохраняются: часовой пояс, перерыв, обед и политика отмены.">
                                <Field label="Часовой пояс">
                                    <select value={formData.timezone} onChange={e => setFormData({ ...formData, timezone: e.target.value })} className="input">
                                        <option value="Europe/Moscow">Москва</option>
                                        <option value="Europe/Helsinki">Хельсинки</option>
                                        <option value="Asia/Yekaterinburg">Екатеринбург</option>
                                        <option value="Asia/Novosibirsk">Новосибирск</option>
                                    </select>
                                </Field>
                                <Field label="Рабочие дни">
                                    <div className="grid grid-cols-7 gap-2">
                                        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, idx) => (
                                            <button key={day} type="button" onClick={() => toggleWorkDay(idx)} className={`h-11 rounded-xl text-sm font-semibold ${formData.workDays[idx] ? "bg-[#c9a961] text-[#1a4d3a]" : "bg-white/10 text-white/60 md:bg-[#faf8f5] md:text-[#7a827c]"}`}>{day}</button>
                                        ))}
                                    </div>
                                </Field>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label="Начало"><input type="time" value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} className="input" /></Field>
                                    <Field label="Конец"><input type="time" value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })} className="input" /></Field>
                                    <Field label="Сессия, минут"><input type="number" min="15" step="5" value={formData.defaultSessionDuration} onChange={e => setFormData({ ...formData, defaultSessionDuration: Number(e.target.value) || 50 })} className="input" /></Field>
                                    <Field label="Перерыв, минут"><input type="number" min="0" step="5" value={formData.sessionBreak} onChange={e => setFormData({ ...formData, sessionBreak: Number(e.target.value) || 0 })} className="input" /></Field>
                                </div>
                                <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white/10 p-3 md:bg-[#faf8f5]">
                                    <input type="checkbox" checked={formData.hasLunchBreak} onChange={e => setFormData({ ...formData, hasLunchBreak: e.target.checked })} />
                                    <span>Есть обеденный перерыв</span>
                                </label>
                                {formData.hasLunchBreak && <div className="grid gap-4 sm:grid-cols-2"><Field label="Обед с"><input type="time" value={formData.lunchStartTime} onChange={e => setFormData({ ...formData, lunchStartTime: e.target.value })} className="input" /></Field><Field label="Обед до"><input type="time" value={formData.lunchEndTime} onChange={e => setFormData({ ...formData, lunchEndTime: e.target.value })} className="input" /></Field></div>}
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label="Стоимость, ₽"><input type="number" min="0" step="100" value={formData.basePrice || ""} onChange={e => setFormData({ ...formData, basePrice: Number(e.target.value) || 0 })} className="input" /></Field>
                                    <Field label="Отмена минимум за, часов"><input type="number" min="0" value={formData.cancellationHours} onChange={e => setFormData({ ...formData, cancellationHours: Number(e.target.value) || 0 })} className="input" /></Field>
                                </div>
                            </StepCard>
                        )}

                        {current.key === "documents" && (
                            <StepCard title="Документы для клиентов" subtitle="Можно пропустить. Если заполнить — документ будет автоотправляться новым клиентам или при первой записи.">
                                <Field label="Название"><input value={docDraft.title} onChange={e => setDocDraft({ ...docDraft, title: e.target.value })} className="input" /></Field>
                                <Field label="Версия"><input value={docDraft.version} onChange={e => setDocDraft({ ...docDraft, version: e.target.value })} className="input" /></Field>
                                <Field label="Текст документа"><textarea value={docDraft.content} onChange={e => setDocDraft({ ...docDraft, content: e.target.value })} rows={8} className="input min-h-40" placeholder="Вставьте оферту, договор или информированное согласие" /></Field>
                                <label className="flex gap-3"><input type="checkbox" checked={docDraft.sendOnNewClient} onChange={e => setDocDraft({ ...docDraft, sendOnNewClient: e.target.checked })} />Отправлять новым клиентам</label>
                                <label className="flex gap-3"><input type="checkbox" checked={docDraft.sendOnFirstSession} onChange={e => setDocDraft({ ...docDraft, sendOnFirstSession: e.target.checked })} />Отправлять при первой записи</label>
                            </StepCard>
                        )}

                        {current.key === "messenger" && (
                            <StepCard title="Мессенджер для уведомлений" subtitle="Подключение можно сделать сейчас или позже. Клиентские приглашения идут по лестнице MAX → Telegram → web.">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <button onClick={() => router.push("/diary/settings/integrations")} className="choice">Подключить MAX / Telegram</button>
                                    <button onClick={nextStep} className="choice">Настрою позже</button>
                                </div>
                            </StepCard>
                        )}

                        {current.key === "firstClient" && (
                            <StepCard title="Первый клиент" subtitle="Можно добавить вручную списком или перейти к импорту из календаря.">
                                <textarea value={clientsText} onChange={e => setClientsText(e.target.value)} rows={7} className="input min-h-40 font-mono" placeholder={"Анна Иванова, +79161234567, anna@example.com\nМихаил Петров; +79031112233"} />
                                {parsedClients.length > 0 && <p className="text-sm opacity-80">Распознано: {validParsedClients.length} из {parsedClients.length}</p>}
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <button onClick={() => router.push("/diary/clients?import=calendar")} className="choice">Импорт из календаря</button>
                                    <button onClick={nextStep} className="choice">Продолжить вручную</button>
                                </div>
                            </StepCard>
                        )}

                        {current.key === "finish" && (
                            <StepCard title="Готово к старту" subtitle="Сохраним профиль, документы и первых клиентов. Ничего лишнего — всё можно изменить позже.">
                                {error && <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
                                <button onClick={completeOnboarding} disabled={isSubmitting} className="h-14 w-full rounded-2xl bg-[#c9a961] font-bold text-[#1a4d3a] disabled:opacity-50">
                                    {isSubmitting ? "Сохраняем…" : "Начать работу"}
                                </button>
                            </StepCard>
                        )}
                    </div>

                    <div className="mt-8 flex gap-3">
                        {stepIndex > 0 && current.key !== "finish" && <button onClick={prevStep} className="h-12 rounded-2xl bg-white/10 px-5 font-medium md:bg-[#faf8f5]">Назад</button>}
                        {current.key !== "finish" && current.key !== "messenger" && current.key !== "firstClient" && (
                            <button onClick={nextStep} disabled={current.key === "profile" && !hasProfile} className="h-12 flex-1 rounded-2xl bg-[#c9a961] font-semibold text-[#1a4d3a] disabled:opacity-50">Продолжить</button>
                        )}
                        {(current.key === "messenger" || current.key === "firstClient") && <button onClick={nextStep} className="h-12 flex-1 rounded-2xl bg-[#c9a961] font-semibold text-[#1a4d3a]">Далее</button>}
                    </div>
                </div>
            </section>
            <style jsx>{`
                .input { width: 100%; border-radius: 1rem; border: 1px solid rgba(255,255,255,.20); background: rgba(255,255,255,.10); padding: .75rem 1rem; color: inherit; outline: none; }
                .choice { min-height: 4.5rem; border-radius: 1.25rem; border: 1px solid rgba(201,169,97,.35); background: rgba(201,169,97,.12); padding: 1rem; text-align: left; font-weight: 600; }
                @media (min-width: 768px) { .input { border-color: #e6dfd1; background: #faf8f5; color: #16271d; } }
            `}</style>
        </main>
    )
}

function StepCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-2xl font-bold md:text-[#16271d]">{title}</h2>
                <p className="mt-2 text-sm text-white/70 md:text-[#6b746d]">{subtitle}</p>
            </div>
            <div className="space-y-4">{children}</div>
        </div>
    )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return <label className="block space-y-2"><span className="text-sm font-semibold text-white/80 md:text-[#4d5a52]">{label}</span>{children}</label>
}
