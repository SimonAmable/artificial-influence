import { generateText, createGateway } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { TEXT_GENERATION_SYSTEM_PROMPT } from '@/lib/constants/system-prompts';
import { enhancePrompt } from '@/lib/prompt-enhancement';

export async function POST(req: Request) {
  try {
    // Check for API key
    if (!process.env.AI_GATEWAY_API_KEY) {
      console.error('[generate-text] AI_GATEWAY_API_KEY not set');
      return NextResponse.json(
        { error: 'AI_GATEWAY_API_KEY environment variable is not set' },
        { status: 500 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[generate-text] Authentication failed:', authError?.message || 'No user');
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to use text generation.' },
        { status: 401 }
      );
    }

    // Parse request body
    const { prompt, currentText, images, enhancePrompt: shouldEnhancePrompt }: { 
      prompt: string; 
      currentText?: string;
      images?: Array<{ url: string; mediaType?: string }>;
      enhancePrompt?: boolean;
    } = await req.json();

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Optionally enhance prompt for fresh content (not edits)
    let processedPrompt = prompt;
    if (shouldEnhancePrompt && !currentText) {
      console.log('[generate-text] Enhancing prompt...');
      processedPrompt = await enhancePrompt(prompt, 'generate');
      console.log('[generate-text] Enhanced prompt:', processedPrompt.substring(0, 100) + '...');
    }

    // Create AI Gateway instance
    const gateway = createGateway({
      apiKey: process.env.AI_GATEWAY_API_KEY,
    });

    // Build user message with context
    const userContent: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> = [];
    
    // Add text content with editing context if applicable
    if (currentText) {
      userContent.push({
        type: 'text' as const,
        text: `CURRENT TEXT TO EDIT:\n${currentText}\n\nEDITING REQUEST: ${processedPrompt}\n\nProvide the complete updated text.`
      });
    } else {
      userContent.push({
        type: 'text' as const,
        text: processedPrompt
      });
    }

    // Add images if provided
    if (images && images.length > 0) {
      images.forEach(img => {
        userContent.push({
          type: 'image' as const,
          image: img.url,
        });
      });
    }

    // Generate the response using Gemini via AI Gateway
    const result = await generateText({
      model: gateway('google/gemini-2.5-flash'),
      messages: [
        {
          role: 'system',
          content: TEXT_GENERATION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userContent,
        }
      ],
      temperature: 0.7,
    });

    console.log('[generate-text] Generated:', result.text.substring(0, 100) + '...');

    return NextResponse.json({ text: result.text });
  } catch (error) {
    console.error('[generate-text] Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'An error occurred during text generation' 
      },
      { status: 500 }
    );
  }
}
