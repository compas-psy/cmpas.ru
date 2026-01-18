// User-Agent parser utility using ua-parser-js
// Extracts device, browser, OS, engine, and CPU information

import { UAParser } from 'ua-parser-js';

export interface DeviceInfo {
    // Device
    deviceType: string | null;    // "mobile", "tablet", "desktop", "console", "smarttv", "wearable"
    deviceVendor: string | null;  // "Apple", "Samsung", "Huawei", etc.
    deviceModel: string | null;   // "iPhone", "Galaxy S23", etc.
    // Browser
    browserName: string | null;   // "Chrome", "Safari", "Firefox"
    browserVersion: string | null;// "120.0.0"
    browserMajor: string | null;  // "120"
    // Engine
    engineName: string | null;    // "Blink", "WebKit", "Gecko"
    engineVersion: string | null;
    // OS
    osName: string | null;        // "Android", "iOS", "Windows", "macOS"
    osVersion: string | null;
    // CPU
    cpuArchitecture: string | null; // "amd64", "arm", "arm64"
}

/**
 * Parse user agent string and extract detailed device/browser information
 */
export function parseUserAgent(userAgent: string | null | undefined): DeviceInfo {
    const nullResult: DeviceInfo = {
        deviceType: null,
        deviceVendor: null,
        deviceModel: null,
        browserName: null,
        browserVersion: null,
        browserMajor: null,
        engineName: null,
        engineVersion: null,
        osName: null,
        osVersion: null,
        cpuArchitecture: null,
    };

    if (!userAgent) {
        return nullResult;
    }

    try {
        const parser = new UAParser(userAgent);
        const result = parser.getResult();

        return {
            // Device info
            deviceType: result.device.type || inferDeviceType(result),
            deviceVendor: result.device.vendor || null,
            deviceModel: result.device.model || null,
            // Browser info
            browserName: result.browser.name || null,
            browserVersion: result.browser.version || null,
            browserMajor: result.browser.major || null,
            // Engine info
            engineName: result.engine.name || null,
            engineVersion: result.engine.version || null,
            // OS info
            osName: result.os.name || null,
            osVersion: result.os.version || null,
            // CPU info
            cpuArchitecture: result.cpu.architecture || null,
        };
    } catch (error) {
        console.error('UA parsing error:', error);
        return nullResult;
    }
}

/**
 * Infer device type from OS if not detected by parser
 */
function inferDeviceType(result: ReturnType<UAParser['getResult']>): string | null {
    const osName = result.os.name?.toLowerCase();

    if (!osName) return 'desktop';

    // Mobile OS
    if (['android', 'ios', 'windows phone', 'windows mobile', 'blackberry'].includes(osName)) {
        // Check if tablet based on resolution hints in user agent
        return 'mobile';
    }

    // Desktop OS
    if (['windows', 'mac os', 'macos', 'linux', 'ubuntu', 'chrome os', 'fedora'].includes(osName)) {
        return 'desktop';
    }

    // Console
    if (['playstation', 'xbox', 'nintendo'].some(c => osName.includes(c))) {
        return 'console';
    }

    return 'desktop';
}

/**
 * Get device display name for analytics
 * Returns: "Apple iPhone" or "Samsung Galaxy S23" or "Desktop"
 */
export function getDeviceDisplayName(info: DeviceInfo): string {
    if (info.deviceVendor && info.deviceModel) {
        return `${info.deviceVendor} ${info.deviceModel}`;
    }
    if (info.deviceVendor) {
        return info.deviceVendor;
    }
    if (info.deviceType) {
        return capitalizeFirst(info.deviceType);
    }
    return 'Unknown';
}

/**
 * Get browser display name
 * Returns: "Chrome 120" or "Safari 17"
 */
export function getBrowserDisplayName(info: DeviceInfo): string {
    if (info.browserName && info.browserMajor) {
        return `${info.browserName} ${info.browserMajor}`;
    }
    if (info.browserName) {
        return info.browserName;
    }
    return 'Unknown';
}

/**
 * Get OS display name
 * Returns: "Android 14" or "iOS 17.2"
 */
export function getOSDisplayName(info: DeviceInfo): string {
    if (info.osName && info.osVersion) {
        return `${info.osName} ${info.osVersion}`;
    }
    if (info.osName) {
        return info.osName;
    }
    return 'Unknown';
}

function capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Extract domain from referrer URL
 */
export function extractReferrerDomain(referrer: string | null | undefined): string | null {
    if (!referrer) return null;

    try {
        const url = new URL(referrer);
        return url.hostname;
    } catch {
        return null;
    }
}
