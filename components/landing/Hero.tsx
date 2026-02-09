'use client';

import { motion } from 'framer-motion';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-32 lg:pb-32 lg:pt-48">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-blue-400/20 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-violet-400/20 blur-[100px]" />
      </div>

      <Container className="relative z-10">
        <div className="flex flex-col items-center text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Badge variant="blue" className="mb-6 bg-blue-50/80 backdrop-blur-sm">
              <Sparkles className="mr-2 h-3 w-3" />
              Marketplace uchun AI studiya
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-4xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-7xl"
          >
            AI orqali <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">sotuvga tayyor</span> kontent yarating
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl"
          >
            Umari Studio marketplace rasmlar, video va matn yaratishni bitta platformada jamlaydi. Tezroq ishlab, sifatni bir xil darajada ushlab turing.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex w-full flex-col gap-4 sm:w-auto sm:flex-row"
          >
            <Link href="/register" className="w-full sm:w-auto">
              <Button size="lg" className="group w-full sm:w-auto">
                Boshlash
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="#examples" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Natijalarni ko'rish
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-16 w-full max-w-5xl rounded-3xl border border-slate-200 bg-white/50 p-2 shadow-2xl shadow-blue-500/10 backdrop-blur-xl"
          >
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-slate-100">
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
                <p className="font-medium text-slate-400">Platforma interfeysi</p>
              </div>
              <div className="absolute left-4 right-4 top-4 h-8 rounded-lg bg-white/60" />
              <div className="absolute bottom-4 left-4 top-16 w-48 rounded-lg bg-white/60" />
              <div className="absolute bottom-4 left-56 right-4 top-16 rounded-lg bg-white/60" />
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
