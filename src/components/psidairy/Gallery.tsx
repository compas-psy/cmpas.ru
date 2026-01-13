"use client";

import Image from 'next/image';
import { useState, useEffect } from 'react';

export default function Gallery() {
    const [selectedImage, setSelectedImage] = useState<{ src: string, alt: string } | null>(null);

    // Lock scroll when modal is open
    useEffect(() => {
        if (selectedImage) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
    }, [selectedImage]);

    const images = [
        {
            src: '/images/main_screen_photo_v2.jpg',
            alt: 'Обложка ежедневника',
            caption: 'Обложка: "Здесь можно быть собой" (тиснение)'
        },
        {
            src: '/images/private_info_v2.jpg',
            alt: 'Личные данные психолога',
            caption: 'Личные данные психолога'
        },
        {
            src: '/images/client_info_v2.jpg',
            alt: 'Анкета клиента правая страница',
            caption: 'Анкета клиента: общие данные, психическое здоровье, цели и ожидания, примечания психолога'
        },
        {
            src: '/images/client_record_v2.jpg',
            alt: 'Записи сессий',
            caption: 'Записи сессий: ФИО / дата / № сессии'
        },
        {
            src: '/images/supervision_v2.jpg',
            alt: 'Раздел супервизии',
            caption: 'Супервизия: случаи'
        }
    ];

    return (
        <section id="развороты" className="py-20 md:py-24 bg-background">
            <div className="container mx-auto px-4 max-w-6xl">
                <div className="text-center mb-16 space-y-4">
                    <h2 className="text-3xl md:text-4xl font-medium text-primary">
                        Развороты и детали
                    </h2>
                    <p className="text-foreground/80 text-base md:text-lg">
                        На фото — реальные развороты: анкета клиента, записи сессий и супервизия.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
                    {images.slice(0, 3).map((img, idx) => (
                        <div key={idx} className="space-y-4 group cursor-pointer" onClick={() => setSelectedImage(img)}>
                            <div className="relative aspect-[4/5] rounded-lg overflow-hidden shadow-md bg-gray-100 transition-all duration-300 group-hover:shadow-xl group-hover:brightness-105">
                                <Image
                                    src={img.src}
                                    alt={img.alt}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <p className="text-sm text-center text-foreground/80 font-medium">
                                {img.caption}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Second Row: 2 images centered */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mt-8 md:mt-12 max-w-4xl mx-auto">
                    {images.slice(3, 5).map((img, idx) => (
                        <div key={idx + 3} className="space-y-4 group cursor-pointer" onClick={() => setSelectedImage(img)}>
                            <div className="relative aspect-[4/5] rounded-lg overflow-hidden shadow-md bg-gray-100 transition-all duration-300 group-hover:shadow-xl group-hover:brightness-105">
                                <Image
                                    src={img.src}
                                    alt={img.alt}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <p className="text-sm text-center text-foreground/80 font-medium">
                                {img.caption}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Lightbox Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300"
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="relative w-full max-w-5xl max-h-[90vh] h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors z-50 p-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div className="relative w-full h-full"> {/* Container for image to maintain aspect ratio logic if needed, or just standard Image fill */}
                            <Image
                                src={selectedImage.src}
                                alt={selectedImage.alt}
                                fill
                                className="object-contain"
                                sizes="100vw"
                                priority
                            />
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
