export const DOC_TYPES = {
    TERMS: "TERMS",
    PRIVACY: "PRIVACY",
    ADS: "ADS"
} as const

export type DocType = keyof typeof DOC_TYPES
