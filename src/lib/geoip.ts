// Enhanced GeoIP lookup using ip-api.com (free, no API key required)
// Returns detailed location data including district, ISP, coordinates

export interface GeoData {
    country: string | null;
    countryCode: string | null;
    city: string | null;
    region: string | null;
    district: string | null;  // Neighborhood/district within city
    postalCode: string | null;
    lat: number | null;
    lon: number | null;
    timezone: string | null;
    isp: string | null;       // Internet Service Provider
    org: string | null;       // Organization
    asn: string | null;       // Autonomous System Number
}

export async function getGeoFromIP(ip: string): Promise<GeoData> {
    const nullResult: GeoData = {
        country: null,
        countryCode: null,
        city: null,
        region: null,
        district: null,
        postalCode: null,
        lat: null,
        lon: null,
        timezone: null,
        isp: null,
        org: null,
        asn: null,
    };

    // Skip localhost and private IPs
    if (!ip || ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
        return nullResult;
    }

    try {
        // Using ip-api.com with extended fields - free tier allows 45 requests per minute
        // Fields: country, countryCode, region, regionName, city, district, zip, lat, lon, timezone, isp, org, as
        const fields = 'status,country,countryCode,regionName,city,district,zip,lat,lon,timezone,isp,org,as';
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=${fields}`, {
            next: { revalidate: 86400 }, // Cache for 24 hours
        });

        if (!response.ok) {
            return nullResult;
        }

        const data = await response.json();

        if (data.status === 'success') {
            return {
                country: data.country || null,
                countryCode: data.countryCode || null,
                city: data.city || null,
                region: data.regionName || null,
                district: data.district || null,  // District/neighborhood
                postalCode: data.zip || null,
                lat: data.lat || null,
                lon: data.lon || null,
                timezone: data.timezone || null,
                isp: data.isp || null,
                org: data.org || null,
                asn: data.as || null,
            };
        }

        return nullResult;
    } catch (error) {
        console.error('GeoIP lookup error:', error);
        return nullResult;
    }
}

/**
 * Format location string for display: "Country / City / District"
 */
export function formatLocation(geo: GeoData): string {
    const parts = [geo.country, geo.city, geo.district].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : 'Неизвестно';
}

/**
 * Get short location: "City, Country"
 */
export function getShortLocation(geo: GeoData): string {
    const parts = [geo.city, geo.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Неизвестно';
}
