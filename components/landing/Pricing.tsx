'use client';

import { motion } from 'framer-motion';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import { getTelegramSubscribeUrl } from '@/lib/telegram';
import type { SubscriptionPlan } from '@/lib/subscription-plans';
import { useLanguage } from '@/lib/LanguageContext';

type LandingPlan = {
  id: SubscriptionPlan;
  name: string;
  subtitleKey: string;
  priceMonthly: number;
  monthlyTokens: number;
  featureKeys: string[];
  tokenPricing: {
    imageBasic: string;
    imagePro: string;
    video: string;
    text: string;
  };
  popular: boolean;
};

export function Pricing() {
  const { t } = useLanguage();

  const plans: LandingPlan[] = [
    {
      id: 'starter',
      name: 'Starter',
      subtitleKey: 'pricing.starterSubtitle',
      priceMonthly: 9,
      monthlyTokens: 140,
      featureKeys: [
        'pricing.starterFeature1',
        'pricing.starterFeature2',
        'pricing.starterFeature3',
        'pricing.starterFeature4',
      ],
      tokenPricing: {
        imageBasic: '2',
        imagePro: '7',
        video: '15',
        text: '3',
      },
      popular: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      subtitleKey: 'pricing.proSubtitle',
      priceMonthly: 19,
      monthlyTokens: 350,
      featureKeys: [
        'pricing.proFeature1',
        'pricing.proFeature2',
        'pricing.proFeature3',
        'pricing.proFeature4',
      ],
      tokenPricing: {
        imageBasic: '1.5',
        imagePro: '6',
        video: '25',
        text: '2',
      },
      popular: true,
    },
    {
      id: 'business_plus',
      name: 'Business+',
      subtitleKey: 'pricing.businessSubtitle',
      priceMonthly: 29,
      monthlyTokens: 600,
      featureKeys: [
        'pricing.businessFeature1',
        'pricing.businessFeature2',
        'pricing.businessFeature3',
        'pricing.businessFeature4',
      ],
      tokenPricing: {
        imageBasic: '1',
        imagePro: '5',
        video: '20',
        text: '1',
      },
      popular: false,
    },
  ];

  const onSelectPlan = (plan: SubscriptionPlan) => {
    const url = getTelegramSubscribeUrl(plan);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section id="pricing" className="bg-slate-50 py-20">
      <Container>
        <div className="mb-10 text-center">
          <Badge variant="blue" className="mb-4">{t('nav.pricing')}</Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 lg:text-5xl">{t('home.pricing_title')}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">{t('home.pricing_subtitle')}</p>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500">
            {t('pricing.billingInfo')}
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-sm font-medium text-emerald-700">
            {t('pricing.moneyBackGuarantee')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:gap-10">
          {plans.map((plan, index) => (
            <motion.article
              key={plan.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              viewport={{ once: true }}
              className={clsx(
                'relative flex flex-col rounded-3xl border bg-white p-7 shadow-sm transition-shadow hover:shadow-xl',
                plan.popular ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'
              )}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge variant="blue" className="border-0 bg-blue-600 text-white shadow-lg shadow-blue-200">{t('pricing.popular')}</Badge>
                </div>
              )}

              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{plan.name}</p>
              <h3 className="mt-1 text-2xl font-black text-slate-900">{plan.name}</h3>
              <p className="mt-2 text-sm text-slate-600">{t(plan.subtitleKey)}</p>

              <div className="mt-5 flex items-end gap-1">
                <span className="text-4xl font-black text-slate-900">${plan.priceMonthly.toFixed(2)}</span>
                <span className="pb-1 text-slate-500">{t('pricing.perMonth')}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-blue-700">{plan.monthlyTokens} {t('pricing.tokens')} / {t('pricing.perMonth')}</p>

              <div className="mt-6">
                <h4 className="mb-3 text-sm font-bold text-slate-900">{t('pricing.features')}</h4>
                <ul className="space-y-2">
                  {plan.featureKeys.map((featureKey) => (
                    <li key={featureKey} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                      <span>{t(featureKey)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h5 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">{t('pricing.tokenPricing')}</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">{t('pricing.imageBasic')}:</span>
                    <span className="font-semibold text-slate-800">{plan.tokenPricing.imageBasic}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">{t('pricing.imagePro')}:</span>
                    <span className="font-semibold text-slate-800">{plan.tokenPricing.imagePro}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">{t('pricing.video')}:</span>
                    <span className="font-semibold text-slate-800">{plan.tokenPricing.video}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">{t('pricing.text')}:</span>
                    <span className="font-semibold text-slate-800">{plan.tokenPricing.text}</span>
                  </div>
                </div>
              </div>

              <Button
                className="mt-7 w-full"
                variant={plan.popular ? 'primary' : 'outline'}
                onClick={() => onSelectPlan(plan.id)}
              >
                {t('pricing.selectPlan')} {'>'}
              </Button>
            </motion.article>
          ))}
        </div>
      </Container>
    </section>
  );
}
