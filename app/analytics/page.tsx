'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';
import { parseApiErrorResponse, toUzbekErrorMessage } from '@/lib/uzbek-errors';

export default function AnalyticsStudioPage() {
  const toast = useToast();
  const [analysisType, setAnalysisType] = useState('marketing-metrics');
  const [data, setData] = useState('');
  const [results, setResults] = useState('');
  const [loading, setLoading] = useState(false);

  const analysisTypes = {
    'marketing-metrics': 'Marketing metrikalar',
    'competitor-analysis': 'Raqobatchilar tahlili',
    'content-performance': 'Kontent samaradorligi',
    'social-media': 'Ijtimoiy tarmoq tahlili',
    'sales-data': 'Sotuv tahlili',
    'customer-behavior': 'Mijoz xatti-harakati',
    'trend-analysis': 'Trend tahlili',
  };

  const handleAnalyze = async () => {
    if (!data.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/vertex/analyze-marketing-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics: data, analysisType }),
      });

      if (!response.ok) {
        const parsed = await parseApiErrorResponse(response);
        const { title, message } = toUzbekErrorMessage(parsed);
        toast.error(message, title);
        return;
      }

      const reader = response.body?.getReader();
      let streamedResults = '';
      setResults('');

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamedResults += new TextDecoder().decode(value);
          setResults(streamedResults);
        }
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error((error as Error).message || 'Xatolik yuz berdi.');
    } finally {
      setLoading(false);
    }
  };

  const handleSampleData = () => {
    const sampleData = {
      'marketing-metrics': `Veb trafik: 15,432 tashrif
Chiqish darajasi: 45%
Konversiya: 3.2%
Ijtimoiy tarmoq obunachilari: 8,500
Email ochilish darajasi: 22%
Bosish darajasi (CTR): 4.8%
Bir klik narxi (CPC): $1.20
Reklama qaytimi (ROAS): 4.2x`,
      'competitor-analysis': `Raqobatchi A:
- Obunachilar: 25,000
- Engagement: 5.2%
- Post chastotasi: kuniga 2 marta
- Ommabop kontent: video qo'llanmalar

Bizning ko'rsatkichlar:
- Obunachilar: 18,000
- Engagement: 3.8%
- Post chastotasi: kuniga 1 marta`,
      'content-performance': `Blog A: 1,500 ko'rish, 45 ulashish
Blog B: 3,200 ko'rish, 120 ulashish
Video kontent: 8,500 ko'rish, 250 layk
Infografika: 2,100 ko'rish, 85 ulashish
Platformalar bo'yicha engagement:
- LinkedIn: 6.2%
- Instagram: 4.1%
- Facebook: 2.8%`,
    };

    setData(sampleData[analysisType as keyof typeof sampleData] || sampleData['marketing-metrics']);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-600 hover:text-purple-600">
              Orqaga
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Analitika studiya</h1>
          </div>
          <Link href="/dashboard" className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700">
            Boshqaruv
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-bold">Ma'lumotlar tahlili</h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Tahlil turi</label>
                  <select
                    value={analysisType}
                    onChange={(e) => setAnalysisType(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none"
                  >
                    {Object.entries(analysisTypes).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Ma'lumotlar</label>
                  <textarea
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    placeholder="Tahlil uchun ma'lumotlarni kiriting..."
                    className="h-32 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSampleData}
                    className="mt-2 text-sm text-purple-600 hover:text-purple-700"
                  >
                    Namuna ma'lumotni yuklash
                  </button>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={loading || !data.trim()}
                  className="w-full rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 font-semibold text-white hover:from-purple-600 hover:to-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Tahlil qilinmoqda...' : 'Tahlilni boshlash'}
                </button>
              </div>
            </div>

            <div className="rounded-lg bg-gradient-to-r from-orange-50 to-red-50 p-6">
              <h3 className="mb-3 text-lg font-bold">Natijada nimalar chiqadi:</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  Professional tahlil va xulosalar
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  Aniq tavsiyalar
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  KPI va samaradorlik ko'rsatkichlari
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  Amaliy optimizatsiya yo'llari
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">Tahlil natijasi</h2>

            {results ? (
              <div className="space-y-4">
                <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm">
                  {results}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(results)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    Nusxalash
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([results], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `analytics-${analysisType}-${Date.now()}.txt`;
                      link.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
                  >
                    Hisobotni saqlash
                  </button>
                  <button
                    onClick={() => {
                      const sections = results.split('\n\n').length;
                      const recommendations = (results.match(/recommend|suggest|should|tavsiya/gi) || []).length;
                      toast.info(`Bo'limlar: ${sections}\nTavsiyalar: ${recommendations}`, 'Hisobot statistikasi');
                    }}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
                  >
                    Hisobot statistikasi
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-500">
                {loading ? (
                  <div className="text-center">
                    <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                    Ma'lumotlar tahlil qilinmoqda...
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="mb-2 text-gray-400">Natija hali yo'q</div>
                    Ma'lumot kiriting va tahlilni boshlang
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
