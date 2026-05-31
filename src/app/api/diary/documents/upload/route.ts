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

function jsonError(message: string, status = 500) {
    return NextResponse.json({ success: false, error: message }, { status });
}

function safeFileName(name: string) {
    const ext = path.extname(name).toLowerCase().slice(0, 12);
    const base = path.basename(name, ext).replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, '-').slice(0, 80) || 'document';
    return `${base}-${randomUUID()}${ext}`;
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return jsonError('Нужно войти в аккаунт', 401);

        const formData = await request.formData();
        const file = formData.get('file');

        if (!(file instanceof File)) return jsonError('Файл не найден', 400);
        if (file.size <= 0) return jsonError('Файл пустой', 400);
        if (file.size > MAX_FILE_SIZE) return jsonError('Файл слишком большой. Максимум 15 МБ', 400);
        if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) return jsonError('Поддерживаются PDF, DOC, DOCX, TXT, RTF, JPG и PNG', 400);

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
    } catch (error) {
        console.error('document upload failed:', error);
        return jsonError('Не удалось загрузить файл на сервер. Попробуйте файл меньше 15 МБ или другой формат.', 500);
    }
}
