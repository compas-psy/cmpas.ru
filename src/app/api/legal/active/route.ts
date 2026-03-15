import { NextResponse } from "next/server"
import { getActiveDocuments } from "@/app/legal/actions"
import { DocType } from "@/app/legal/types"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const typesParam = searchParams.get("types")
        
        // Parse types if provided (comma-separated: TERMS,PRIVACY,ADS)
        let types: DocType[] | undefined = undefined
        if (typesParam) {
            types = typesParam.split(",").map(t => t.trim().toUpperCase()) as DocType[]
        }

        const result = await getActiveDocuments(types)
        
        if (!result.success) {
            return NextResponse.json(
                { error: result.error || "Failed to fetch active documents" },
                { status: 500 }
            )
        }

        return NextResponse.json({ data: result.data })
    } catch (error) {
        console.error("API /legal/active error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
