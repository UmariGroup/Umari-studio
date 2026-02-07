'use client';

import { motion } from 'framer-motion';
import { Container } from '@/components/ui/Container';

const logos = [
    { name: 'Acme Corp', logo: 'https://placehold.co/150x40/png?text=Acme' },
    { name: 'Quantum', logo: 'https://placehold.co/150x40/png?text=Quantum' },
    { name: 'Echo Valley', logo: 'https://placehold.co/150x40/png?text=Echo' },
    { name: 'Celestial', logo: 'https://placehold.co/150x40/png?text=Celestial' },
    { name: 'Pulse', logo: 'https://placehold.co/150x40/png?text=Pulse' },
    { name: 'Apex', logo: 'https://placehold.co/150x40/png?text=Apex' },
];

export function LogoTicker() {
    return (
        <section className="py-8 md:py-12 bg-white border-b border-slate-100 overflow-hidden">
            <Container>
                <div className="flex items-center gap-8">
                    <span className="text-sm font-medium text-slate-500 whitespace-nowrap">Trusted by industry leaders:</span>
                    <div className="flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black,transparent)]">
                        <motion.div
                            className="flex gap-14 pr-14"
                            animate={{
                                translateX: '-50%',
                            }}
                            transition={{
                                duration: 20,
                                repeat: Infinity,
                                ease: 'linear',
                                repeatType: 'loop',
                            }}
                        >
                            {[...logos, ...logos].map((logo, index) => (
                                <div key={index} className="h-8 w-auto flex-shrink-0 grayscale opacity-60 hover:opacity-100 transition-opacity">
                                    {/* Replace with actual SVGs or Images */}
                                    <span className="text-xl font-bold text-slate-400">{logo.name}</span>
                                </div>
                            ))}
                        </motion.div>
                    </div>
                </div>
            </Container>
        </section>
    );
}
