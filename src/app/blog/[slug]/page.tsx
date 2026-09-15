import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { blogPosts, getPostById, getAllPostIds, getRelatedPosts } from '@/lib/blog-data';
import Header from '@/components/psidairy/Header';
import Footer from '@/components/psidairy/Footer';
import ArticleContent from '@/components/blog/ArticleContent';

interface Props {
    params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
    return getAllPostIds().map((id) => ({ slug: id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const post = getPostById(slug);

    if (!post) {
        return { title: 'Статья не найдена' };
    }

    return {
        title: post.title,
        description: post.excerpt,
        keywords: post.tags,
        openGraph: {
            title: post.title,
            description: post.excerpt,
            url: `https://cmpas.ru/blog/${slug}`,
            siteName: 'ПРАКТИКА',
            type: 'article',
            locale: 'ru_RU',
        },
        twitter: {
            card: 'summary_large_image',
            title: post.title,
            description: post.excerpt,
        },
        alternates: {
            canonical: `https://cmpas.ru/blog/${slug}`,
        },
    };
}

export default async function ArticlePage({ params }: Props) {
    const { slug } = await params;
    const post = getPostById(slug);

    if (!post) {
        notFound();
    }

    const relatedPosts = getRelatedPosts(slug, 3);

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.excerpt,
        // Машинная дата: строку «1 февраля 2026 г.» поисковик не разбирает,
        // и статья оставалась без даты (Ф7).
        datePublished: post.isoDate,
        // Имя продукта нынешнее: «Compas» осталось здесь от прежнего
        // названия и показывалось в карточках поиска и пересылках (Ф7).
        author: {
            '@type': 'Organization',
            name: 'ПРАКТИКА',
            url: 'https://cmpas.ru',
        },
        publisher: {
            '@type': 'Organization',
            name: 'ПРАКТИКА',
            url: 'https://cmpas.ru',
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `https://cmpas.ru/blog/${slug}`,
        },
    };

    return (
        <main className="min-h-screen bg-[#faf8f5] font-sans">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <Header />
            <ArticleContent post={post} relatedPosts={relatedPosts} />
            <Footer />
        </main>
    );
}
