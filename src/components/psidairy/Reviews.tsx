'use client';

import { useState } from 'react';

interface Review {
    name: string;
    date: string;
    text: string;
    rating: number;
    emoji?: string;
}

const reviews: Review[] = [
    {
        name: 'Арина',
        date: '27 декабря 2025',
        text: 'Замечательный ежедневник! Очень приятная на ощупь обложка, плотные странички, хорошая печать, я очень довольна, заполнять его одно удовольствие. Большое спасибо за такой крутой продукт',
        rating: 5,
        emoji: '♥️',
    },
    {
        name: 'Владислав',
        date: '27 декабря 2025',
        text: 'Нереально тактильная вещь, что мне важно! Качественная бумага, продуманная структура, отложите мне еще. А как круто он выглядит в жизни!',
        rating: 5,
        emoji: '♥️',
    },
    {
        name: 'Олеся',
        date: '29 декабря 2025',
        text: 'Он мой! Очень приятный на ощупь. Как раз начну в 2026 году! Попозже поделюсь насколько удобно работать! Сейчас удовольствие для моих рук и очей',
        rating: 5,
        emoji: '😍',
    },
    {
        name: 'Лена',
        date: '4 января 2026',
        text: 'Подарила себе на Новый год. Благодарю создателей за такой прекрасный ежедневник. Люблю мягкие обложки и формат. Очень счастлива',
        rating: 5,
        emoji: '😊',
    },
    {
        name: 'Вероника',
        date: '11 января 2026',
        text: 'Заказала ежедневник для себя перед Новым годом, он оказался настолько красивым и удобным, что заказала второй в подарок коллеге! Такими вещами хочется делиться!',
        rating: 5,
        emoji: '🥹',
    },
    {
        name: 'Татьяна',
        date: '15 января 2026',
        text: 'Ежедневник приятный на ощупь, интересные вопросы, некоторые я не задавала ранее, удобно в поездке, все в одном месте. Рекомендую для работы!',
        rating: 5,
    },
    {
        name: 'Гарник',
        date: '17 января 2026',
        text: 'Заказал себе в подарок на НГ. Приятная на ощупь, сделана с душой. Цвета, дизайн, все очень гармонично! Спасибо!',
        rating: 5,
        emoji: ')',
    },
];

function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex gap-0.5" aria-label={`Оценка ${rating} из 5`}>
            {[1, 2, 3, 4, 5].map((star) => (
                <svg
                    key={star}
                    className={`w-4 h-4 ${star <= rating ? 'text-amber-400' : 'text-gray-300'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            ))}
        </div>
    );
}

function ReviewCard({ review }: { review: Review }) {
    return (
        <article
            className="bg-white rounded-2xl p-6 shadow-sm border border-border/50 hover:shadow-md transition-shadow"
            itemScope
            itemType="https://schema.org/Review"
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                        {review.name.charAt(0)}
                    </div>
                    <div>
                        <p className="font-medium text-foreground" itemProp="author">{review.name}</p>
                        <p className="text-xs text-foreground/50" itemProp="datePublished">{review.date}</p>
                    </div>
                </div>
                <div itemProp="reviewRating" itemScope itemType="https://schema.org/Rating">
                    <meta itemProp="ratingValue" content={String(review.rating)} />
                    <meta itemProp="bestRating" content="5" />
                    <StarRating rating={review.rating} />
                </div>
            </div>
            <p className="text-foreground/80 text-sm leading-relaxed" itemProp="reviewBody">
                {review.text} {review.emoji && <span>{review.emoji}</span>}
            </p>
        </article>
    );
}

export default function Reviews() {
    const [showAll, setShowAll] = useState(false);

    const visibleReviews = showAll ? reviews : reviews.slice(0, 4);
    const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    // Schema.org AggregateRating JSON-LD
    const reviewsSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Ежедневник Психолога',
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: averageRating.toFixed(1),
            reviewCount: reviews.length,
            bestRating: '5',
            worstRating: '1',
        },
        review: reviews.map((r) => ({
            '@type': 'Review',
            author: {
                '@type': 'Person',
                name: r.name,
            },
            datePublished: r.date,
            reviewBody: r.text,
            reviewRating: {
                '@type': 'Rating',
                ratingValue: r.rating,
                bestRating: 5,
            },
        })),
    };

    return (
        <section id="reviews" className="py-20 bg-background">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewsSchema) }}
            />

            <div className="container mx-auto px-4 max-w-6xl">
                {/* Header */}
                <div className="text-center mb-16 space-y-4">
                    <h2 className="text-3xl md:text-4xl font-medium text-primary">
                        Отзывы наших клиентов
                    </h2>
                    <div className="flex items-center justify-center gap-3">
                        <StarRating rating={5} />
                        <span className="text-foreground/70 text-sm">
                            {averageRating.toFixed(1)} из 5 · {reviews.length} отзывов
                        </span>
                    </div>
                    <p className="text-foreground/80 text-base md:text-lg">
                        Реальные впечатления от практикующих психологов, коучей и терапевтов
                    </p>
                </div>

                {/* Reviews Grid */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {visibleReviews.map((review, index) => (
                        <ReviewCard key={index} review={review} />
                    ))}
                </div>

                {/* Show More Button */}
                {!showAll && reviews.length > 4 && (
                    <div className="text-center">
                        <button
                            onClick={() => setShowAll(true)}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                        >
                            Показать все отзывы ({reviews.length})
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* CTA */}
                <div className="mt-12 text-center">
                    <p className="text-foreground/60 text-sm mb-4">
                        Присоединяйтесь к сообществу специалистов, которые уже используют Компас
                    </p>
                    <a
                        href="#order"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors font-medium"
                    >
                        Заказать ежедневник
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </a>
                </div>
            </div>
        </section>
    );
}
