'use client';

import React from 'react';
import { Container } from '@/components/ui/Container';
import { useLanguage } from '@/lib/LanguageContext';

const logos = [
    { name: 'Miluna', logo: 'https://placehold.co/150x40/png?text=Miluna' },
    { name: 'Anamarket', logo: 'https://placehold.co/150x40/png?text=Anamarket' },
    { name: 'Umari Production', logo: 'https://placehold.co/150x40/png?text=Umari+Production' },
    { name: 'Popoq', logo: 'https://placehold.co/150x40/png?text=Popoq' },
    { name: 'Maroq', logo: 'https://placehold.co/150x40/png?text=Maroq' },
    { name: 'Zumradshop', logo: 'https://placehold.co/150x40/png?text=Zumradshop' },
    { name: 'Umari Brand', logo: 'https://placehold.co/150x40/png?text=Umari+Brand' },
    { name: 'Sellway', logo: 'https://placehold.co/150x40/png?text=Sellway' },
];

export function LogoTicker() {
    const { t } = useLanguage();
    const durationSeconds = 8;

    return (
        <section className="py-8 md:py-12 bg-white border-b border-slate-100 overflow-hidden">
            <Container>
                <div className="flex items-center gap-8">
                    <span className="text-sm font-medium text-slate-500 whitespace-nowrap">{t('home.brands_title')}:</span>
                    <div className="flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black,transparent)]">
                        <div
                            className="ticker-track flex w-max items-center gap-10 pr-10 md:gap-14 md:pr-14 will-change-transform"
                            style={{ ['--ticker-duration' as never]: `${durationSeconds}s` } as React.CSSProperties}
                            aria-hidden
                        >
                            {[...logos, ...logos].map((logo, index) => (
                                <div
                                    key={`${logo.name}-${index}`}
                                    className="h-8 w-auto flex-shrink-0 grayscale opacity-60 hover:opacity-100 transition-opacity"
                                >
                                    <span className="text-xl font-bold text-slate-400 whitespace-nowrap">{logo.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Container>

            <style jsx>{`
                .ticker-track {
                    animation: ticker var(--ticker-duration, 10s) linear infinite;
                }

                @keyframes ticker {
                    from {
                        transform: translateX(0);
                    }
                    to {
                        transform: translateX(-50%);
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .ticker-track {
                        animation: none;
                        transform: translateX(0);
                    }
                }
            `}</style>
        </section>
    );
}
