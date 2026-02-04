'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Plan {
  id: string;
  name: string;
  duration_months: number;
  price: number;
  tokens_included: number;
  features: string[];
  description: string;
}

export default function SubscriptionPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/subscriptions/plans');
      const data = await response.json();
      if (data.success) {
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const defaultPlans = [
    {
      id: '1',
      name: 'Free',
      duration_months: 0,
      price: 0,
      tokens_included: 5,
      features: [
        '5 ta tokens/oy',
        'AI rasmlar',
        'Asosiy descriptions',
        'Community support',
      ],
      description: 'Boshlash uchun mukammal',
    },
    {
      id: '2',
      name: 'Starter',
      duration_months: 1,
      price: 9.99,
      tokens_included: 100,
      features: [
        '100 ta tokens/oy',
        '4K rasmlar',
        '18-block descriptions',
        'Video scripts',
        'Email support',
        'Bilingual content',
      ],
      description: 'Kichik bizneslar uchun',
    },
    {
      id: '3',
      name: 'Professional',
      duration_months: 1,
      price: 29.99,
      tokens_included: 500,
      features: [
        '500 ta tokens/oy',
        'Barcha Starter xususiyatlari',
        'Advanced analytics',
        'Copywriting tools',
        'Priority support',
        'API access',
      ],
      description: 'O\'rta darajadagi bizneslar',
    },
    {
      id: '4',
      name: 'Enterprise',
      duration_months: 1,
      price: 99.99,
      tokens_included: 2000,
      features: [
        '2000 ta tokens/oy',
        'Barcha Professional xususiyatlari',
        'Unlimited API calls',
        'Batch processing',
        '24/7 phone support',
        'Custom integrations',
      ],
      description: 'Katta enterpriselar uchun',
    },
  ];

  const displayPlans = plans.length > 0 ? plans : defaultPlans;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <nav className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Umari Studio
          </Link>
          <div className="flex gap-4">
            <Link href="/login" className="px-4 py-2 hover:text-purple-400 transition">
              Kirish
            </Link>
            <Link href="/register" className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg hover:from-purple-600 hover:to-pink-600 transition">
              Ro'yxatdan o'tish
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4">Sodiq va shaffof narxlar</h1>
          <p className="text-xl text-gray-300">
            Har bir paketda unlimited imkoniyatlar - siz faqat token-larda to'laysiz
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <p className="text-gray-400">Reja-lar yuklanimoqda...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {displayPlans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-8 transition transform hover:scale-105 ${
                  plan.name === 'Professional'
                    ? 'bg-gradient-to-br from-purple-600 to-pink-600 ring-2 ring-purple-400'
                    : 'bg-white/10 border border-white/20 hover:border-purple-400/50'
                }`}
              >
                {plan.name === 'Professional' && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-black px-4 py-1 rounded-full text-sm font-bold">
                    ⭐ Ko'p tanlanadi
                  </div>
                )}

                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-sm text-gray-300 mb-4">{plan.description}</p>

                <div className="mb-6">
                  <div className="text-4xl font-bold mb-2">
                    {plan.price === 0 ? 'Bepul' : `$${plan.price}`}
                  </div>
                  {plan.price > 0 && (
                    <p className="text-sm text-gray-400">{plan.duration_months} oy uchun</p>
                  )}
                </div>

                <div className="mb-6 pb-6 border-b border-white/10">
                  <p className="text-3xl font-bold text-green-400">
                    {plan.tokens_included}
                  </p>
                  <p className="text-sm text-gray-300">tokens/oy</p>
                </div>

                <div className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <span className="text-green-400 mt-1">✓</span>
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  className={`w-full py-3 rounded-lg font-semibold transition ${
                    plan.name === 'Professional'
                      ? 'bg-white text-purple-600 hover:bg-gray-100'
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                  }`}
                >
                  {plan.price === 0 ? 'Boshla' : 'Sotib ol'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* FAQ Section */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Tez-tez so'raladigan savollar</h2>

          <div className="space-y-6">
            <div className="bg-white/10 border border-white/20 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-2">Token-lar nima?</h3>
              <p className="text-gray-300">
                Token - bu har bir AI operatsiya uchun o'lchov birligi. Rasm yaratish, video script yoki
                tahlil qilish uchun token sarflash kerak.
              </p>
            </div>

            <div className="bg-white/10 border border-white/20 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-2">Token-larni qo'shab olaman?</h3>
              <p className="text-gray-300">
                Ha! Istalgan vaqtda qo'shimcha token paketini sotib olishingiz mumkin. Paketlar e'lon
                yangilanganida amal qiladi.
              </p>
            </div>

            <div className="bg-white/10 border border-white/20 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-2">Ishonchli qaytarish siyosati bor?</h3>
              <p className="text-gray-300">
                Ha! 30 kun ichida pulni qaytarish kafolati bilan. Agar sizni qoniqtirmasa, hech savolsiz
                qaytarish mumkin.
              </p>
            </div>

            <div className="bg-white/10 border border-white/20 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-2">Enterprise paketlari mavjudmi?</h3>
              <p className="text-gray-300">
                Ha! Katta bizneslar uchun custom paketlar mavjud. Biz bilan bog'lanish uchun
                support@umari.com ga yozing.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-20">
          <p className="text-gray-300 mb-6">Hozir boshlashga tayyor?</p>
          <Link
            href="/register"
            className="inline-block px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-bold text-lg transition transform hover:scale-105"
          >
            Bepul account yaratish
          </Link>
        </div>
      </div>
    </div>
  );
}
