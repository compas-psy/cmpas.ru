import { db } from "@/lib/db"

interface AuditLogParams {
    userId?: string
    email?: string
    action: "LOGIN_SUCCESS" | "LOGIN_FAILED" | "LOGOUT" | "OTP_SENT" | "OTP_VERIFIED" | "SIGNUP"
    provider?: "yandex" | "email"
    ipAddress?: string
    userAgent?: string
    metadata?: Record<string, any>
}

export async function createAuditLog(params: AuditLogParams) {
    try {
        await db.auditLog.create({
            data: {
                userId: params.userId,
                email: params.email,
                action: params.action,
                provider: params.provider,
                ipAddress: params.ipAddress,
                userAgent: params.userAgent,
                metadata: params.metadata ? JSON.stringify(params.metadata) : null,
            }
        })
    } catch (error) {
        console.error("Failed to create audit log:", error)
    }
}

// Helper to extract IP and User-Agent from Request
export function getRequestMetadata(request?: Request) {
    if (!request) return {}

    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown"
    }
}
