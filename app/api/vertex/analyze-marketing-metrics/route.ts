import { NextRequest } from 'next/server';
import { analyzeMarketingMetrics } from '@/services/vertex';

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
    const message = error instanceof Error ? error.message : 'Failed to analyze metrics';
    console.error('Marketing metrics error:', message);

    const isAuthError =
      message.toLowerCase().includes('vertex') ||
      message.toLowerCase().includes('credentials') ||
      message.toLowerCase().includes('service account');

    if (isAuthError) {
      return new Response(
        "Vertex konfiguratsiyasi yo'q. .env faylga VERTEX_PROJECT_ID va GOOGLE_APPLICATION_CREDENTIALS (yoki GOOGLE_APPLICATION_CREDENTIALS_JSON) ni qo'ying.",
        { status: 500 }
      );
    }

    return new Response(message, { status: 500 });
  }
}
