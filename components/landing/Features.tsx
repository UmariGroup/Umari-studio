'use client';

import { motion } from 'framer-motion';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { LayoutGrid, Zap, Video, Type, CheckCircle } from 'lucide-react';

const features = [
    {
        title: 'Marketplace Studio',
        description: 'Mahsulot rasmlarini professional fon va yorug‘lik bilan tayyorlaydi.',
        icon: LayoutGrid,
        className: 'md:col-span-2',
        color: 'bg-blue-50 text-blue-700',
    },
    {
        title: 'Video Generatsiya',
        description: 'Prompt asosida reklama videolarini tez generatsiya qiladi.',
        icon: Video,
        className: 'md:col-span-1',
        color: 'bg-violet-50 text-violet-700',
    },
    {
        title: 'Smart Copywriter',
        description: 'UZ + RU marketplace matnlarini strukturali qilib yozadi.',
        icon: Type,
        className: 'md:col-span-1',
        color: 'bg-indigo-50 text-indigo-700',
    },
    {
        title: 'Tezkor Workflow',
        description: 'Bir oynada prompt, reference va natijalarni boshqarasiz.',
        icon: Zap,
        className: 'md:col-span-2',
        color: 'bg-amber-50 text-amber-700',
    },
];

export function Features() {
    return (
        <section id="features" className="py-20 bg-slate-50">
            <Container>
                <div className="flex flex-col items-center text-center mb-16">
                    <Badge variant="indigo" className="mb-4">Features</Badge>
                    <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">
                        Bitta platformada to‘liq studio
                    </h2>
                    <p className="mt-4 text-lg text-slate-600 max-w-2xl">
                        Conteningizni alohida xizmatlarga bo‘lmasdan, yagona workflow orqali boshqaring.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            viewport={{ once: true }}
                            className={`group relative overflow-hidden rounded-3xl bg-white p-8 shadow-sm border border-slate-200 hover:shadow-lg transition-shadow duration-300 ${feature.className}`}
                        >
                            <div className={`absolute top-0 right-0 p-32 opacity-10 rounded-full blur-3xl transition-transform duration-500 group-hover:scale-110 ${feature.color.split(' ')[0]}`} />

                            <div className={`mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.color}`}>
                                <feature.icon className="h-6 w-6" />
                            </div>

                            <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
                            <p className="text-slate-600 leading-relaxed">
                                {feature.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </Container>
        </section>
    );
}
