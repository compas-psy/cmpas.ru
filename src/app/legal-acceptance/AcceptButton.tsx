"use client"

import { useFormStatus } from "react-dom"
export function AcceptButton() {
    const { pending } = useFormStatus()
    
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full bg-[#1a4d3a] hover:bg-[#133729] text-white rounded-xl py-6 font-medium text-lg disabled:opacity-50 transition-colors"
        >
            {pending ? "Сохраняем..." : "Принимаю и продолжаю"}
        </button>
    )
}
