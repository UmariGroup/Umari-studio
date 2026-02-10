'use client';

import { motion } from 'framer-motion';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { LayoutGrid, Zap, Video, Type } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export function Features() {
  const { t } = useLanguage();

  const features = [
    {
      title: t('home.features_marketplace'),
      description: t('home.features_marketplace_desc'),
      icon: LayoutGrid,
      className: 'md:col-span-2',
      color: 'bg-blue-50 text-blue-700',
    },
    {
      title: t('home.features_video'),
      description: t('home.features_video_desc'),
      icon: Video,
      className: 'md:col-span-1',
      color: 'bg-violet-50 text-violet-700',
    },
    {
      title: t('home.features_copywriter'),
      description: t('home.features_copywriter_desc'),
      icon: Type,
      className: 'md:col-span-1',
      color: 'bg-indigo-50 text-indigo-700',
    },
    {
      title: t('home.features_workflow'),
      description: t('home.features_workflow_desc'),
      icon: Zap,
      className: 'md:col-span-2',
      color: 'bg-amber-50 text-amber-700',
    },
  ];

  return (
    <section id="features" className="bg-slate-50 py-20">
      <Container>
        <div className="mb-16 flex flex-col items-center text-center">
          <Badge variant="indigo" className="mb-4">{t('nav.features')}</Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            {t('home.features_title')}
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">
            {t('home.features_subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow duration-300 hover:shadow-lg ${feature.className}`}
            >
              <div className={`absolute right-0 top-0 rounded-full p-32 opacity-10 blur-3xl transition-transform duration-500 group-hover:scale-110 ${feature.color.split(' ')[0]}`} />

              <div className={`mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.color}`}>
                <feature.icon className="h-6 w-6" />
              </div>

              <h3 className="mb-2 text-xl font-bold text-slate-900">{feature.title}</h3>
              <p className="leading-relaxed text-slate-600">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
