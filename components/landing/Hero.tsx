'use client';

import { motion } from 'framer-motion';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

export function Hero() {
    return (
        <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-400/20 blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet-400/20 blur-[100px]" />
            </div>

            <Container className="relative z-10">
                <div className="flex flex-col items-center text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Badge variant="blue" className="mb-6 backdrop-blur-sm bg-blue-50/80">
                            <Sparkles className="w-3 h-3 mr-2" />
                            AI Studio for Marketplaces
                        </Badge>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 max-w-4xl"
                    >
                        AI orqali <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">sotuvga tayyor</span> kontent yarating
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed"
                    >
                        Umari Studio marketplace rasmlar, video va copywritingni bitta platformada jamlaydi. Tezroq ishlab, sifatni bir xil darajada ushlab turing.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="mt-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
                    >
                        <Link href="/register" className="w-full sm:w-auto">
                            <Button size="lg" className="w-full sm:w-auto group">
                                Boshlash
                                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </Link>
                        <Link href="#examples" className="w-full sm:w-auto">
                            <Button variant="outline" size="lg" className="w-full sm:w-auto">
                                Natijalarni ko‘rish
                            </Button>
                        </Link>
                    </motion.div>

                    {/* Hero Image / Video Placeholder */}
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.7, delay: 0.4 }}
                        className="mt-16 w-full max-w-5xl rounded-3xl border border-slate-200 bg-white/50 backdrop-blur-xl p-2 shadow-2xl shadow-blue-500/10"
                    >
                        <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-slate-100 relative group">
                            {/* Placeholder content showing interface */}
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
                                <p className="text-slate-400 font-medium">Platforma interfeysi</p>
                            </div>
                            {/* Decorative elements resembling UI */}
                            <div className="absolute top-4 left-4 right-4 h-8 bg-white/60 rounded-lg" />
                            <div className="absolute top-16 left-4 bottom-4 w-48 bg-white/60 rounded-lg" />
                            <div className="absolute top-16 left-56 right-4 bottom-4 bg-white/60 rounded-lg" />
                        </div>
                    </motion.div>
                </div>
            </Container>
        </section>
    );
}
