'use client';

import { motion } from 'framer-motion';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { useLanguage } from '@/lib/LanguageContext';

export function Testimonials() {
  const { t } = useLanguage();

  const testimonials = [
    {
      name: t('home.testimonials.items.0.name'),
      role: t('home.testimonials.items.0.role'),
      content: t('home.testimonials.items.0.content'),
      image: 'https://placehold.co/100x100/png?text=JK',
    },
    {
      name: t('home.testimonials.items.1.name'),
      role: t('home.testimonials.items.1.role'),
      content: t('home.testimonials.items.1.content'),
      image: 'https://placehold.co/100x100/png?text=MI',
    },
    {
      name: t('home.testimonials.items.2.name'),
      role: t('home.testimonials.items.2.role'),
      content: t('home.testimonials.items.2.content'),
      image: 'https://placehold.co/100x100/png?text=OY',
    },
  ];

  return (
    <section className="overflow-hidden bg-white py-20 lg:py-32">
      <Container>
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <Badge variant="violet" className="mb-4">{t('home.testimonials_badge')}</Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 lg:text-5xl">
            {t('home.testimonials_title')}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="flex flex-col rounded-3xl border border-slate-100 bg-slate-50 p-8"
            >
              <div className="mb-6 flex items-center gap-4">
                <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-200">
                  <img src={testimonial.image} alt={testimonial.name} className="h-full w-full object-cover" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">{testimonial.name}</h4>
                  <p className="text-sm text-slate-500">{testimonial.role}</p>
                </div>
              </div>
              <p className="italic text-slate-600">"{testimonial.content}"</p>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
