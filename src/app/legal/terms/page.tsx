import { redirect } from "next/navigation"

export default function TermsOfUsePage() {
    redirect("/legal/terms-of-use.pdf")
}
