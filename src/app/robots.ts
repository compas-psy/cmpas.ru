import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = 'https://cmpas.ru';

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/auth/', '/auth', '/admin/', '/onboarding/'],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
