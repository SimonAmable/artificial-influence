import { streamText, createGateway, convertToModelMessages, UIMessage } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { CHATBOT_SYSTEM_PROMPT } from '@/lib/constants/system-prompts';

export async function POST(req: Request) {
  try {
    // Check for API key
    if (!process.env.AI_GATEWAY_API_KEY) {
      console.error('[chat] AI_GATEWAY_API_KEY not set');
      return new Response(
        JSON.stringify({ error: 'AI_GATEWAY_API_KEY environment variable is not set' }),
        { status: 500 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[chat] Authentication failed:', authError?.message || 'No user');
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Please log in to use chat.' }),
        { status: 401 }
      );
    }

    // Parse request body
    const { messages }: { messages: UIMessage[] } = await req.json();

    // Create AI Gateway instance
    const gateway = createGateway({
      apiKey: process.env.AI_GATEWAY_API_KEY,
    });

    // Add system prompt to messages
    const systemMessage = {
      role: 'system' as const,
      content: CHATBOT_SYSTEM_PROMPT,
    };

    // Convert messages and prepend system prompt
    const convertedMessages = await convertToModelMessages(messages);
    const messagesWithSystem = [systemMessage, ...convertedMessages];

    // Stream the response using Gemini via AI Gateway
    const result = streamText({
      model: gateway('xai/grok-4.1-fast-reasoning'),
      messages: messagesWithSystem,
      temperature: 0.7,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('[chat] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred during chat processing' 
      }),
      { status: 500 }
    );
  }
}
