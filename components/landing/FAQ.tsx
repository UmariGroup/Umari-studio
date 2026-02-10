'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { Plus, Minus } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export function FAQ() {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      questionKey: 'faq.question1',
      answerKey: 'faq.answer1',
    },
    {
      questionKey: 'faq.question2',
      answerKey: 'faq.answer2',
    },
    {
      questionKey: 'faq.question3',
      answerKey: 'faq.answer3',
    },
    {
      questionKey: 'faq.question4',
      answerKey: 'faq.answer4',
    },
    {
      questionKey: 'faq.question5',
      answerKey: 'faq.answer5',
    },
  ];

  return (
    <section id="faq" className="bg-white py-20">
      <Container>
        <div className="mb-14 flex flex-col items-center text-center">
          <Badge variant="slate" className="mb-4">{t('nav.faq')}</Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 lg:text-5xl">{t('home.faq_title')}</h2>
          <p className="mt-4 max-w-2xl text-slate-600">
            {t('home.faq_subtitle')}
          </p>
        </div>

        <div className="mx-auto max-w-3xl space-y-4">
          {faqs.map((faq, index) => (
            <article
              key={faq.questionKey}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors duration-200 hover:border-blue-200"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="flex w-full items-center justify-between p-6 text-left"
              >
                <span className="text-lg font-semibold text-slate-900">{t(faq.questionKey)}</span>
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
                    <div className="px-6 pb-6 leading-relaxed text-slate-600">{t(faq.answerKey)}</div>
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
