import { generateText } from 'ai';

// Prompt constants for different use cases
const PROMPT_ENHANCEMENT_PROMPTS = {
  edit: 'Optimize this prompt for editing tasks. Make it short, clear, specific, and actionable:',
  generate: 'Optimize this prompt for generation tasks. Make it detailed, descriptive, and comprehensive:',
} as const;

type UseCase = keyof typeof PROMPT_ENHANCEMENT_PROMPTS;

/**
 * Enhances a prompt using AI based on the specified use case
 * @param prompt - The prompt to enhance
 * @param useCase - The use case ('edit' or 'generate')
 * @returns The enhanced/optimized prompt
 */
export async function enhancePrompt(
  prompt: string,
  useCase: UseCase = 'generate'
): Promise<string> {
  const enhancementPrompt = PROMPT_ENHANCEMENT_PROMPTS[useCase];
  
  const { text } = await generateText({
    model: 'x-ai/grok-4.1-fast',
    prompt: `${enhancementPrompt}\n\n${prompt}`,
  });

  return text;
}
