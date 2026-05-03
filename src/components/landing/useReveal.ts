'use client';

import { useEffect, useRef } from 'react';

/**
 * Intersection Observer hook for landing page scroll-driven animations.
 * Adds 'revealed' class when element enters viewport.
 */
export function useReveal(threshold = 0.15) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    el.classList.add('revealed');
                    observer.unobserve(el);
                }
            },
            { threshold, rootMargin: '0px 0px -60px 0px' }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [threshold]);

    return ref;
}

/**
 * Hook for Before/After sunset transition.
 * When section enters viewport, "before" exits and "after" enters.
 */
export function useBeforeAfterTransition() {
    const sectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const section = sectionRef.current;
        if (!section) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    const before = section.querySelector('.before-card-exit');
                    const after = section.querySelector('.after-card-enter');
                    
                    // Stagger: before exits first, then after enters
                    setTimeout(() => before?.classList.add('exited'), 100);
                    setTimeout(() => after?.classList.add('entered'), 400);
                    
                    observer.unobserve(section);
                }
            },
            { threshold: 0.3, rootMargin: '0px 0px -80px 0px' }
        );

        observer.observe(section);
        return () => observer.disconnect();
    }, []);

    return sectionRef;
}
