import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { blogArticles, getArticleBySlug, getAllArticleSlugs } from '@/lib/blog-data';
import Header from '@/components/psidairy/Header';
import Footer from '@/components/psidairy/Footer';

interface Props {
    params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
    return getAllArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const article = getArticleBySlug(slug);

    if (!article) {
        return { title: 'Статья не найдена' };
    }

    return {
        title: article.title,
        description: article.description,
        keywords: article.keywords,
        openGraph: {
            title: article.title,
            description: article.description,
            url: `https://cmpas.ru/blog/${slug}`,
            siteName: 'Compas',
            type: 'article',
            publishedTime: article.publishDate,
            locale: 'ru_RU',
        },
        twitter: {
            card: 'summary_large_image',
            title: article.title,
            description: article.description,
        },
        alternates: {
            canonical: `https://cmpas.ru/blog/${slug}`,
        },
    };
}

export default async function ArticlePage({ params }: Props) {
    const { slug } = await params;
    const article = getArticleBySlug(slug);

    if (!article) {
        notFound();
    }

    // Get related articles (exclude current)
    const relatedArticles = blogArticles
        .filter((a) => a.slug !== slug)
        .slice(0, 2);

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.description,
        datePublished: article.publishDate,
        author: {
            '@type': 'Organization',
            name: 'Compas',
            url: 'https://cmpas.ru',
        },
        publisher: {
            '@type': 'Organization',
            name: 'Compas',
            url: 'https://cmpas.ru',
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `https://cmpas.ru/blog/${slug}`,
        },
    };

    return (
        <main className="min-h-screen bg-background font-sans">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <Header />

            <article className="pt-32 pb-16 md:pt-40 md:pb-24">
                <div className="container mx-auto px-4">
                    {/* Breadcrumbs */}
                    <nav className="mb-8 text-sm text-muted-foreground">
                        <Link href="/" className="hover:text-primary transition-colors">Главная</Link>
                        <span className="mx-2">/</span>
                        <Link href="/blog" className="hover:text-primary transition-colors">Блог</Link>
                        <span className="mx-2">/</span>
                        <span className="text-foreground">{article.title}</span>
                    </nav>

                    {/* Article Header */}
                    <header className="max-w-3xl mb-12">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                            <time dateTime={article.publishDate}>
                                {new Date(article.publishDate).toLocaleDateString('ru-RU', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                })}
                            </time>
                            <span>·</span>
                            <span>{article.readTime}</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-medium text-primary leading-tight">
                            {article.title}
                        </h1>
                    </header>

                    {/* Article Content */}
                    <div className="max-w-3xl prose prose-lg prose-headings:text-foreground prose-headings:font-medium prose-p:text-foreground/80 prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-foreground prose-ul:text-foreground/80 prose-li:marker:text-primary">
                        <div
                            dangerouslySetInnerHTML={{
                                __html: article.content
                                    .replace(/^# .+\n/m, '') // Remove H1 (already shown above)
                                    .replace(/## /g, '<h2 class="text-2xl mt-10 mb-4">')
                                    .replace(/### /g, '<h3 class="text-xl mt-8 mb-3">')
                                    .replace(/\n\n/g, '</p><p class="mb-4">')
                                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                    .replace(/\*(.+?)\*/g, '<em>$1</em>')
                                    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
                                    .replace(/❌/g, '<span class="text-red-500">❌</span>')
                                    .replace(/---/g, '<hr class="my-8 border-border">')
                                    .replace(/^- (.+)$/gm, '<li>$1</li>')
                            }}
                        />
                    </div>

                    {/* Author Box */}
                    <div className="max-w-3xl mt-12 p-6 bg-muted/30 border border-border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">Автор</p>
                        <p className="font-medium text-foreground">Команда Compas</p>
                        <p className="text-foreground/70 text-sm mt-1">
                            Практикующие психологи, которые создают инструменты для коллег.
                        </p>
                    </div>

                    {/* Related Articles */}
                    {relatedArticles.length > 0 && (
                        <section className="max-w-3xl mt-16">
                            <h2 className="text-2xl font-medium text-foreground mb-8">
                                Читайте также
                            </h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                {relatedArticles.map((related) => (
                                    <Link
                                        key={related.slug}
                                        href={`/blog/${related.slug}`}
                                        className="block p-6 bg-white border border-border rounded-lg hover:shadow-md transition-shadow"
                                    >
                                        <h3 className="font-medium text-foreground hover:text-primary transition-colors">
                                            {related.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                            {related.description}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* CTA */}
                    <div className="max-w-3xl mt-16 bg-primary/5 border border-primary/20 rounded-lg p-8 text-center">
                        <h2 className="text-2xl font-medium text-foreground mb-4">
                            Готовы систематизировать свою практику?
                        </h2>
                        <p className="text-foreground/70 mb-6">
                            Ежедневник психолога — это все инструменты из наших статей в одном месте.
                        </p>
                        <Link
                            href="/#order-form"
                            className="inline-block bg-primary text-white px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition"
                        >
                            Посмотреть ежедневник
                        </Link>
                    </div>
                </div>
            </article>

            <Footer />
        </main>
    );
}
