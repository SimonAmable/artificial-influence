import { generateText } from 'ai';
import { NANO_BANANA_PRO_ENHANCEMENT_PROMPT } from './constants/system-prompts';

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

/**
 * Enhances a prompt specifically for NanoBanana Pro and Seedream models using JSON structure
 * These models support structured JSON prompts for optimal image generation
 * @param prompt - The user's simple prompt
 * @param modelIdentifier - The model identifier to determine which enhancement to use
 * @returns JSON string with structured prompt data
 */
export async function enhancePromptForJSONModels(
  prompt: string,
  modelIdentifier: string
): Promise<string> {
  // Check if this model supports JSON prompts
  const jsonSupportedModels = [
    'google/nano-banana',
    'google/nano-banana-pro',
    'bytedance/seedream-4.5'
  ];

  const supportsJSON = jsonSupportedModels.includes(modelIdentifier);

  if (!supportsJSON) {
    // Fall back to regular enhancement for non-JSON models
    return enhancePrompt(prompt, 'generate');
  }

  // Use the NanoBanana Pro JSON enhancement system
  const { text } = await generateText({
    model: 'x-ai/grok-4.1-fast',
    prompt: `${NANO_BANANA_PRO_ENHANCEMENT_PROMPT}\n\nUser prompt: ${prompt}`,
  });

  return text; // Returns JSON string
}
