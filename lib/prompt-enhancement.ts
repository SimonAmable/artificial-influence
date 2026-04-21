import { createGateway, generateObject, generateText, zodSchema } from 'ai';
import { z } from 'zod';
import { NANO_BANANA_PRO_ENHANCEMENT_PROMPT } from './constants/system-prompts';
import {
  DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE,
  DEFAULT_GOOGLE_GEMINI_STYLE_PROMPT,
  DEFAULT_GOOGLE_GEMINI_VOICE_ID,
  type AudioProvider,
} from "@/lib/constants/audio"

/** Must match AI Gateway model ids (see @ai-sdk/gateway), not legacy `x-ai/...` strings. */
const PROMPT_ENHANCEMENT_MODEL = 'xai/grok-4.1-fast-non-reasoning' as const;

/** Vision-capable model for JSON / Nano Banana prompt enhancement when reference images are provided. */
const PROMPT_ENHANCEMENT_VISION_MODEL = 'google/gemini-3.1-flash-lite-preview' as const;

/** Cap reference images sent to the enhancer (latency + token limits). */
const MAX_JSON_ENHANCEMENT_REFERENCE_IMAGES = 8;

function enhancementLanguageModel() {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error(
      'AI_GATEWAY_API_KEY is not set; prompt enhancement uses the Vercel AI Gateway (same as /api/generate-text).'
    );
  }
  return createGateway({ apiKey })(PROMPT_ENHANCEMENT_MODEL);
}

function jsonEnhancementVisionLanguageModel() {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error(
      'AI_GATEWAY_API_KEY is not set; prompt enhancement uses the Vercel AI Gateway (same as /api/generate-text).'
    );
  }
  return createGateway({ apiKey })(PROMPT_ENHANCEMENT_VISION_MODEL);
}

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
    model: enhancementLanguageModel(),
    prompt: `${enhancementPrompt}\n\n${prompt}`,
  });

  return text;
}

const AGENT_COMPOSER_INSTRUCTIONS_SYSTEM = `You rewrite user drafts into clearer instructions for a creative AI agent that uses tools (image/video generation, research, etc.).

Rules:
- Output ONLY the improved instruction text. No preamble ("Here is…"), no markdown fences, no bullet meta-commentary about what you changed.
- Make the request more explicit: goals, constraints, deliverables, style, and references—while staying concise. Prefer short paragraphs or tight bullets only when the user already used bullets; otherwise use compact prose.
- Preserve the user's intent, named entities, @ mentions, slash commands, URLs, and attachment references; do not invent new facts or assets.
- If the draft is already precise, tighten wording rather than expanding. Never pad with generic filler.
- Keep total length similar or shorter unless critical details were missing.`

/**
 * Rewrites composer text into explicit, concise agent-facing instructions (no tool execution).
 */
export async function enhanceAgentComposerInstructions(text: string): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) {
    return ''
  }

  const { text: out } = await generateText({
    model: enhancementLanguageModel(),
    system: AGENT_COMPOSER_INSTRUCTIONS_SYSTEM,
    prompt: `Rewrite this draft into stronger agent instructions:\n\n${trimmed}`,
    temperature: 0.45,
  })

  return out.trim()
}

export type EnhancePromptForJSONModelsOptions = {
  /** Public URLs of reference images (e.g. after upload). When non-empty, vision model is used. */
  imageUrls?: string[];
};

/**
 * Enhances a prompt specifically for NanoBanana Pro and Seedream models using JSON structure
 * These models support structured JSON prompts for optimal image generation
 * @param prompt - The user's simple prompt
 * @param modelIdentifier - The model identifier to determine which enhancement to use
 * @param options - Optional reference images for multimodal enhancement (Nano Banana JSON path only)
 * @returns JSON string with structured prompt data
 */
export async function enhancePromptForJSONModels(
  prompt: string,
  modelIdentifier: string,
  options?: EnhancePromptForJSONModelsOptions
): Promise<string> {
  // Check if this model supports JSON prompts
  const jsonSupportedModels = [
    'google/nano-banana',
    'google/nano-banana-pro',
    'google/nano-banana-2',
    'bytedance/seedream-4.5'
  ];

  const supportsJSON = jsonSupportedModels.includes(modelIdentifier);

  if (!supportsJSON) {
    // Fall back to regular enhancement for non-JSON models
    return enhancePrompt(prompt, 'generate');
  }

  const rawUrls = options?.imageUrls?.filter((u) => typeof u === 'string' && u.length > 0) ?? [];
  const cappedUrls = rawUrls.slice(0, MAX_JSON_ENHANCEMENT_REFERENCE_IMAGES);
  if (rawUrls.length > cappedUrls.length) {
    console.warn(
      `[prompt-enhancement] JSON enhancement: using first ${cappedUrls.length} of ${rawUrls.length} reference images`
    );
  }

  if (cappedUrls.length > 0) {
    const { text } = await generateText({
      model: jsonEnhancementVisionLanguageModel(),
      messages: [
        { role: 'system', content: NANO_BANANA_PRO_ENHANCEMENT_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `User prompt:\n${prompt}\n\nReference images are attached in order (first image = primary anchor when the user is vague). Ground your JSON in both the text above and what you see in the images.`,
            },
            ...cappedUrls.map((url) => ({ type: 'image' as const, image: url })),
          ],
        },
      ],
    });
    return text;
  }

  const { text } = await generateText({
    model: enhancementLanguageModel(),
    prompt: `${NANO_BANANA_PRO_ENHANCEMENT_PROMPT}\n\nUser prompt: ${prompt}`,
  });

  return text; // Returns JSON string
}

/**
 * System instructions aligned with Inworld TTS prompting best practices:
 * https://docs.inworld.ai/tts/best-practices/prompting-for-tts
 */
const INWORLD_TTS_SCRIPT_ENHANCEMENT_SYSTEM = `You rewrite plain text into speakable script for Inworld text-to-speech.

Rules (follow closely):
- Output ONLY the rewritten script. No title, quotes around the whole script, markdown, bullet lists, code fences, or emojis.
- Preserve the speaker's meaning; you may rephrase for natural speech and pacing.
- Emphasis: use single asterisks around words that should be stressed, like *this*, never use double asterisks (**), or TTS may read asterisks aloud.
- Tone: use exclamation marks for energy, ellipsis (...) for trailing off or hesitation where appropriate.
- Pacing: use periods between thoughts, commas for short pauses; vary sentence length for rhythm.
- Numbers, dates, times, currency: write in spoken form (e.g. "March fifteenth" not "3/15", "twenty-three" not "23" when it reads better aloud).
- Contractions: prefer natural spoken forms (don't, we're, it's).
- Uncommon proper nouns or technical terms: you may substitute inline IPA using slash notation like /kriːt/ when it clearly helps pronunciation.
- Optional: sparingly use Inworld non-verbal tokens where they fit: [sigh], [laugh], [breathe], [cough], [clear_throat], [yawn] (English; use judiciously).
- Conversational naturalness: light filler (uh, um, well, you know) only when the script is casual; omit for formal or dry content.
- Keep length reasonable: avoid huge bloat; if the input is long, keep the enhanced version similarly scoped unless shortening improves listenability.`

const GOOGLE_GEMINI_TTS_SCRIPT_ENHANCEMENT_SYSTEM = `You prepare text for Google's Gemini 3.1 Flash TTS model.

Return three fields:
- text: the rewritten spoken script
- languageCode: a BCP-47 language code such as en-US, en-GB, es-ES, fr-FR
- stylePrompt: concise delivery instructions for the model

Rules for text:
- Preserve meaning while improving pacing and spoken naturalness.
- Output speakable prose only, not markdown, not bullet lists, not code fences.
- Use Gemini-compatible inline tags only when they clearly help performance, such as [laughing], [whispering], [shouting], [short pause], [medium pause], [long pause], or other plain-language emotion tags.
- Never use Inworld-only tokens such as [breathe], [clear_throat], [cough], [yawn].
- Never use *asterisk emphasis* markup.
- Prefer spoken numbers, dates, times, and currency where that improves delivery.
- Do not over-tag every sentence; use inline tags sparingly.

Rules for stylePrompt:
- Keep it concise, specific, and production-friendly.
- Describe tone, pace, delivery, and speaker framing.
- Refine the user's existing style prompt when one is provided instead of ignoring it.
- Do not repeat the full script.
- Do not mention JSON, formatting rules, or implementation details.

Rules for languageCode:
- Return only a valid BCP-47 code.
- If user text does not imply a specific language, keep the existing language code.
- Prefer region-specific codes when clear from context.`

const GOOGLE_GEMINI_TTS_ENHANCEMENT_SCHEMA = z.object({
  text: z.string().min(1),
  languageCode: z.string().min(2),
  stylePrompt: z.string().min(1),
})

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

/**
 * Rewrites user script for natural Inworld TTS delivery.
 */
export async function enhanceScriptForInworldTts(script: string): Promise<string> {
  const trimmed = script.trim()
  if (!trimmed) {
    return ''
  }

  const { text } = await generateText({
    model: enhancementLanguageModel(),
    system: INWORLD_TTS_SCRIPT_ENHANCEMENT_SYSTEM,
    prompt: `Rewrite this for TTS:\n\n${trimmed}`,
    temperature: 0.65,
  })

  let out = text.trim()
  if (
    (out.startsWith('"') && out.endsWith('"')) ||
    (out.startsWith("'") && out.endsWith("'"))
  ) {
    out = out.slice(1, -1).trim()
  }
  return out
}

export interface EnhanceTtsScriptResult {
  text: string
  languageCode?: string
  stylePrompt?: string
}

export interface EnhanceTtsScriptInput {
  provider: AudioProvider
  script: string
  voiceId?: string | null
  languageCode?: string | null
  stylePrompt?: string | null
}

export async function enhanceScriptForGoogleGeminiTts({
  script,
  voiceId,
  languageCode,
  stylePrompt,
}: Omit<EnhanceTtsScriptInput, "provider">): Promise<EnhanceTtsScriptResult> {
  const trimmed = script.trim()
  if (!trimmed) {
    return {
      text: "",
      stylePrompt:
        stylePrompt?.trim() || DEFAULT_GOOGLE_GEMINI_STYLE_PROMPT,
    }
  }

  const resolvedVoiceId = voiceId?.trim() || DEFAULT_GOOGLE_GEMINI_VOICE_ID
  const resolvedLanguageCode =
    languageCode?.trim() || DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE
  const existingStylePrompt = stylePrompt?.trim() || ""

  const { object } = await generateObject({
    model: enhancementLanguageModel(),
    schema: zodSchema(GOOGLE_GEMINI_TTS_ENHANCEMENT_SCHEMA),
    system: GOOGLE_GEMINI_TTS_SCRIPT_ENHANCEMENT_SYSTEM,
    prompt: `Voice: ${resolvedVoiceId}
Language code: ${resolvedLanguageCode}
Existing style prompt: ${existingStylePrompt || "(none)"}

Rewrite this script for Gemini TTS and produce a concise style prompt:

${trimmed}`,
    temperature: 0.65,
  })

  return {
    text: stripWrappingQuotes(object.text),
    languageCode:
      stripWrappingQuotes(object.languageCode) || resolvedLanguageCode,
    stylePrompt:
      stripWrappingQuotes(object.stylePrompt) ||
      existingStylePrompt ||
      DEFAULT_GOOGLE_GEMINI_STYLE_PROMPT,
  }
}

export async function enhanceScriptForTts({
  provider,
  script,
  voiceId,
  languageCode,
  stylePrompt,
}: EnhanceTtsScriptInput): Promise<EnhanceTtsScriptResult> {
  if (provider === "google") {
    return enhanceScriptForGoogleGeminiTts({
      script,
      voiceId,
      languageCode,
      stylePrompt,
    })
  }

  return {
    text: await enhanceScriptForInworldTts(script),
  }
}
