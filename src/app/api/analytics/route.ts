import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getGeoFromIP } from '@/lib/geoip';
import { parseUserAgent, extractReferrerDomain } from '@/lib/ua-parser';

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

        // Get enhanced GEO data from IP (includes district, ISP, lat/lon)
        const geo = await getGeoFromIP(ip);

        // Parse User-Agent for device/browser/OS details
        const ua = parseUserAgent(data.browser.userAgent);

        // Extract referrer domain
        const referrerDomain = extractReferrerDomain(data.session.referrer);

        // Prepare enhanced analytics record
        const analyticsRecord = {
            visitorId: data.visitorId,
            ip: ip,
            // Enhanced GEO data
            country: geo.country,
            countryCode: geo.countryCode,
            city: geo.city,
            region: geo.region,
            district: geo.district,
            postalCode: geo.postalCode,
            lat: geo.lat,
            lon: geo.lon,
            timezone: geo.timezone || data.browser.timezone,
            isp: geo.isp,
            org: geo.org,
            asn: geo.asn,
            // Device details (from ua-parser-js)
            userAgent: data.browser.userAgent,
            deviceType: ua.deviceType || data.device.deviceType,
            deviceVendor: ua.deviceVendor,
            deviceModel: ua.deviceModel,
            // Browser details
            browserName: ua.browserName,
            browserVersion: ua.browserVersion,
            browserMajor: ua.browserMajor,
            // Engine details
            engineName: ua.engineName,
            engineVersion: ua.engineVersion,
            // OS details
            osName: ua.osName,
            osVersion: ua.osVersion,
            // CPU architecture
            cpuArchitecture: ua.cpuArchitecture,
            // Screen & hardware
            language: data.browser.language,
            platform: data.browser.platform,
            screenWidth: data.browser.screenWidth,
            screenHeight: data.browser.screenHeight,
            devicePixelRatio: data.browser.devicePixelRatio,
            touchSupport: data.browser.touchSupport,
            deviceMemory: data.device.memory || null,
            hardwareConcurrency: data.device.hardwareConcurrency,
            connectionType: data.connection.effectiveType || null,
            connectionDownlink: data.connection.downlink || null,
            // Session data
            referrer: data.session.referrer || null,
            referrerDomain: referrerDomain,
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

        // Save to database with enhanced fields
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

