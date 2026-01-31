import { MetadataRoute } from 'next';

// Blog articles data - will be moved to a separate file later
const blogArticles = [
    { slug: 'zachem-psihologu-ezhednevnik', lastModified: new Date('2026-02-01') },
    { slug: 'kak-vesti-zapisi-posle-sessii', lastModified: new Date('2026-02-08') },
    { slug: 'anketa-pervichnogo-priema', lastModified: new Date('2026-02-15') },
    { slug: 'superviziya-v-chastnoj-praktike', lastModified: new Date('2026-02-22') },
    { slug: 'profilaktika-vygoraniya-psihologa', lastModified: new Date('2026-03-01') },
];

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://cmpas.ru';

    // Main pages
    const mainPages: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1.0,
        },
        {
            url: `${baseUrl}/blog`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
        },
    ];

    // Blog articles
    const blogPages: MetadataRoute.Sitemap = blogArticles.map((article) => ({
        url: `${baseUrl}/blog/${article.slug}`,
        lastModified: article.lastModified,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
    }));

    return [...mainPages, ...blogPages];
}
