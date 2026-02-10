'use client';

import { motion } from 'framer-motion';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import { getTelegramSubscribeUrl } from '@/lib/telegram';
import type { SubscriptionPlan } from '@/lib/subscription-plans';

type LandingPlan = {
  id: SubscriptionPlan;
  name: string;
  subtitle: string;
  priceMonthly: number;
  monthlyTokens: number;
  features: string[];
  tokenPricing: {
    imageBasic: string;
    imagePro: string;
    video: string;
    text: string;
  };
  popular: boolean;
};

const plans: LandingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    subtitle: 'Tez va arzon boshlash uchun',
    priceMonthly: 9,
    monthlyTokens: 140,
    features: [
      '140 token/oy',
      "Rasm: Oddiy + Pro",
      'Video: Umari Flash',
      "Copywriter: 18 blok (qisqa)",
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
    subtitle: 'Marketplace va reklama uchun',
    priceMonthly: 19,
    monthlyTokens: 350,
    features: [
      '350 token/oy',
      'Pro rasm + pro video',
      'Marketplace/katalog uchun mos',
      'Kengaytirilgan ish jarayoni',
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
    subtitle: 'Agency / SMM / katalog uchun',
    priceMonthly: 29,
    monthlyTokens: 600,
    features: [
      '600 token/oy',
      'Eng kuchli rasm rejimi',
      "Ko'p video va rakurs",
      'Yuqori tezlik va hajm',
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

export function Pricing() {
  const onSelectPlan = (plan: SubscriptionPlan) => {
    const url = getTelegramSubscribeUrl(plan);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section id="pricing" className="bg-slate-50 py-20">
      <Container>
        <div className="mb-10 text-center">
          <Badge variant="blue" className="mb-4">Narxlar</Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 lg:text-5xl">Oylik tariflar</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            Faqat oylik to'lov mavjud. Tarifni tanlang va tugma orqali Telegram'da @UmariAI_admin ga so'rov yuboring.
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
                  <Badge variant="blue" className="border-0 bg-blue-600 text-white shadow-lg shadow-blue-200">Eng mashhur</Badge>
                </div>
              )}

              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{plan.name}</p>
              <h3 className="mt-1 text-2xl font-black text-slate-900">{plan.name}</h3>
              <p className="mt-2 text-sm text-slate-600">{plan.subtitle}</p>

              <div className="mt-5 flex items-end gap-1">
                <span className="text-4xl font-black text-slate-900">${plan.priceMonthly.toFixed(2)}</span>
                <span className="pb-1 text-slate-500">/oy</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-blue-700">{plan.monthlyTokens} token / oy</p>

              <div className="mt-6">
                <h4 className="mb-3 text-sm font-bold text-slate-900">Xususiyatlar</h4>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h5 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Token narxlari</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Oddiy rasm (so'rov):</span>
                    <span className="font-semibold text-slate-800">{plan.tokenPricing.imageBasic}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Pro rasm (so'rov):</span>
                    <span className="font-semibold text-slate-800">{plan.tokenPricing.imagePro}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Video:</span>
                    <span className="font-semibold text-slate-800">{plan.tokenPricing.video}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Matn:</span>
                    <span className="font-semibold text-slate-800">{plan.tokenPricing.text}</span>
                  </div>
                </div>
              </div>

              <Button
                className="mt-7 w-full"
                variant={plan.popular ? 'primary' : 'outline'}
                onClick={() => onSelectPlan(plan.id)}
              >
                Yangilash {'>'}
              </Button>
            </motion.article>
          ))}
        </div>
      </Container>
    </section>
  );
}
