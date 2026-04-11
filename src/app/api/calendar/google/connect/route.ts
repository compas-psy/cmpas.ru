import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getGoogleAuthUrl } from '@/lib/calendar/google';

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Support returnUrl for onboarding flow — encode it into OAuth state
    const returnUrl = request.nextUrl.searchParams.get('returnUrl');
    const state = returnUrl
        ? `${session.user.id}|${returnUrl}`
        : session.user.id;

    const authUrl = getGoogleAuthUrl(state);
    return NextResponse.redirect(authUrl);
}
