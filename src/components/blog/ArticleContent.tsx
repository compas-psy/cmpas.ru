'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, ChevronRight, ArrowLeft, BookOpen, Share2 } from 'lucide-react';
import type { BlogPost } from '@/lib/blog-data';

interface ArticleContentProps {
    post: BlogPost;
    relatedPosts: BlogPost[];
}

export default function ArticleContent({ post, relatedPosts }: ArticleContentProps) {
    const [readProgress, setReadProgress] = useState(0);
    const [activeSection, setActiveSection] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            // Calculate reading progress
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight - windowHeight;
            const scrolled = window.scrollY;
            const progress = (scrolled / documentHeight) * 100;
            setReadProgress(Math.min(progress, 100));

            // Determine active section
            const sections = document.querySelectorAll('[data-section]');
            sections.forEach((section, index) => {
                const rect = section.getBoundingClientRect();
                if (rect.top < windowHeight / 2 && rect.bottom > windowHeight / 2) {
                    setActiveSection(index);
                }
            });
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToSection = (index: number) => {
        const section = document.querySelector(`[data-section="${index}"]`);
        if (section) {
            const headerOffset = 100;
            const elementPosition = section.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: post.title,
                text: post.excerpt,
                url: window.location.href,
            }).catch(() => {
                navigator.clipboard.writeText(window.location.href);
            });
        } else {
            navigator.clipboard.writeText(window.location.href);
        }
    };

    return (
        <>
            {/* Reading Progress Bar */}
            <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-[#1a4d3a]/10">
                <div
                    className="h-full bg-[#c9a961] transition-all duration-150"
                    style={{ width: `${readProgress}%` }}
                />
            </div>

            {/* Hero Section */}
            <section className="bg-gradient-to-br from-[#1a4d3a] to-[#1a4d3a]/90 pt-24 pb-16 md:pt-32 md:pb-20">
                <div className="container mx-auto px-4 max-w-[1200px]">
                    {/* Breadcrumbs */}
                    <nav className="flex items-center gap-2 text-sm text-[#faf8f5]/60 mb-8">
                        <Link href="/" className="hover:text-[#faf8f5] transition-colors">
                            Главная
                        </Link>
                        <ChevronRight className="w-4 h-4" />
                        <Link href="/blog" className="hover:text-[#faf8f5] transition-colors">
                            Блог
                        </Link>
                        <ChevronRight className="w-4 h-4" />
                        <span className="text-[#faf8f5]/80 line-clamp-1">{post.title}</span>
                    </nav>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        {post.tags.map((tag) => (
                            <span
                                key={tag}
                                className="text-xs px-3 py-1 rounded-full bg-[#c9a961]/20 text-[#faf8f5] border border-[#faf8f5]/20"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-medium text-[#faf8f5] mb-6 max-w-[900px]">
                        {post.title}
                    </h1>

                    {/* Meta info */}
                    <div className="flex items-center gap-3 text-sm text-[#faf8f5]/80">
                        <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{post.readTime}</span>
                        </div>
                        <span className="w-1 h-1 rounded-full bg-[#faf8f5]/50" />
                        <span>{post.date}</span>
                    </div>
                </div>
            </section>

            {/* Main Content */}
            <section className="py-12 md:py-16">
                <div className="container mx-auto px-4 max-w-[1200px]">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

                        {/* Sidebar - Table of Contents */}
                        <aside className="lg:col-span-3 order-2 lg:order-1">
                            <div className="lg:sticky lg:top-24 bg-white rounded-lg p-6 shadow-sm border border-[#1a4d3a]/10">
                                <div className="flex items-center gap-2 text-[#1a4d3a] font-semibold mb-4">
                                    <BookOpen className="w-5 h-5" />
                                    <span>Содержание</span>
                                </div>
                                <nav className="space-y-1">
                                    {post.content.sections.map((section, index) => (
                                        <button
                                            key={index}
                                            onClick={() => scrollToSection(index)}
                                            className={`w-full text-left text-sm py-2 px-3 rounded transition-colors ${activeSection === index
                                                    ? 'bg-[#c9a961]/10 text-[#1a4d3a] font-medium'
                                                    : 'text-[#1a4d3a]/60 hover:text-[#1a4d3a] hover:bg-[#1a4d3a]/5'
                                                }`}
                                        >
                                            {section.heading}
                                        </button>
                                    ))}
                                </nav>
                                <div className="mt-6 pt-6 border-t border-[#1a4d3a]/10">
                                    <button
                                        onClick={handleShare}
                                        className="flex items-center gap-2 w-full text-sm text-[#1a4d3a]/60 hover:text-[#1a4d3a] transition-colors py-2 px-3 rounded hover:bg-[#1a4d3a]/5"
                                    >
                                        <Share2 className="w-4 h-4" />
                                        Поделиться
                                    </button>
                                </div>
                            </div>
                        </aside>

                        {/* Article Content */}
                        <article className="lg:col-span-9 order-1 lg:order-2">
                            <div className="bg-white rounded-lg p-6 md:p-10 lg:p-12 shadow-sm border border-[#1a4d3a]/10">
                                {/* Back link */}
                                <Link
                                    href="/blog"
                                    className="inline-flex items-center gap-2 text-[#1a4d3a]/60 hover:text-[#1a4d3a] transition-colors mb-8"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Все статьи
                                </Link>

                                {/* Intro */}
                                <p className="text-xl md:text-2xl text-[#1a4d3a]/90 leading-relaxed mb-12 pb-12 border-b border-[#1a4d3a]/10">
                                    {post.content.intro}
                                </p>

                                {/* Sections */}
                                <div className="space-y-12">
                                    {post.content.sections.map((section, index) => (
                                        <div
                                            key={index}
                                            data-section={index}
                                            className="scroll-mt-24"
                                        >
                                            {/* Section heading with number */}
                                            <div className="flex items-start gap-4 mb-6">
                                                <div className="w-10 h-10 rounded-full bg-[#c9a961]/10 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-[#c9a961] font-semibold">
                                                        {index + 1}
                                                    </span>
                                                </div>
                                                <h2 className="text-2xl md:text-3xl font-medium text-[#1a4d3a] pt-1">
                                                    {section.heading}
                                                </h2>
                                            </div>

                                            {/* Section content */}
                                            <div className="pl-14">
                                                {Array.isArray(section.content) ? (
                                                    <ul className="space-y-4">
                                                        {section.content.map((item, itemIndex) => (
                                                            <li
                                                                key={itemIndex}
                                                                className="flex items-start gap-4"
                                                            >
                                                                <span className="w-2 h-2 rounded-full bg-[#c9a961] mt-3 flex-shrink-0" />
                                                                <span className="text-lg text-[#1a4d3a]/70 leading-relaxed">
                                                                    {item}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="text-lg text-[#1a4d3a]/70 leading-relaxed whitespace-pre-line">
                                                        {section.content}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* CTA Block inside article */}
                                <div className="mt-16 p-8 bg-gradient-to-br from-[#1a4d3a]/5 to-[#c9a961]/5 rounded-lg border border-[#1a4d3a]/10">
                                    <h3 className="text-2xl font-medium text-[#1a4d3a] mb-4">
                                        Хотите структурировать свою практику?
                                    </h3>
                                    <p className="text-[#1a4d3a]/70 mb-6">
                                        Ежедневник психолога поможет организовать работу с клиентами, фиксировать
                                        наблюдения и заботиться о своём профессиональном здоровье.
                                    </p>
                                    <Link
                                        href="/"
                                        className="inline-block bg-[#c9a961] text-[#1a4d3a] px-6 py-3 rounded-lg font-medium hover:bg-[#d4b56d] transition-colors"
                                    >
                                        Узнать больше о ежедневнике
                                    </Link>
                                </div>
                            </div>
                        </article>
                    </div>
                </div>
            </section>

            {/* Related Articles */}
            {relatedPosts.length > 0 && (
                <section className="bg-white border-t border-[#1a4d3a]/10 py-16 md:py-20">
                    <div className="container mx-auto px-4 max-w-[1200px]">
                        <h2 className="text-3xl md:text-4xl font-medium text-[#1a4d3a] mb-10">
                            Читайте также
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                            {relatedPosts.map((related) => (
                                <Link
                                    key={related.id}
                                    href={`/blog/${related.id}`}
                                    className="group bg-[#faf8f5] rounded-lg p-6 border border-[#1a4d3a]/10 hover:shadow-lg transition-all duration-300"
                                >
                                    <div className="flex items-center gap-1 text-sm text-[#1a4d3a]/60 mb-3">
                                        <Clock className="w-4 h-4" />
                                        <span>{related.readTime}</span>
                                    </div>
                                    <h3 className="text-xl font-medium text-[#1a4d3a] group-hover:text-[#c9a961] transition-colors mb-3">
                                        {related.title}
                                    </h3>
                                    <p className="text-sm text-[#1a4d3a]/70 line-clamp-2 mb-4">
                                        {related.excerpt}
                                    </p>
                                    <span className="inline-flex items-center gap-1 text-[#c9a961] text-sm font-medium">
                                        Читать далее
                                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Final CTA */}
            <section className="bg-[#1a4d3a] py-12 md:py-16">
                <div className="container mx-auto px-4 max-w-[1200px] text-center">
                    <Link
                        href="/blog"
                        className="inline-flex items-center gap-2 text-[#faf8f5] hover:text-[#c9a961] transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Вернуться ко всем статьям блога
                    </Link>
                </div>
            </section>
        </>
    );
}
