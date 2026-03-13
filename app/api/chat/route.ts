import { streamText, createGateway, convertToModelMessages, UIMessage } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { CHATBOT_SYSTEM_PROMPT, PROMPT_RECREATE_SYSTEM_PROMPT } from '@/lib/constants/system-prompts';

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
    const body = await req.json();
    const {
      messages,
      mode = 'chat',
      model = 'google/gemini-3-flash-preview',
    }: { messages: UIMessage[]; mode?: 'chat' | 'prompt-recreate'; model?: string } = body;

    // Create AI Gateway instance
    const gateway = createGateway({
      apiKey: process.env.AI_GATEWAY_API_KEY,
    });

    // Select system prompt based on mode
    const systemPrompt =
      mode === 'prompt-recreate' ? PROMPT_RECREATE_SYSTEM_PROMPT : CHATBOT_SYSTEM_PROMPT;

    // Add system prompt to messages
    const systemMessage = {
      role: 'system' as const,
      content: systemPrompt,
    };

    // Convert messages and prepend system prompt
    const convertedMessages = await convertToModelMessages(messages);
    const messagesWithSystem = [systemMessage, ...convertedMessages];

    // Stream the response using selected model via AI Gateway
    const result = streamText({
      model: gateway(model),
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
