'use client';

import { useEffect, useRef } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { VISITOR_ID_COOKIE } from '@/lib/analytics/visitor-cookie';

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

function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
        return 'mobile';
    }
    return 'desktop';
}

function getSearchParams(): Record<string, string> {
    const params: Record<string, string> = {};
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.forEach((value, key) => {
        params[key] = value;
    });
    return params;
}

function getSessionStart(): string {
    const key = 'cmpas_session_start';
    let sessionStart = sessionStorage.getItem(key);
    if (!sessionStart) {
        sessionStart = new Date().toISOString();
        sessionStorage.setItem(key, sessionStart);
    }
    return sessionStart;
}

async function collectVisitorData(): Promise<VisitorData> {
    // Initialize FingerprintJS
    const fp = await FingerprintJS.load();
    const fpResult = await fp.get();

    // Get connection info
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;

    const visitorData: VisitorData = {
        visitorId: fpResult.visitorId,
        fingerprint: {
            components: fpResult.components as unknown as Record<string, unknown>,
        },
        browser: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            languages: navigator.languages,
            platform: navigator.platform,
            cookiesEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            screenColorDepth: window.screen.colorDepth,
            devicePixelRatio: window.devicePixelRatio,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: new Date().getTimezoneOffset(),
            touchSupport: 'ontouchstart' in window,
            maxTouchPoints: navigator.maxTouchPoints || 0,
        },
        connection: {
            effectiveType: connection?.effectiveType,
            downlink: connection?.downlink,
            rtt: connection?.rtt,
            saveData: connection?.saveData,
        },
        session: {
            referrer: document.referrer,
            currentUrl: window.location.href,
            pathname: window.location.pathname,
            searchParams: getSearchParams(),
            timestamp: new Date().toISOString(),
            sessionStart: getSessionStart(),
        },
        device: {
            memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
            hardwareConcurrency: navigator.hardwareConcurrency || 0,
            deviceType: getDeviceType(),
        },
    };

    return visitorData;
}

interface NetworkInformation {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
}

export function useAnalytics() {
    const hasSent = useRef(false);

    useEffect(() => {
        if (hasSent.current) return;

        const sendAnalytics = async () => {
            try {
                const visitorData = await collectVisitorData();

                // Кука (не localStorage — её сервер не видит): даёт
                // src/auth.ts прочитать visitorId при входе/регистрации и
                // связать эту запись VisitorAnalytics с аккаунтом (B5).
                // 400 дней — предел, который сам браузер даёт первостороннней
                // куке через document.cookie (Chrome режет более длинный
                // max-age до этого значения молча).
                document.cookie = `${VISITOR_ID_COOKIE}=${visitorData.visitorId}; path=/; max-age=${400 * 24 * 60 * 60}; SameSite=Lax`;

                // Store in localStorage for persistence
                const key = `cmpas_visitor_${visitorData.visitorId}`;
                const existingData = localStorage.getItem(key);
                const visits = existingData ? JSON.parse(existingData).visits + 1 : 1;

                localStorage.setItem(key, JSON.stringify({
                    ...visitorData,
                    visits,
                    lastVisit: new Date().toISOString(),
                }));

                // Send to analytics endpoint
                await fetch('/api/analytics', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(visitorData),
                });

                hasSent.current = true;
            } catch (error) {
                console.error('Analytics error:', error);
            }
        };

        // Delay to not block initial render
        const timeoutId = setTimeout(sendAnalytics, 1000);

        return () => clearTimeout(timeoutId);
    }, []);
}

// Export for manual usage
export { collectVisitorData };
export type { VisitorData };
