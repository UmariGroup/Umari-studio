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
    'marketing-metrics': '📊 Marketing Metrics',
    'competitor-analysis': '🥊 Raqobatchilar tahlili',
    'content-performance': '📝 Content Performance',
    'social-media': '📱 Social Media tahlili',
    'sales-data': '💰 Sotuv tahlili',
    'customer-behavior': '👥 Mijoz xatti-harakatlari',
    'trend-analysis': '📈 Trend tahlili'
  };

  const handleAnalyze = async () => {
    if (!data.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/vertex/analyze-marketing-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: data,
          analysisType
        }),
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
          
          const chunk = new TextDecoder().decode(value);
          streamedResults += chunk;
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
      'marketing-metrics': `Website Traffic: 15,432 visits
Bounce Rate: 45%
Conversion Rate: 3.2%
Social Media Followers: 8,500
Email Open Rate: 22%
Click-through Rate: 4.8%
Cost per Click: $1.20
Return on Ad Spend: 4.2x`,
      'competitor-analysis': `Competitor A:
- Followers: 25,000
- Engagement: 5.2%
- Posting frequency: 2x daily
- Popular content: video tutorials

Our metrics:
- Followers: 18,000
- Engagement: 3.8%
- Posting frequency: 1x daily`,
      'content-performance': `Blog Post A: 1,500 views, 45 shares
Blog Post B: 3,200 views, 120 shares
Video Content: 8,500 views, 250 likes
Infographic: 2,100 views, 85 shares
Engagement rates by platform:
- LinkedIn: 6.2%
- Instagram: 4.1%
- Facebook: 2.8%`,
    };
    
    setData(sampleData[analysisType as keyof typeof sampleData] || sampleData['marketing-metrics']);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-600 hover:text-purple-600">
              ← Orqaga
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">📊 Analytics Studio</h1>
          </div>
          <Link
            href="/dashboard"
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold mb-4">Ma'lumotlar tahlili</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tahlil turi
                  </label>
                  <select
                    value={analysisType}
                    onChange={(e) => setAnalysisType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  >
                    {Object.entries(analysisTypes).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ma'lumotlar *
                  </label>
                  <textarea
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    placeholder="Tahlil qilish uchun ma'lumotlarni kiriting..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 h-32 resize-none"
                  />
                  <button
                    onClick={handleSampleData}
                    className="mt-2 text-sm text-purple-600 hover:text-purple-700"
                  >
                    📝 Namuna ma'lumot yuklash
                  </button>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={loading || !data.trim()}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {loading ? 'Tahlil qilinmoqda... ⏳' : 'Ma\'lumotlarni Tahlil Qilish 📊'}
                </button>
              </div>
            </div>

            {/* Features Info */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-6">
              <h3 className="font-bold text-lg mb-3">🎯 Tahlil natijasi:</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  Professional tahlil va xulosalar
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  Actionable tavsiyalar
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  KPI va performance metrikalar
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  Yaxshilash strategiyalari
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-bold mb-3">⚡ Tezkor harakatlar</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setAnalysisType('marketing-metrics');
                    handleSampleData();
                  }}
                  className="p-3 bg-blue-50 hover:bg-blue-100 rounded-lg text-left"
                >
                  <div className="font-medium text-sm">📊 Marketing</div>
                  <div className="text-xs text-gray-600">Metrics tahlili</div>
                </button>
                <button
                  onClick={() => {
                    setAnalysisType('competitor-analysis');
                    handleSampleData();
                  }}
                  className="p-3 bg-red-50 hover:bg-red-100 rounded-lg text-left"
                >
                  <div className="font-medium text-sm">🥊 Raqobat</div>
                  <div className="text-xs text-gray-600">Competitor check</div>
                </button>
                <button
                  onClick={() => {
                    setAnalysisType('content-performance');
                    handleSampleData();
                  }}
                  className="p-3 bg-green-50 hover:bg-green-100 rounded-lg text-left"
                >
                  <div className="font-medium text-sm">📝 Content</div>
                  <div className="text-xs text-gray-600">Performance</div>
                </button>
                <button
                  onClick={() => setAnalysisType('trend-analysis')}
                  className="p-3 bg-purple-50 hover:bg-purple-100 rounded-lg text-left"
                >
                  <div className="font-medium text-sm">📈 Trends</div>
                  <div className="text-xs text-gray-600">Market trends</div>
                </button>
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">🎯 Tahlil Natijasi</h2>
            
            {results ? (
              <div className="space-y-4">
                <div className="max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">
                  {results}
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => navigator.clipboard.writeText(results)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                  >
                    📋 Nusxalash
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
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
                  >
                    💾 Hisobot saqlash
                  </button>
                  <button
                    onClick={() => {
                      const sections = results.split('\n\n').length;
                      const recommendations = (results.match(/recommend|suggest|should|tavsiya/gi) || []).length;
                      toast.info(`Bo'limlar: ${sections}\nTavsiyalar: ${recommendations}`, 'Hisobot statistikasi');
                    }}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm"
                  >
                    📊 Hisobot statistikasi
                  </button>
                </div>

                {/* Analysis Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 rounded-lg">
                    <div className="text-green-600 font-semibold text-sm">✅ Kuchli tomonlar</div>
                    <div className="text-xs text-gray-600 mt-1">Identified</div>
                  </div>
                  <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-3 rounded-lg">
                    <div className="text-yellow-600 font-semibold text-sm">⚠️ Yaxshilanishi kerak</div>
                    <div className="text-xs text-gray-600 mt-1">Areas found</div>
                  </div>
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-lg">
                    <div className="text-blue-600 font-semibold text-sm">🎯 Tavsiyalar</div>
                    <div className="text-xs text-gray-600 mt-1">Provided</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-96 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-500">
                {loading ? (
                  <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                    Ma'lumotlar tahlil qilinmoqda...
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-gray-400 mb-2">📊</div>
                    Ma'lumotlar kiriting va tahlil qiling
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
