import { NextRequest } from 'next/server';
import { analyzeMarketingMetrics } from '@/services/gemini';

export async function POST(request: NextRequest) {
  try {
    const { metrics, analysisType } = await request.json();

    if (!metrics) {
      return new Response('Metrics data is required', { status: 400 });
    }

    const result = await analyzeMarketingMetrics(metrics, analysisType);

    return new Response(result, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });

  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to analyze metrics';
    console.error('Marketing metrics error:', message);

    const isAuthError =
      message.toLowerCase().includes('api key') ||
      message.toLowerCase().includes('gemini_api_key') ||
      message.toLowerCase().includes('apikey');

    if (isAuthError) {
      return new Response(
        `Gemini API key yo‘q. .env.local ga GEMINI_API_KEY (yoki GOOGLE_API_KEY / API_KEY) qo‘ying. Vertex/service-account kerak emas.`,
        { status: 500 }
      );
    }

    return new Response(message, { status: 500 });
  }
}