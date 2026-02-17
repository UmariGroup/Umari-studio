import { NextRequest, NextResponse } from 'next/server';
import { enhancePrompt } from '@/services/vertex';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const enhancedPrompt = await enhancePrompt(prompt);

    return NextResponse.json({
      enhancedPrompt,
      success: true
    });

  } catch (error) {
    console.error('Enhance prompt error:', error);
    return NextResponse.json(
      { error: 'Failed to enhance prompt' },
      { status: 500 }
    );
  }
}
