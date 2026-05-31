import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

const CONTENT_TYPES: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain; charset=utf-8',
    '.rtf': 'application/rtf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
};

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
    try {
        const { path: rawParts } = await params;
        const parts = rawParts || [];
        if (!parts.length || parts.some(part => part.includes('..') || part.includes('/') || part.includes('\\'))) {
            return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
        }

        const root = path.join(process.cwd(), 'public', 'uploads', 'client-documents');
        const filePath = path.join(root, ...parts);
        const relative = path.relative(root, filePath);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
        }

        const info = await stat(filePath);
        if (!info.isFile()) return NextResponse.json({ error: 'File not found' }, { status: 404 });

        const buffer = await readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
        const filename = encodeURIComponent(path.basename(filePath));

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Length': String(buffer.length),
                'Content-Disposition': `inline; filename*=UTF-8''${filename}`,
                'Cache-Control': 'private, max-age=3600',
            },
        });
    } catch (error) {
        console.error('document file serve failed:', error);
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
}
