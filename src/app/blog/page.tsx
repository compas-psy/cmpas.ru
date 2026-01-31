import type { Metadata } from 'next';
import Link from 'next/link';
import { blogArticles } from '@/lib/blog-data';
import Header from '@/components/psidairy/Header';
import Footer from '@/components/psidairy/Footer';

export const metadata: Metadata = {
    title: 'Блог для психологов: статьи о практике и инструментах',
    description: 'Полезные материалы для частных практикующих психологов: записи сессий, супервизия, профилактика выгорания, работа с клиентами.',
    keywords: ['блог психолога', 'статьи для психологов', 'практика психолога', 'инструменты психолога'],
    openGraph: {
        title: 'Блог для психологов | Compas',
        description: 'Полезные материалы для частных практикующих психологов',
        url: 'https://cmpas.ru/blog',
        siteName: 'Compas',
        locale: 'ru_RU',
        type: 'website',
    },
    alternates: {
        canonical: 'https://cmpas.ru/blog',
    },
};

export default function BlogPage() {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'Блог для психологов',
        description: 'Полезные материалы для частных практикующих психологов',
        url: 'https://cmpas.ru/blog',
        publisher: {
            '@type': 'Organization',
            name: 'Compas',
            url: 'https://cmpas.ru',
        },
    };

    return (
        <main className="min-h-screen bg-background font-sans">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <Header />

            <section className="pt-32 pb-16 md:pt-40 md:pb-24">
                <div className="container mx-auto px-4">
                    {/* Breadcrumbs */}
                    <nav className="mb-8 text-sm text-muted-foreground">
                        <Link href="/" className="hover:text-primary transition-colors">Главная</Link>
                        <span className="mx-2">/</span>
                        <span className="text-foreground">Блог</span>
                    </nav>

                    <h1 className="text-4xl md:text-5xl font-medium text-primary mb-6">
                        Блог для психологов
                    </h1>
                    <p className="text-xl text-foreground/80 max-w-2xl mb-12">
                        Статьи о ведении практики, работе с клиентами и профессиональной устойчивости.
                        Пишем как коллега для коллеги — без маркетингового пафоса.
                    </p>

                    {/* Articles Grid */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {blogArticles.map((article) => (
                            <article
                                key={article.slug}
                                className="bg-white border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                            >
                                <Link href={`/blog/${article.slug}`} className="block p-6">
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
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
                                    <h2 className="text-xl font-medium text-foreground mb-3 hover:text-primary transition-colors">
                                        {article.title}
                                    </h2>
                                    <p className="text-foreground/70 line-clamp-3">
                                        {article.description}
                                    </p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {article.keywords.slice(0, 2).map((keyword) => (
                                            <span
                                                key={keyword}
                                                className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground"
                                            >
                                                {keyword}
                                            </span>
                                        ))}
                                    </div>
                                </Link>
                            </article>
                        ))}
                    </div>

                    {/* CTA Section */}
                    <div className="mt-16 bg-primary/5 border border-primary/20 rounded-lg p-8 text-center">
                        <h2 className="text-2xl font-medium text-foreground mb-4">
                            Хотите систематизировать свою практику?
                        </h2>
                        <p className="text-foreground/70 mb-6 max-w-xl mx-auto">
                            Ежедневник психолога — это готовая система для ведения записей,
                            которую не нужно изобретать самостоятельно.
                        </p>
                        <Link
                            href="/#order-form"
                            className="inline-block bg-primary text-white px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition"
                        >
                            Посмотреть ежедневник
                        </Link>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
