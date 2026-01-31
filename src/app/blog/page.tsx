'use client';

import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, ArrowRight } from 'lucide-react';
import { blogPosts } from '@/lib/blog-data';
import Header from '@/components/psidairy/Header';
import Footer from '@/components/psidairy/Footer';

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
        <main className="min-h-screen bg-[#faf8f5] font-sans">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <Header />

            {/* Hero Section */}
            <section className="bg-[#1a4d3a] pt-32 pb-20 md:pt-40 md:pb-32">
                <div className="container mx-auto px-4 max-w-[1200px]">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-[#faf8f5] mb-6">
                        Блог для психологов
                    </h1>
                    <p className="text-lg md:text-xl text-[#faf8f5]/80 max-w-[700px]">
                        Статьи о ведении практики, работе с клиентами и профессиональной
                        устойчивости. Пишем как коллега для коллеги — без маркетингового пафоса.
                    </p>
                </div>
            </section>

            {/* Articles Grid */}
            <section className="py-16 md:py-24">
                <div className="container mx-auto px-4 max-w-[1200px]">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        {blogPosts.map((post) => (
                            <article
                                key={post.id}
                                className="group bg-white border border-[#1a4d3a]/10 rounded-lg p-6 md:p-8 shadow-sm hover:shadow-lg transition-all duration-300"
                            >
                                {/* Meta info */}
                                <div className="flex items-center gap-2 text-sm text-[#1a4d3a]/60 mb-4">
                                    <span>{post.date}</span>
                                    <span className="w-1 h-1 rounded-full bg-[#1a4d3a]/30" />
                                    <Clock className="w-4 h-4" />
                                    <span>{post.readTime}</span>
                                </div>

                                {/* Title */}
                                <h2 className="text-xl md:text-2xl font-medium text-[#1a4d3a] group-hover:text-[#c9a961] transition-colors duration-200 mb-3">
                                    <Link href={`/blog/${post.id}`}>
                                        {post.title}
                                    </Link>
                                </h2>

                                {/* Excerpt */}
                                <p className="text-[#1a4d3a]/70 line-clamp-3 mb-6">
                                    {post.excerpt}
                                </p>

                                {/* Tags */}
                                <div className="flex flex-wrap gap-2 mb-6">
                                    {post.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="text-xs px-3 py-1 rounded-full bg-[#1a4d3a]/5 text-[#1a4d3a] border border-[#1a4d3a]/20 hover:bg-[#1a4d3a]/10 transition-colors"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                {/* Read more link */}
                                <Link
                                    href={`/blog/${post.id}`}
                                    className="inline-flex items-center gap-2 text-[#c9a961] font-medium group-hover:gap-3 transition-all duration-200"
                                >
                                    Читать статью
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="bg-[#1a4d3a] py-16 md:py-20">
                <div className="container mx-auto px-4 max-w-[1200px] text-center">
                    <h2 className="text-3xl md:text-4xl font-medium text-[#faf8f5] mb-4">
                        Хотите упорядочить свою практику?
                    </h2>
                    <p className="text-[#faf8f5]/80 mb-8 max-w-xl mx-auto">
                        Ежедневник психолога поможет структурировать работу с
                        клиентами, отслеживать динамику и заботиться о себе.
                    </p>
                    <Link
                        href="/"
                        className="inline-block bg-[#c9a961] text-[#1a4d3a] px-8 py-3 rounded-lg font-medium hover:bg-[#d4b56d] transition-colors"
                    >
                        Узнать больше
                    </Link>
                </div>
            </section>

            <Footer />
        </main>
    );
}
