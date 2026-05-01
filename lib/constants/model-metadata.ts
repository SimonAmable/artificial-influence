/**
 * Model metadata constants for UI dropdowns and model selection
 * Simplified model info without parameter definitions
 * Based on models table data extracted from Supabase
 */

import type { ModelType } from '../types/models';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Custom parameter definition for model-specific options
 */
export interface CustomParameter {
  name: string;
  label: string;
  options: string[];
  default?: string;
  description?: string;
}

/**
 * Lightweight model metadata for dropdowns and UI selection
 */
export interface ModelMetadata {
  id: string;
  identifier: string;
  name: string;
  description: string;
  type: ModelType;
  provider: string;
  is_active: boolean;
  model_cost: number;
  /** Image models: reference images for style/character. */
  supports_reference_image: boolean;
  /** Video models only: reference video for editing or motion copy. */
  supports_reference_video?: boolean;
  /** Video models only: reference audio (e.g. rhythm, lip-sync hints). */
  supports_reference_audio?: boolean;
  aspect_ratios: string[];
  supports_first_frame?: boolean; // Video models only
  supports_last_frame?: boolean; // Video models only
  customParameters?: CustomParameter[]; // Model-specific custom options
  /** When true, model is deprecated and may be removed later; prefer non-deprecated alternatives. */
  deprecated?: boolean;
}

// ============================================================================
// MODEL METADATA CONSTANTS
// ============================================================================

// Image Models
export const GOOGLE_NANO_BANANA_META: ModelMetadata = {
  id: '06a3c8cb-7f28-4479-8f13-4eb81af42574',
  identifier: 'google/nano-banana',
  name: 'Google Nano Banana',
  description: 'High-quality image generation model by Google',
  type: 'image',
  provider: 'replicate',
  is_active: true,
  model_cost: 2.0,
  supports_reference_image: true,
  supports_reference_video: false,
  aspect_ratios: ['match_input_image', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4'],
  customParameters: [
    {
      name: 'output_format',
      label: 'Output Format',
      options: ['jpg', 'png', 'webp'],
      default: 'png',
      description: 'Image file format',
    },
  ],
};

export const NANO_BANANA_2_META: ModelMetadata = {
  id: 'nano-banana-2-meta',
  identifier: 'google/nano-banana-2',
  name: 'Nano Banana 2',
  description: "Google's latest image generation model (Gemini 3.1 Flash Image). Optimized for speed with Pro-level quality.",
  type: 'image',
  provider: 'replicate',
  is_active: true,
  model_cost: 4.0,
  supports_reference_image: true,
  supports_reference_video: false,
  aspect_ratios: ['match_input_image', '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '1:4', '4:1', '1:8', '8:1'],
  customParameters: [
    {
      name: 'resolution',
      label: 'Resolution',
      options: ['512', '1K', '2K', '4K'],
      default: '1K',
      description: 'Output resolution',
    },
    {
      name: 'output_format',
      label: 'Output Format',
      options: ['jpg', 'png'],
      default: 'jpg',
      description: 'Image file format',
    },
  ],
};

export const NANO_BANANA_PRO_META: ModelMetadata = {
  id: '0a08af2c-bece-4783-84cb-5659b37e518f',
  identifier: 'google/nano-banana-pro',
  name: 'Nano Banana Pro',
  description: "Google's state of the art image generation and editing model",
  type: 'image',
  provider: 'replicate',
  is_active: true,
  model_cost: 4.0,
  supports_reference_image: true,
  supports_reference_video: false,
  aspect_ratios: ['match_input_image', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4'],
  customParameters: [
    {
      name: 'resolution',
      label: 'Resolution',
      options: ['1K', '2K', '4K'],
      default: '2K',
      description: 'Output resolution',
    },
    {
      name: 'output_format',
      label: 'Output Format',
      options: ['jpeg', 'png', 'webp'],
      default: 'png',
      description: 'Image file format',
    },
    {
      name: 'safety_filter_level',
      label: 'Safety Filter',
      options: ['block_only_high', 'block_medium_and_above'],
      default: 'block_only_high',
      description: 'Content filtering level',
    },
  ],};

export const SEEDREAM_4_5_META: ModelMetadata = {
  id: '4cb1b6b0-a99f-4140-9174-80f540363fab',
  identifier: 'bytedance/seedream-4.5',
  name: 'Seedream 4.5',
  description: 'Seedream 4.5: Upgraded Bytedance image model with stronger spatial understanding and world knowledge',
  type: 'image',
  provider: 'replicate',
  is_active: true,
  model_cost: 2.0,
  supports_reference_image: true,
  supports_reference_video: false,
  aspect_ratios: ['match_input_image', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4'],
  customParameters: [
    {
      name: 'size',
      label: 'Size Preset',
      options: ['2K', '4K'],
      default: '2K',
      description: 'Pre-set image resolution',
    },
    {
      name: 'sequential_image_generation',
      label: 'Multi-Image Mode',
      options: ['disabled', 'auto'],
      default: 'disabled',
      description: 'Generate multiple images sequentially',
    },
  ],
};

export const SEEDREAM_5_LITE_META: ModelMetadata = {
  id: 'seedream-5-lite-meta',
  identifier: 'bytedance/seedream-5-lite',
  name: 'Seedream 5.0',
  description:
    'ByteDance image model with reasoning, example-based editing, and up to 3K output',
  type: 'image',
  provider: 'replicate',
  is_active: true,
  model_cost: 2.0,
  supports_reference_image: true,
  supports_reference_video: false,
  aspect_ratios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'],
  customParameters: [
    {
      name: 'size',
      label: 'Size',
      options: ['2K', '3K'],
      default: '2K',
      description: 'Pre-set image resolution',
    },
    {
      name: 'sequential_image_generation',
      label: 'Multi-Image Mode',
      options: ['disabled', 'auto'],
      default: 'disabled',
      description: 'Generate related image sets in one request',
    },
  ],
};

export const Z_IMAGE_TURBO_META: ModelMetadata = {
  id: 'z-image-turbo-meta',
  identifier: 'prunaai/z-image-turbo',
  name: 'Z-Image Turbo',
  description: 'Fast 6B Tongyi-MAI text-to-image, ideal for quick iterations',
  type: 'image',
  provider: 'replicate',
  is_active: true,
  model_cost: 1.0,
  supports_reference_image: false,
  supports_reference_video: false,
  aspect_ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
};

export const GROK_IMAGINE_META: ModelMetadata = {
  id: '53060a45-d751-4e17-9db9-00b412cf3f87',
  identifier: 'xai/grok-imagine-image',
  name: 'Grok Imagine',
  description: 'xAI Grok Imagine image generation model with support for creating images from text prompts',
  type: 'image',
  provider: 'xai',
  is_active: true,
  model_cost: 0.004,
  supports_reference_image: true,
  supports_reference_video: false,
  aspect_ratios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '2:1', '1:2', '19.5:9', '9:19.5', '20:9', '9:20'],
  customParameters: [
    {
      name: 'reference_strength',
      label: 'Reference Image Strength',
      options: ['weak', 'moderate', 'strong'],
      default: 'moderate',
      description: 'How much to follow the reference image (when provided)',
    },
    {
      name: 'detail_level',
      label: 'Detail Level',
      options: ['minimal', 'balanced', 'highly detailed'],
      default: 'balanced',
      description: 'Amount of fine details in the generated image',
    },
  ],
};

export const GPT_IMAGE_1_5_META: ModelMetadata = {
  id: '86759014-7189-4753-92d6-f6e0fd6a7177',
  identifier: 'openai/gpt-image-1.5',
  name: 'GPT Image 1.5',
  description: "OpenAI's latest image generation model with better instruction following and adherence to prompts",
  type: 'image',
  provider: 'replicate',
  is_active: true,
  model_cost: 2.0,
  supports_reference_image: true,
  supports_reference_video: false,
  aspect_ratios: ['1:1',"2:3","3:2"],
};

export const GPT_IMAGE_2_META: ModelMetadata = {
  id: 'f44f56d5-4ad4-4a16-8a8a-0b2ab8e3b482',
  identifier: 'openai/gpt-image-2',
  name: 'GPT Image 2',
  description: 'OpenAI image generation on Fal with one model identifier for both text-to-image and image editing, plus broader aspect ratio support.',
  type: 'image',
  provider: 'fal',
  is_active: true,
  model_cost: 4.0,
  supports_reference_image: true,
  supports_reference_video: false,
  aspect_ratios: ['match_input_image', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '2:1', '1:2', '19.5:9', '9:19.5', '20:9', '9:20', '21:9'],
  customParameters: [
    {
      name: 'quality',
      label: 'Quality',
      options: ['low', 'medium', 'high'],
      default: 'high',
      description: 'Fal quality preset for GPT Image 2.',
    },
    {
      name: 'output_format',
      label: 'Output Format',
      options: ['png', 'jpeg', 'webp'],
      default: 'png',
      description: 'Image file format',
    },
  ],
};

export const WAN_27_IMAGE_META: ModelMetadata = {
  id: 'wan-2.7-image-meta',
  identifier: 'fal-ai/wan/v2.7',
  name: 'Wan 2.7 Image',
  description: 'WAN 2.7 on fal for text-to-image and text-guided image editing under one selector item.',
  type: 'image',
  provider: 'fal',
  is_active: true,
  model_cost: 4.0,
  supports_reference_image: true,
  supports_reference_video: false,
  aspect_ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
  customParameters: [
    {
      name: 'image_size',
      label: 'Image Size',
      options: ['square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9'],
      default: 'square_hd',
      description: 'Fal image size preset',
    },
    {
      name: 'enable_safety_checker',
      label: 'Safety Checker',
      options: ['false', 'true'],
      default: 'false',
      description: 'Content moderation toggle',
    },
  ],
};

export const WAN_27_PRO_IMAGE_META: ModelMetadata = {
  id: 'wan-2.7-pro-image-meta',
  identifier: 'fal-ai/wan/v2.7/pro',
  name: 'Wan 2.7 Pro Image',
  description: 'WAN 2.7 Pro on fal for text-to-image and text-guided image editing under one selector item.',
  type: 'image',
  provider: 'fal',
  is_active: true,
  model_cost: 10.0,
  supports_reference_image: true,
  supports_reference_video: false,
  aspect_ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
  customParameters: [
    {
      name: 'image_size',
      label: 'Image Size',
      options: ['square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9'],
      default: 'square_hd',
      description: 'Fal image size preset',
    },
    {
      name: 'enable_prompt_expansion',
      label: 'Prompt Expansion',
      options: ['true', 'false'],
      default: 'true',
      description: 'Expand brief edit prompts before generation',
    },
  ],
};

export const FLUX_KONTEXT_FAST_META: ModelMetadata = {
  id: 'b3a0e0b8-ae8f-4f0b-b692-150ecabefd19',
  identifier: 'prunaai/flux-kontext-fast',
  name: 'Flux Kontext Fast',
  description: 'Ultra fast flux kontext endpoint for image generation',
  type: 'image',
  provider: 'replicate',
  is_active: false,
  model_cost: 2.0,
  supports_reference_image: true,
  supports_reference_video: false,
  aspect_ratios: ['match_input_image', '1:1', '16:9', '9:16', '4:3', '3:4'],  customParameters: [
    {
      name: 'speed_mode',
      label: 'Speed Mode',
      options: ['Juiced 🔥', 'Fast', 'Standard'],
      default: 'Juiced 🔥',
      description: 'Speed vs quality optimization',
    },
    {
      name: 'output_format',
      label: 'Output Format',
      options: ['jpg', 'png', 'webp'],
      default: 'jpg',
      description: 'Image file format',
    },
  ],};

// Video Models
export const KLING_V2_6_MOTION_META: ModelMetadata = {
  id: '42254e43-5838-4ab2-bc2f-507da3e3a95b',
  identifier: 'kwaivgi/kling-v2.6-motion-control',
  name: 'Kling V2.6 Motion Control (deprecated)',
  description: 'Advanced video generation with motion control. Prefer Kling 3.0 Motion Control.',
  type: 'video',
  provider: 'replicate',
  is_active: true,
  model_cost: 10.0,
  supports_reference_image: true,
  supports_reference_video: true,
  aspect_ratios: ['16:9', '9:16', '1:1'],
  supports_first_frame: true,
  deprecated: true,
  customParameters: [
    {
      name: 'mode',
      label: 'Model Mode',
      options: ['pro', 'std'],
      default: 'pro',
      description: 'Model variant - Pro for high quality, Std for faster generation',
    },
    {
      name: 'keep_original_sound',
      label: 'Keep Original Audio',
      options: ['true', 'false'],
      default: 'true',
      description: 'Preserve audio from reference video',
    },
    {
      name: 'character_orientation',
      label: 'Character Orientation',
      options: ['image', 'video'],
      default: 'video',
      description: 'Character orientation setting',
    },
  ],
};

export const KLING_V3_MOTION_META: ModelMetadata = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  identifier: 'kwaivgi/kling-v3-motion-control',
  name: 'Kling 3.0 Motion Control',
  description: 'Transfer character motion from a reference video to any image. Improved consistency, 720p/1080p.',
  type: 'video',
  provider: 'replicate',
  is_active: true,
  model_cost: 10.0,
  supports_reference_image: true,
  supports_reference_video: true,
  aspect_ratios: ['16:9', '9:16', '1:1'],
  supports_first_frame: true,
  customParameters: [
    {
      name: 'mode',
      label: 'Model Mode',
      options: ['pro', 'std'],
      default: 'pro',
      description: 'Pro = 1080p, Std = 720p',
    },
    {
      name: 'keep_original_sound',
      label: 'Keep Original Audio',
      options: ['true', 'false'],
      default: 'true',
      description: 'Preserve audio from reference video',
    },
    {
      name: 'character_orientation',
      label: 'Character Orientation',
      options: ['image', 'video'],
      default: 'video',
      description: 'image = same as picture (max 10s), video = match reference (max 30s)',
    },
  ],
};

export const FABRIC_1_0_META: ModelMetadata = {
  id: '77179d72-fd29-4949-b5fc-ff18186fb0fc',
  identifier: 'veed/fabric-1.0',
  name: 'Veed Fabric 1.0',
  description: 'Lip sync video generation model',
  type: 'video',
  provider: 'replicate',
  is_active: true,
  model_cost: 2.0,
  supports_reference_image: false,
  supports_reference_video: false,
  aspect_ratios: ['16:9', '9:16', '1:1'],
  customParameters: [
    {
      name: 'resolution',
      label: 'Resolution',
      options: ['720p', '480p'],
      default: '720p',
      description: 'Output video resolution',
    },
  ],
};

export const VEO_3_1_FAST_META: ModelMetadata = {
  id: '7ca74c15-83a6-4cbb-b42a-0d93ad7fd8d9',
  identifier: 'google/veo-3.1-fast',
  name: 'Veo 3.1 Fast',
  description: 'New and improved version of Veo 3 Fast, with higher-fidelity video, context-aware audio and last frame support',
  type: 'video',
  provider: 'replicate',
  is_active: true,
  model_cost: 0.012,
  supports_reference_image: false,
  supports_reference_video: false,
  aspect_ratios: ['16:9', '9:16', '1:1'],
  supports_first_frame: true,
  supports_last_frame: true,
  customParameters: [
    {
      name: 'resolution',
      label: 'Video Resolution',
      options: ['720p', '1080p'],
      default: '1080p',
      description: 'Output video resolution',
    },
    {
      name: 'aspect_ratio',
      label: 'Aspect Ratio',
      options: ['16:9', '9:16', '1:1'],
      default: '16:9',
      description: 'Video aspect ratio',
    },
    {
      name: 'generate_audio',
      label: 'Generate Audio',
      options: ['true', 'false'],
      default: 'true',
      description: 'Generate audio with the video',
    },
  ],
};

export const KLING_V2_6_PRO_META: ModelMetadata = {
  id: '8809dd2e-fff0-4652-9c3f-4a520e3ca79b',
  identifier: 'kwaivgi/kling-v2.6',
  name: 'Kling V2.6 Pro',
  description: 'Kling 2.6 Pro: Top-tier image-to-video with cinematic visuals, fluid motion, and native audio generation',
  type: 'video',
  provider: 'replicate',
  is_active: true,
  model_cost: 0.015,
  supports_reference_image: false,
  supports_reference_video: false,
  aspect_ratios: ['16:9', '9:16', '1:1'],
  supports_first_frame: true,
  customParameters: [
    {
      name: 'aspect_ratio',
      label: 'Aspect Ratio',
      options: ['16:9', '9:16', '1:1'],
      default: '16:9',
      description: 'Aspect ratio of the video (ignored if start image is provided)',
    },
    {
      name: 'duration',
      label: 'Duration',
      options: ['5', '10'],
      default: '5',
      description: 'Duration of the video in seconds',
    },
    {
      name: 'generate_audio',
      label: 'Generate Audio',
      options: ['true', 'false'],
      default: 'true',
      description: 'Generate audio for the video',
    },
  ],
};

export const HAILUO_2_3_FAST_META: ModelMetadata = {
  id: 'a0b7f5c1-8c04-4f74-a0b1-b3bd15a57c7a',
  identifier: 'minimax/hailuo-2.3-fast',
  name: 'Hailuo 2.3 Fast',
  description: 'A lower-latency image-to-video version of Hailuo 2.3 that preserves core motion quality, visual consistency, and stylization performance while enabling faster iteration cycles.',
  type: 'video',
  provider: 'replicate',
  is_active: true,
  model_cost: 0.008,
  supports_reference_image: false,
  supports_reference_video: false,
  aspect_ratios: ['16:9', '9:16', '1:1'],
  supports_first_frame: true,
  customParameters: [
    {
      name: 'resolution',
      label: 'Resolution',
      options: ['768p', '1080p'],
      default: '768p',
      description: 'Output video resolution (1080p limited to 6 seconds)',
    },
    {
      name: 'prompt_optimizer',
      label: 'Prompt Optimizer',
      options: ['true', 'false'],
      default: 'true',
      description: 'Enhance prompt for better results',
    },
  ],
};

export const SEEDANCE_2_0_META: ModelMetadata = {
  id: 'seedance-2.0-meta',
  identifier: 'bytedance/seedance-2.0',
  name: 'Seedance 2.0',
  description:
    'ByteDance multimodal video with native synced audio: text-to-video, first/last frame, reference images and clips, reference audio, editing and extension.',
  type: 'video',
  provider: 'replicate',
  is_active: true,
  model_cost: 20,
  supports_reference_image: true,
  supports_reference_video: true,
  supports_reference_audio: true,
  aspect_ratios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'],
  supports_first_frame: true,
  supports_last_frame: true,
  customParameters: [
    {
      name: 'resolution',
      label: 'Resolution',
      options: ['480p', '720p'],
      default: '720p',
      description: 'Output resolution',
    },
    {
      name: 'generate_audio',
      label: 'Generate Audio',
      options: ['true', 'false'],
      default: 'true',
      description: 'Synchronized dialogue, SFX, and music',
    },
  ],
};

export const HAPPY_HORSE_META: ModelMetadata = {
  id: 'happy-horse-meta',
  identifier: 'alibaba/happy-horse',
  name: 'Happy Horse',
  description:
    'Alibaba Happy Horse on fal: text-to-video, image-to-video, or reference-to-video under one model selector.',
  type: 'video',
  provider: 'fal',
  is_active: true,
  model_cost: 20,
  supports_reference_image: true,
  supports_reference_video: false,
  aspect_ratios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
  supports_first_frame: true,
  customParameters: [
    {
      name: 'resolution',
      label: 'Resolution',
      options: ['720p', '1080p'],
      default: '1080p',
      description: 'Output video resolution tier',
    },
    {
      name: 'aspect_ratio',
      label: 'Aspect Ratio',
      options: ['16:9', '9:16', '1:1', '4:3', '3:4'],
      default: '16:9',
      description: 'Used for text-to-video and reference-to-video',
    },
  ],
};

export const GOOGLE_GEMINI_3_1_FLASH_TTS_META: ModelMetadata = {
  id: 'google-gemini-3.1-flash-tts-meta',
  identifier: 'google/gemini-3.1-flash-tts',
  name: 'Gemini 3.1 Flash TTS',
  description:
    "Google's expressive text-to-speech model with style prompting and inline delivery tags",
  type: 'audio',
  provider: 'replicate',
  is_active: true,
  model_cost: 0.001,
  supports_reference_image: false,
  supports_reference_video: false,
  aspect_ratios: [],
  customParameters: [
    {
      name: 'voice',
      label: 'Voice',
      options: ['Kore'],
      default: 'Kore',
      description: 'Gemini voice preset',
    },
    {
      name: 'language_code',
      label: 'Language Code',
      options: ['en-US'],
      default: 'en-US',
      description: 'BCP-47 language code',
    },
  ],
};

// ============================================================================
// ORGANIZED COLLECTIONS
// ============================================================================

/**
 * All image models
 */
export const IMAGE_MODELS_METADATA: ModelMetadata[] = [
  GOOGLE_NANO_BANANA_META,
  NANO_BANANA_PRO_META,
  NANO_BANANA_2_META,
  SEEDREAM_4_5_META,
  SEEDREAM_5_LITE_META,
  GROK_IMAGINE_META,
  GPT_IMAGE_1_5_META,
  GPT_IMAGE_2_META,
  WAN_27_IMAGE_META,
  WAN_27_PRO_IMAGE_META,
  Z_IMAGE_TURBO_META,
  FLUX_KONTEXT_FAST_META,
];

/**
 * All video models
 */
export const VIDEO_MODELS_METADATA: ModelMetadata[] = [
  KLING_V2_6_MOTION_META,
  KLING_V3_MOTION_META,
  FABRIC_1_0_META,
  VEO_3_1_FAST_META,
  KLING_V2_6_PRO_META,
  HAILUO_2_3_FAST_META,
  SEEDANCE_2_0_META,
  HAPPY_HORSE_META,
];

export const AUDIO_MODELS_METADATA: ModelMetadata[] = [
  GOOGLE_GEMINI_3_1_FLASH_TTS_META,
];

/**
 * Motion control models (reference video + character image → motion transfer).
 * Excludes other reference-video models (e.g. Grok). Use for motion-copy page and defaults.
 */
export const MOTION_CONTROL_MODELS_METADATA: ModelMetadata[] = VIDEO_MODELS_METADATA.filter(
  (m) => m.supports_reference_video && m.identifier.includes('motion-control')
);

/** Default motion control model identifier (first non-deprecated, or first in list). */
export const DEFAULT_MOTION_CONTROL_MODEL_IDENTIFIER: string =
  MOTION_CONTROL_MODELS_METADATA.find((m) => !m.deprecated)?.identifier ??
  MOTION_CONTROL_MODELS_METADATA[0]?.identifier ??
  'kwaivgi/kling-v3-motion-control';

/**
 * All models (image + video)
 */
export const ALL_MODELS_METADATA: ModelMetadata[] = [
  ...IMAGE_MODELS_METADATA,
  ...VIDEO_MODELS_METADATA,
  ...AUDIO_MODELS_METADATA,
];

/**
 * Models by provider
 */
export const MODELS_BY_PROVIDER: Record<string, ModelMetadata[]> = {
  replicate: [
    GOOGLE_NANO_BANANA_META,
    NANO_BANANA_PRO_META,
    NANO_BANANA_2_META,
    SEEDREAM_4_5_META,
    SEEDREAM_5_LITE_META,
    GPT_IMAGE_1_5_META,
    GPT_IMAGE_2_META,
    Z_IMAGE_TURBO_META,
    FLUX_KONTEXT_FAST_META,
    KLING_V2_6_MOTION_META,
    KLING_V3_MOTION_META,
    FABRIC_1_0_META,
    VEO_3_1_FAST_META,
    KLING_V2_6_PRO_META,
    HAILUO_2_3_FAST_META,
    SEEDANCE_2_0_META,
    GOOGLE_GEMINI_3_1_FLASH_TTS_META,
  ],
  fal: [WAN_27_IMAGE_META, WAN_27_PRO_IMAGE_META, HAPPY_HORSE_META],
  xai: [GROK_IMAGINE_META],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get active models, optionally filtered by type
 */
export function getActiveModelMetadata(type?: ModelType): ModelMetadata[] {
  let models = ALL_MODELS_METADATA.filter((model) => model.is_active);
  
  if (type) {
    models = models.filter((model) => model.type === type);
  }
  
  return models;
}

/**
 * Get model metadata by identifier
 */
export function getModelMetadataByIdentifier(
  identifier: string
): ModelMetadata | undefined {
  return ALL_MODELS_METADATA.find((model) => model.identifier === identifier);
}

/**
 * Get models by provider
 */
export function getModelMetadataByProvider(provider: string): ModelMetadata[] {
  return ALL_MODELS_METADATA.filter((model) => model.provider === provider);
}

/**
 * Get models by type
 */
export function getModelMetadataByType(type: ModelType): ModelMetadata[] {
  return ALL_MODELS_METADATA.filter((model) => model.type === type);
}

/**
 * Get models that support reference images
 */
export function getReferenceImageSupportedModels(type?: ModelType): ModelMetadata[] {
  let models = ALL_MODELS_METADATA.filter(
    (model) => model.supports_reference_image
  );
  
  if (type) {
    models = models.filter((model) => model.type === type);
  }
  
  return models;
}

/**
 * Get models that support reference video
 */
export function getReferenceVideoSupportedModels(type?: ModelType): ModelMetadata[] {
  let models = ALL_MODELS_METADATA.filter(
    (model) => model.supports_reference_video
  );
  
  if (type) {
    models = models.filter((model) => model.type === type);
  }
  
  return models;
}

/** @deprecated Use getReferenceImageSupportedModels or getReferenceVideoSupportedModels */
export function getReferenceSupportedModels(type?: ModelType): ModelMetadata[] {
  return getReferenceImageSupportedModels(type);
}

/**
 * Check if a model is active by identifier
 */
export function isModelMetadataActive(identifier: string): boolean {
  const model = getModelMetadataByIdentifier(identifier);
  return model?.is_active ?? false;
}

/**
 * Get the cost of a model by identifier
 */
export function getModelMetadataCost(identifier: string): number {
  const model = getModelMetadataByIdentifier(identifier);
  return model?.model_cost ?? 0;
}

/**
 * Group models by provider (returns object with provider keys)
 */
export function groupModelsByProvider(): Record<string, ModelMetadata[]> {
  return MODELS_BY_PROVIDER;
}

/**
 * Get unique providers from all models
 */
export function getUniqueProviders(): string[] {
  return Array.from(new Set(ALL_MODELS_METADATA.map((model) => model.provider)));
}
