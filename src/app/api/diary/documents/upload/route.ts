import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { auth } from '@/auth';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/rtf',
    'image/jpeg',
    'image/png',
]);

function safeFileName(name: string) {
    const ext = path.extname(name).toLowerCase().slice(0, 12);
    const base = path.basename(name, ext).replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, '-').slice(0, 80) || 'document';
    return `${base}-${randomUUID()}${ext}`;
}

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Файл не найден' }, { status: 400 });
    }

    if (file.size <= 0) {
        return NextResponse.json({ error: 'Файл пустой' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'Файл слишком большой. Максимум 15 МБ' }, { status: 400 });
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json({ error: 'Поддерживаются PDF, DOC, DOCX, TXT, RTF, JPG и PNG' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const userDir = path.join(process.cwd(), 'public', 'uploads', 'client-documents', session.user.id);
    await mkdir(userDir, { recursive: true });

    const storedName = safeFileName(file.name || 'document');
    const filePath = path.join(userDir, storedName);
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/client-documents/${session.user.id}/${storedName}`;

    return NextResponse.json({
        success: true,
        fileUrl,
        fileName: file.name,
        fileMimeType: file.type || 'application/octet-stream',
        fileSizeBytes: file.size,
    });
}
