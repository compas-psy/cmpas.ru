// GeoIP lookup using ip-api.com (free, no API key required)
// Returns country, city, region based on IP address

export interface GeoData {
    country: string | null;
    countryCode: string | null;
    city: string | null;
    region: string | null;
    timezone: string | null;
}

export async function getGeoFromIP(ip: string): Promise<GeoData> {
    // Skip localhost and private IPs
    if (!ip || ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
        return {
            country: null,
            countryCode: null,
            city: null,
            region: null,
            timezone: null,
        };
    }

    try {
        // Using ip-api.com - free tier allows 45 requests per minute
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,timezone`, {
            next: { revalidate: 86400 }, // Cache for 24 hours
        });

        if (!response.ok) {
            return { country: null, countryCode: null, city: null, region: null, timezone: null };
        }

        const data = await response.json();

        if (data.status === 'success') {
            return {
                country: data.country || null,
                countryCode: data.countryCode || null,
                city: data.city || null,
                region: data.regionName || null,
                timezone: data.timezone || null,
            };
        }

        return { country: null, countryCode: null, city: null, region: null, timezone: null };
    } catch (error) {
        console.error('GeoIP lookup error:', error);
        return { country: null, countryCode: null, city: null, region: null, timezone: null };
    }
}
