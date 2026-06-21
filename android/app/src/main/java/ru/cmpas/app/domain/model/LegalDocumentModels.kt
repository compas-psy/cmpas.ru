package ru.cmpas.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class MobileLegalDoc(
    val id: String,
    val type: String,
    val version: String,
    val url: String,
    val publishedAt: String? = null,
    val accepted: Boolean = false,
)

@Serializable
data class MobileLegalStatus(
    val serverTime: String? = null,
    val requiredDocumentIds: List<String> = emptyList(),
    val requiresTermsAcceptance: Boolean = false,
    val terms: MobileLegalDoc? = null,
    val privacy: MobileLegalDoc? = null,
    val ads: MobileLegalDoc? = null,
    val adsAccepted: Boolean = false,
)

@Serializable
data class MobileLegalAcceptBody(
    val acceptTerms: Boolean = false,
    val acceptAds: Boolean? = null,
    val documentIds: List<String> = emptyList(),
)
