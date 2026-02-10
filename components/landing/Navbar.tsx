'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Menu, X } from 'lucide-react';

export function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { scrollY } = useScroll();

    useMotionValueEvent(scrollY, "change", (latest) => {
        setIsScrolled(latest > 50);
    });

    return (
        <motion.header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'py-4' : 'py-6'
                }`}
        >
            <Container>
                <div className={`relative flex items-center justify-between rounded-2xl px-6 py-3 transition-all duration-300 ${isScrolled
                        ? 'bg-white/80 backdrop-blur-md border border-slate-200 shadow-sm'
                        : 'bg-transparent'
                    }`}>
                    <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
                        Umari<span className="text-blue-600"> ai</span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-8">
                        <Link href="/#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                            Imkoniyatlar
                        </Link>
                        <Link href="/#examples" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                            Namunalar
                        </Link>
                        <Link href="/#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                            Narxlar
                        </Link>
                        <Link href="/#faq" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                            Savol-javob
                        </Link>
                    </nav>

                    <div className="hidden md:flex items-center gap-3">
                        <Link href="/login">
                            <Button variant="ghost" size="sm">Kirish</Button>
                        </Link>
                        <Link href="/register">
                            <Button size="sm">Boshlash</Button>
                        </Link>
                    </div>

                    {/* Mobile Toggle */}
                    <button
                        className="md:hidden p-2 text-slate-600"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </Container>


            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute top-full left-4 right-4 mt-2 p-4 bg-white rounded-2xl border border-slate-200 shadow-xl md:hidden flex flex-col gap-4"
                >
                    <Link href="/#features" className="text-base font-medium text-slate-600" onClick={() => setIsMobileMenuOpen(false)}>Imkoniyatlar</Link>
                    <Link href="/#examples" className="text-base font-medium text-slate-600" onClick={() => setIsMobileMenuOpen(false)}>Namunalar</Link>
                    <Link href="/#pricing" className="text-base font-medium text-slate-600" onClick={() => setIsMobileMenuOpen(false)}>Narxlar</Link>
                    <Link href="/#faq" className="text-base font-medium text-slate-600" onClick={() => setIsMobileMenuOpen(false)}>Savol-javob</Link>
                    <div className="h-px bg-slate-100" />
                    <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start">Kirish</Button>
                    </Link>
                    <Link href="/register" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button className="w-full">Boshlash</Button>
                    </Link>
                </motion.div>
            )}
        </motion.header>
    );
}
