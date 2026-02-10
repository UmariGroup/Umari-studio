'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { useLanguage } from '@/lib/LanguageContext';

const exampleImages = [
  '/examples/marketplace.png',
  '/examples/marketplace2.png',
  '/examples/marketplace3.png',
  '/examples/marketplace4.png',
  '/examples/marketplace5.png',
  '/examples/marketplace6.png',
  '/examples/marketplace7.png',
  '/examples/marketplace8.png',
  '/examples/marketplace9.png',
  '/examples/marketplace10.png',
  '/examples/marketplace11.png',
  '/examples/marketplace12.png',
  '/examples/marketplace13.png',
  '/examples/marketplace14.png',
  '/examples/marketplace15.png',
  '/examples/marketplace16.png',
  '/examples/marketplace17.png',
  '/examples/marketplace18.png',
  '/examples/marketplace19.png',
];

const firstRow = [...exampleImages, ...exampleImages];
const secondRow = [...exampleImages.slice(4), ...exampleImages.slice(0, 4), ...exampleImages.slice(4), ...exampleImages.slice(0, 4)];

function ExampleCard({
  src,
  priority = true,
  alt,
}: {
  src: string;
  priority?: boolean;
  alt: string;
}) {
  return (
    <div className="examples-card group relative aspect-[3/4] w-[132px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:w-[168px] md:w-[200px]">
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
        sizes="(max-width: 640px) 132px, (max-width: 768px) 168px, 200px"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/35 via-transparent to-transparent" />
    </div>
  );
}

export function ExamplesCarousel() {
  const { t } = useLanguage();

  return (
    <section id="examples" className="relative overflow-hidden border-y border-slate-200 bg-gradient-to-b from-white via-blue-50/40 to-white py-20 lg:py-24">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          viewport={{ once: true }}
          className="mb-10 text-center"
        >
          <Badge variant="violet" className="mb-4">{t('home.examples_title')}</Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">{t('home.examples_heading')}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">{t('home.examples_subtitle')}</p>
        </motion.div>
      </Container>

      <div className="relative space-y-4">
        <div className="examples-fade pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-24" />
        <div className="examples-fade pointer-events-none absolute inset-y-0 right-0 z-10 w-16 rotate-180 sm:w-24" />

        <div className="examples-marquee">
          {firstRow.map((src, index) => (
            <ExampleCard
              key={`row1-${index}-${src}`}
              src={src}
              priority={index < 4}
              alt={t('home.example_alt')}
            />
          ))}
        </div>

        <div className="examples-marquee examples-marquee-reverse">
          {secondRow.map((src, index) => (
            <ExampleCard key={`row2-${index}-${src}`} src={src} alt={t('home.example_alt')} />
          ))}
        </div>
      </div>
    </section>
  );
}
