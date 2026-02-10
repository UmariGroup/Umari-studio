'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    question: "Bepul tarifda nechta token beriladi?",
    answer: "Ro'yxatdan o'tganda bepul foydalanuvchiga 5 ta sinov token beriladi. Bu tokenlar bilan oddiy rasm ish jarayonini sinab ko'rishingiz mumkin.",
  },
  {
    question: "Tokenlar qanday yechiladi?",
    answer: "Tokenlar har bir so'rov uchun yechiladi. Masalan, Business+ pro rasm so'rovi 5 token bo'lsa, nechta natija qaytishidan qat'i nazar bitta so'rov uchun 5 token hisoblanadi.",
  },
  {
    question: "Tarifni qanday faollashtiraman?",
    answer: "Landing pricing bo'limidagi Yangilash tugmasini bossangiz, Telegram'da @UmariAI_admin bilan chat ochiladi va tanlangan tarif bo'yicha xabar avtomatik yuboriladi.",
  },
  {
    question: "Qaysi marketplace uchun mos?",
    answer: "Umari AI Uzum, Wildberries va boshqa onlayn savdo kanallari uchun mos. Rasm, video va copy natijalari listing ish jarayoniga mos formatda ishlab chiqiladi.",
  },
  {
    question: "Oylik tariflar qanday?",
    answer: "Starter: $9 (140 token), Pro: $19 (350 token), Business+: $29 (600 token). Hozir faqat oylik billing modeli qo'llaniladi.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-white py-20">
      <Container>
        <div className="mb-14 flex flex-col items-center text-center">
          <Badge variant="slate" className="mb-4">Savol-javob</Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 lg:text-5xl">Ko'p so'raladigan savollar</h2>
          <p className="mt-4 max-w-2xl text-slate-600">
            Tarif, token va foydalanish bo'yicha asosiy ma'lumotlar shu yerda jamlangan.
          </p>
        </div>

        <div className="mx-auto max-w-3xl space-y-4">
          {faqs.map((faq, index) => (
            <article
              key={faq.question}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors duration-200 hover:border-blue-200"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="flex w-full items-center justify-between p-6 text-left"
              >
                <span className="text-lg font-semibold text-slate-900">{faq.question}</span>
                {openIndex === index ? <Minus className="h-5 w-5 text-blue-600" /> : <Plus className="h-5 w-5 text-slate-400" />}
              </button>
              <AnimatePresence initial={false}>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: 'easeInOut' }}
                  >
                    <div className="px-6 pb-6 leading-relaxed text-slate-600">{faq.answer}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
