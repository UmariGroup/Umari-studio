import { NextRequest } from 'next/server';
import { chat } from '../../../../services/gemini';

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
    return new Response('Failed to process chat', { status: 500 });
  }
}