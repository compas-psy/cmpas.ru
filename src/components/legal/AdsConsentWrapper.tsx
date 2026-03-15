import { getAdsConsentStatus } from "@/app/legal/actions"
import { AdsConsentModal } from "./AdsConsentModal"

/**
 * Server component wrapper that decides whether to render the AdsConsentModal.
 * Checks if the user already has an active acceptance record for ADS.
 * If not, it renders the modal, which will handle its own "only show once" logic.
 */
export async function AdsConsentWrapper({ userId }: { userId: string }) {
    const status = await getAdsConsentStatus(userId)
    
    // If they already accepted or fetching failed, don't show the modal
    if (!status.success || status.isAccepted) {
        return null
    }

    return <AdsConsentModal userId={userId} />
}
