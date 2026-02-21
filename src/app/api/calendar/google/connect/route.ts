import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getGoogleAuthUrl } from '@/lib/calendar/google';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authUrl = getGoogleAuthUrl(session.user.id);
    return NextResponse.redirect(authUrl);
}
