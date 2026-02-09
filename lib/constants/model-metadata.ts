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
  aspect_ratios: string[];
  supports_first_frame?: boolean; // Video models only
  supports_last_frame?: boolean; // Video models only
  customParameters?: CustomParameter[]; // Model-specific custom options
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
  name: 'Kling V2.6 Motion Control',
  description: 'Advanced video generation with motion control',
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
      default: 'image',
      description: 'Character orientation setting',
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

// ============================================================================
// ORGANIZED COLLECTIONS
// ============================================================================

/**
 * All image models
 */
export const IMAGE_MODELS_METADATA: ModelMetadata[] = [
  GOOGLE_NANO_BANANA_META,
  NANO_BANANA_PRO_META,
  SEEDREAM_4_5_META,
  GROK_IMAGINE_META,
  GPT_IMAGE_1_5_META,
  FLUX_KONTEXT_FAST_META,
];

/**
 * All video models
 */
export const VIDEO_MODELS_METADATA: ModelMetadata[] = [
  KLING_V2_6_MOTION_META,
  FABRIC_1_0_META,
  VEO_3_1_FAST_META,
  KLING_V2_6_PRO_META,
  HAILUO_2_3_FAST_META,
];

/**
 * All models (image + video)
 */
export const ALL_MODELS_METADATA: ModelMetadata[] = [
  ...IMAGE_MODELS_METADATA,
  ...VIDEO_MODELS_METADATA,
];

/**
 * Models by provider
 */
export const MODELS_BY_PROVIDER: Record<string, ModelMetadata[]> = {
  replicate: [
    GOOGLE_NANO_BANANA_META,
    NANO_BANANA_PRO_META,
    SEEDREAM_4_5_META,
    GPT_IMAGE_1_5_META,
    FLUX_KONTEXT_FAST_META,
    KLING_V2_6_MOTION_META,
    FABRIC_1_0_META,
    VEO_3_1_FAST_META,
    KLING_V2_6_PRO_META,
    HAILUO_2_3_FAST_META,
  ],
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
