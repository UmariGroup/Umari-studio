'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { useLanguage } from '@/lib/LanguageContext';

type GuideVideo = {
  id: string;
  titleKey: string;
};


const videos: GuideVideo[] = [
  { id: '4aDXb_qJu7OPGVJA', titleKey: 'guide.video1' },
  { id: 'NK59gqEWwkbqRt60', titleKey: 'guide.video2' },
];

export function UsageGuideCarousel() {
  const { t } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);

  const total = videos.length;
  const current = useMemo(() => videos[activeIndex] || videos[0], [activeIndex]);

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + total) % total);
  };

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % total);
  };

  return (
    <section id="guide" className="bg-white py-20">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          viewport={{ once: true }}
          className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-blue-50/40 p-6 shadow-sm sm:p-8"
        >
          <div className="text-center">
            <Badge variant="blue" className="mb-4">{t('guide.badge')}</Badge>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t('guide.title')}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">{t('guide.subtitle')}</p>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-lg">
            <div className="relative aspect-video w-full">
              <iframe
                key={current.id}
                src={`https://www.youtube.com/embed/${current.id}`}
                title={t(current.titleKey)}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm font-medium text-slate-700">{t(current.titleKey)}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                {t('guide.prev')}
              </button>
              <button
                type="button"
                onClick={goNext}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                {t('guide.next')}
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            {videos.map((item, index) => {
              const active = index === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`h-9 w-9 rounded-full border text-sm font-semibold transition ${
                    active
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                  aria-label={`${t('guide.video')} ${index + 1}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
