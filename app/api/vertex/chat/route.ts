import { NextRequest } from 'next/server';
import { chat } from '@/services/vertex';

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    if (!message) {
      return new Response('Message is required', { status: 400 });
    }

    const result = await chat(message, history || []);

    return new Response(result, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('Chat error:', error);
    const message = error instanceof Error ? error.message : String(error);
    const isRateLimited =
      message.includes('Vertex AI error (429') ||
      message.includes('RESOURCE_EXHAUSTED') ||
      message.toLowerCase().includes('too many requests');

    if (isRateLimited) {
      return new Response(
        "So'rovlar juda ko'p (Vertex quota). Avto region fallback ishlatiladi, lekin hozircha band. 20-60 soniya kutib qayta urinib ko'ring.",
        {
          status: 429,
          headers: {
            'Retry-After': '25',
          },
        }
      );
    }

    return new Response('Failed to process chat', { status: 500 });
  }
}
