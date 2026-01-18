import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface VisitorData {
    visitorId: string;
    fingerprint: {
        components: Record<string, unknown>;
    };
    browser: {
        userAgent: string;
        language: string;
        languages: readonly string[];
        platform: string;
        cookiesEnabled: boolean;
        doNotTrack: string | null;
        screenWidth: number;
        screenHeight: number;
        screenColorDepth: number;
        devicePixelRatio: number;
        timezone: string;
        timezoneOffset: number;
        touchSupport: boolean;
        maxTouchPoints: number;
    };
    connection: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
        saveData?: boolean;
    };
    session: {
        referrer: string;
        currentUrl: string;
        pathname: string;
        searchParams: Record<string, string>;
        timestamp: string;
        sessionStart: string;
    };
    device: {
        memory?: number;
        hardwareConcurrency: number;
        deviceType: 'mobile' | 'tablet' | 'desktop';
    };
}

export async function POST(request: NextRequest) {
    try {
        const data: VisitorData = await request.json();

        // Get IP from headers (works with nginx/proxies)
        const forwardedFor = request.headers.get('x-forwarded-for');
        const realIp = request.headers.get('x-real-ip');
        const ip = forwardedFor?.split(',')[0] || realIp || 'unknown';

        // Prepare analytics record
        const analyticsRecord = {
            visitorId: data.visitorId,
            ip: ip,
            userAgent: data.browser.userAgent,
            language: data.browser.language,
            platform: data.browser.platform,
            screenWidth: data.browser.screenWidth,
            screenHeight: data.browser.screenHeight,
            devicePixelRatio: data.browser.devicePixelRatio,
            timezone: data.browser.timezone,
            touchSupport: data.browser.touchSupport,
            deviceType: data.device.deviceType,
            deviceMemory: data.device.memory || null,
            hardwareConcurrency: data.device.hardwareConcurrency,
            connectionType: data.connection.effectiveType || null,
            referrer: data.session.referrer || null,
            currentUrl: data.session.currentUrl,
            pathname: data.session.pathname,
            utmSource: data.session.searchParams['utm_source'] || null,
            utmMedium: data.session.searchParams['utm_medium'] || null,
            utmCampaign: data.session.searchParams['utm_campaign'] || null,
            utmContent: data.session.searchParams['utm_content'] || null,
            utmTerm: data.session.searchParams['utm_term'] || null,
            sessionStart: new Date(data.session.sessionStart),
            timestamp: new Date(data.session.timestamp),
            fingerprintComponents: JSON.stringify(data.fingerprint.components),
        };

        // Save to database
        await db.visitorAnalytics.upsert({
            where: { visitorId: data.visitorId },
            create: {
                ...analyticsRecord,
                visits: 1,
            },
            update: {
                ...analyticsRecord,
                visits: { increment: 1 },
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Analytics error:', error);
        // Don't expose error details, just return success to not break frontend
        return NextResponse.json({ success: true });
    }
}

// Optional: GET endpoint for admin dashboard
export async function GET(request: NextRequest) {
    try {
        // Basic auth check (you should implement proper auth)
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.ANALYTICS_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const analytics = await db.visitorAnalytics.findMany({
            orderBy: { timestamp: 'desc' },
            take: 100,
        });

        // Aggregate stats
        const stats = await db.visitorAnalytics.groupBy({
            by: ['deviceType'],
            _count: { visitorId: true },
        });

        return NextResponse.json({
            recentVisitors: analytics,
            deviceStats: stats,
        });
    } catch (error) {
        console.error('Analytics fetch error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
