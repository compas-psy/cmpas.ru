import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { db } from "@/lib/db"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const user = await db.user.findUnique({
            where: { email: session.user.email }
        })

        if (!user || user.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const formData = await req.formData()
        const file = formData.get("file") as File | null
        
        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 })
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Ensure directory exists
        const uploadDir = path.join(process.cwd(), "public", "legal-docs")
        try {
            await mkdir(uploadDir, { recursive: true })
        } catch (e) {
            // Ignore if exists
        }

        // Generate unique filename with original extension
        const ext = path.extname(file.name) || ".pdf"
        const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`
        const filepath = path.join(uploadDir, filename)

        await writeFile(filepath, buffer)

        const url = `/legal-docs/${filename}`

        return NextResponse.json({ success: true, url })
    } catch (error) {
        console.error("Upload error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
