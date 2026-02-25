'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import { getTelegramSubscribeUrl } from '@/lib/telegram';
import type { SubscriptionPlan } from '@/lib/subscription-plans';
import { useLanguage } from '@/lib/LanguageContext';
import {
  availableDurations,
  computeOldPrice,
  durationLabelUz,
  featuresToList,
  pickPlanForDuration,
  type DbSubscriptionPlanRow,
} from '@/lib/subscription-plan-catalog';

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

  const [dbPlans, setDbPlans] = useState<DbSubscriptionPlanRow[]>([]);
  const [durationMonths, setDurationMonths] = useState<number>(1);

  const durationToggleRef = useRef<HTMLDivElement | null>(null);
  const durationButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [highlight, setHighlight] = useState<{ x: number; width: number }>({ x: 0, width: 0 });
  const [popularBadge, setPopularBadge] = useState<{ x: number; width: number } | null>(null);

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
      popular: false,
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
      popular: true,
    },
  ];

  const discountPercentForDuration = useCallback((months: number): number => {
    const m = Number(months) || 1;
    if (m === 3) return 5;
    if (m === 6) return 10;
    if (m === 12) return 20;
    return 0;
  }, []);

  const onSelectPlan = (plan: SubscriptionPlan) => {
    const url = getTelegramSubscribeUrl(plan, durationMonths);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/subscriptions/plans');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const rows = Array.isArray(data?.plans) ? (data.plans as DbSubscriptionPlanRow[]) : [];
        if (!cancelled) setDbPlans(rows);
      } catch {
        // ignore
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const durationOptions = useMemo(() => availableDurations(dbPlans), [dbPlans]);

  const updateHighlight = useCallback(() => {
    const container = durationToggleRef.current;
    if (!container) return;

    const btn = durationButtonRefs.current[durationMonths];
    if (!btn) return;

    setHighlight({
      x: btn.offsetLeft,
      width: btn.offsetWidth,
    });

    const popularBtn = durationButtonRefs.current[12];
    if (popularBtn) {
      setPopularBadge({
        x: popularBtn.offsetLeft,
        width: popularBtn.offsetWidth,
      });
    } else {
      setPopularBadge(null);
    }
  }, [durationMonths]);

  useEffect(() => {
    if (!durationOptions.includes(durationMonths)) {
      setDurationMonths(durationOptions[0] || 1);
    }
  }, [durationOptions, durationMonths]);

  useLayoutEffect(() => {
    updateHighlight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMonths, durationOptions.length]);

  useEffect(() => {
    const container = durationToggleRef.current;
    if (!container) return;

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => updateHighlight());
      ro.observe(container);
    }

    const onResize = () => updateHighlight();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, [updateHighlight]);

  const planRowsById = useMemo(() => {
    const out = new Map<SubscriptionPlan, DbSubscriptionPlanRow | null>();
    out.set('starter', pickPlanForDuration(dbPlans, 'starter', durationMonths));
    out.set('pro', pickPlanForDuration(dbPlans, 'pro', durationMonths));
    out.set('business_plus', pickPlanForDuration(dbPlans, 'business_plus', durationMonths));
    return out;
  }, [dbPlans, durationMonths]);

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

        {durationOptions.length > 1 && (
          <div className="mx-auto mb-10 flex max-w-xl items-center justify-center">
            <div
              ref={durationToggleRef}
              className="relative inline-flex w-full overflow-visible rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
            >
              {popularBadge && durationOptions.includes(12) ? (
                <div
                  className="pointer-events-none absolute -top-4 z-20"
                  style={{ left: popularBadge.x + popularBadge.width / 2, transform: 'translateX(-50%)' }}
                >
                  <span className="inline-flex items-center whitespace-nowrap rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white">
                    {t('pricing.mostPopular')}
                  </span>
                </div>
              ) : null}

              <motion.div
                className="absolute inset-y-1 rounded-xl bg-slate-900"
                initial={false}
                animate={{
                  x: highlight.x,
                  width: highlight.width,
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                style={{ left: 0 }}
              />
              {durationOptions.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDurationMonths(m)}
                  ref={(el) => {
                    durationButtonRefs.current[m] = el;
                  }}
                  className={clsx(
                    'relative z-10 flex-1 rounded-xl px-5 pb-3 pt-8 text-base font-semibold transition',
                    m === durationMonths ? 'text-white' : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <span className="pointer-events-none absolute left-3 right-3 top-2 flex items-center justify-between gap-2">
                    <span>
                      {/* reserved for future top-left badges */}
                    </span>

                    <span>
                      {discountPercentForDuration(m) > 0 ? (
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold',
                            m === durationMonths ? 'bg-white/15 text-white' : 'bg-rose-50 text-rose-700'
                          )}
                        >
                          -{discountPercentForDuration(m)}%
                        </span>
                      ) : null}
                    </span>
                  </span>

                  <span className="block text-center leading-none">{durationLabelUz(m)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:gap-10">
          {plans.map((plan, index) => (
            (() => {
              const dbPlan = planRowsById.get(plan.id) || null;
              const tokens = dbPlan?.tokens_included ?? plan.monthlyTokens;
              const price = dbPlan?.price ?? plan.priceMonthly;
              const isMulti = durationMonths > 1;
              const tokenPerMonth = isMulti ? Math.round(tokens / durationMonths) : tokens;
              const featuresFromDb = dbPlan ? featuresToList(dbPlan.features) : [];
              const showDbFeatures = featuresFromDb.length > 0;

              return (
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
              <p className="mt-2 text-sm text-slate-600">{dbPlan?.description || t(plan.subtitleKey)}</p>

              {(() => {
                const discount = discountPercentForDuration(durationMonths);
                const old = computeOldPrice(price, discount);
                return (
                  <div className="mt-5 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      {old ? (
                        <span className="text-sm font-semibold text-slate-400 line-through">${old.toFixed(2)}</span>
                      ) : null}
                      {discount > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
                          -{discount}%
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-black text-slate-900">${Number(price).toFixed(2)}</span>
                      <span className="pb-1 text-slate-500">/{durationLabelUz(durationMonths)}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-blue-700">
                  {tokens} {t('pricing.tokens')} / {durationLabelUz(durationMonths)}
                </p>
                {durationMonths > 1 ? (
                  <p className="text-xs font-semibold text-slate-500">≈ {tokenPerMonth} {t('pricing.tokens')} / {t('pricing.perMonth')}</p>
                ) : null}
              </div>

              <div className="mt-6">
                <h4 className="mb-3 text-sm font-bold text-slate-900">{t('pricing.features')}</h4>
                <ul className="space-y-2">
                  {(showDbFeatures ? featuresFromDb : plan.featureKeys.map((k) => t(k))).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                      <span>{feature}</span>
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
              );
            })()
          ))}
        </div>
      </Container>
    </section>
  );      
}
