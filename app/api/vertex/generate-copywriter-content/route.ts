import { NextRequest } from 'next/server';
import { generateCopywriterContent } from '../../../../services/gemini';

export async function POST(request: NextRequest) {
  try {
    const { contentType, topic, tone, length, keywords } = await request.json();

    if (!topic) {
      return new Response('Topic is required', { status: 400 });
    }

    const result = await generateCopywriterContent(
      contentType,
      topic,
      tone,
      length,
      keywords
    );

    return new Response(result, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('Copywriter content error:', error);
    return new Response('Failed to generate content', { status: 500 });
  }
}