import { NextRequest } from 'next/server';
import { generateVideoScript } from '../../../../services/gemini';

export async function POST(request: NextRequest) {
  try {
    const { topic, platform, duration, tone } = await request.json();

    if (!topic) {
      return new Response('Topic is required', { status: 400 });
    }

    const result = await generateVideoScript(topic, platform, duration, tone);

    return new Response(result, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('Video script error:', error);
    return new Response('Failed to generate video script', { status: 500 });
  }
}