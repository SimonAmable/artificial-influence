/**
 * Hard-coded model constants extracted from supabase-models-setup.sql
 * These define all available image, video, and audio generation models
 */

import type {
  ModelType,
  Model,
  ParameterDefinition,
} from '../types/models';

// ============================================================================
// MODEL IDENTIFIERS
// ============================================================================

export const MODEL_IDENTIFIERS = {
  // Image Models
  GOOGLE_NANO_BANANA: 'google/nano-banana',
  GOOGLE_NANO_BANANA_PRO: 'google/nano-banana-pro',
  OPENAI_GPT_IMAGE_1_5: 'openai/gpt-image-1.5',
  BYTEDANCE_SEEDREAM_4_5: 'bytedance/seedream-4.5',
  PRUNAAI_FLUX_KONTEXT_FAST: 'prunaai/flux-kontext-fast',
  XAI_GROK_IMAGINE: 'xai/grok-imagine-image',
  
  // Video Models
  KWAIVGI_KLING_V2_6: 'kwaivgi/kling-v2.6-motion-control',
  KWAIVGI_KLING_V2_6_PRO: 'kwaivgi/kling-v2.6',
  KWAIVGI_KLING_V3_VIDEO: 'kwaivgi/kling-v3-video',
  KWAIVGI_KLING_V3_OMNI_VIDEO: 'kwaivgi/kling-v3-omni-video',
  VEED_FABRIC_1_0: 'veed/fabric-1.0',
  MINIMAX_HAILUO_2_3_FAST: 'minimax/hailuo-2.3-fast',
  GOOGLE_VEO_3_1_FAST: 'google/veo-3.1-fast',
} as const;

// ============================================================================
// PARAMETER DEFINITIONS
// ============================================================================

// Google Nano Banana parameters
const GOOGLE_NANO_BANANA_PARAMS: ParameterDefinition[] = [
  {
    name: 'aspect_ratio',
    type: 'string',
    label: 'Aspect Ratio',
    description: 'Aspect ratio of the generated image',
    required: false,
    default: 'match_input_image',
    enum: ['match_input_image', '1:1', '16:9', '9:16', '4:3', '3:4'],
    ui_type: 'select',
  },
  {
    name: 'aspectRatio',
    type: 'string',
    label: 'Aspect Ratio (AI SDK)',
    description: 'Aspect ratio in format width:height',
    required: false,
    default: null,
    pattern: '^\\d+:\\d+$',
    ui_type: 'text',
  },
  {
    name: 'resolution',
    type: 'string',
    label: 'Resolution',
    description: 'Output resolution in format WIDTHxHEIGHT',
    required: false,
    default: '1024x1024',
    pattern: '^\\d+x\\d+$',
    ui_type: 'text',
  },
  {
    name: 'output_format',
    type: 'string',
    label: 'Output Format',
    description: 'Image output format',
    required: false,
    default: 'png',
    enum: ['jpg', 'png', 'webp'],
    ui_type: 'select',
  },
  {
    name: 'n',
    type: 'number',
    label: 'Number of Images',
    description: 'Number of images to generate',
    required: false,
    default: 1,
    min: 1,
    max: 4,
    ui_type: 'number',
  },
  {
    name: 'seed',
    type: 'number',
    label: 'Seed',
    description: 'Random seed for reproducibility',
    required: false,
    default: null,
    min: 0,
    max: 2147483647,
    ui_type: 'number',
  },
];

// Kling V2.6 Motion Control parameters
const KLING_V2_6_PARAMS: ParameterDefinition[] = [
  {
    name: 'mode',
    type: 'string',
    label: 'Mode',
    description: 'Model variant',
    required: false,
    default: 'pro',
    enum: ['pro', 'std'],
    ui_type: 'select',
  },
  {
    name: 'keep_original_sound',
    type: 'boolean',
    label: 'Keep Original Sound',
    description: 'Preserve original audio from reference video',
    required: false,
    default: true,
    ui_type: 'switch',
  },
  {
    name: 'character_orientation',
    type: 'string',
    label: 'Character Orientation',
    description: 'Character orientation setting',
    required: false,
    default: 'image',
    enum: ['image', 'video'],
    ui_type: 'select',
  },
];

// Veed Fabric 1.0 parameters
const FABRIC_1_0_PARAMS: ParameterDefinition[] = [
  {
    name: 'resolution',
    type: 'string',
    label: 'Resolution',
    description: 'Output video resolution',
    required: false,
    default: '720p',
    enum: ['720p', '480p'],
    ui_type: 'select',
  },
];

// Minimax Hailuo 2.3 Fast parameters
const HAILUO_2_3_FAST_PARAMS: ParameterDefinition[] = [
  {
    name: 'duration',
    type: 'number',
    label: 'Duration',
    description: 'Duration of the video in seconds. 10 seconds is only available for 768p resolution.',
    required: false,
    default: 6,
    min: 5,
    max: 10,
    ui_type: 'number',
  },
  {
    name: 'resolution',
    type: 'string',
    label: 'Resolution',
    description: 'Pick between 768p or 1080p resolution. 1080p supports only 6-second duration.',
    required: false,
    default: '768p',
    enum: ['768p', '1080p'],
    ui_type: 'select',
  },
  {
    name: 'prompt_optimizer',
    type: 'boolean',
    label: 'Prompt Optimizer',
    description: 'Use prompt optimizer',
    required: false,
    default: true,
    ui_type: 'switch',
  },
  {
    name: 'first_frame_image',
    type: 'string',
    label: 'First Frame Image',
    description: 'First frame image for video generation. The output video will have the same aspect ratio as this image.',
    required: false,
    default: null,
    ui_type: 'text',
  },
];

// Google Veo 3.1 Fast parameters
const VEO_3_1_FAST_PARAMS: ParameterDefinition[] = [
  {
    name: 'seed',
    type: 'number',
    label: 'Seed',
    description: 'Random seed. Omit for random generations',
    required: false,
    default: null,
    min: 0,
    max: 2147483647,
    ui_type: 'number',
  },
  {
    name: 'image',
    type: 'string',
    label: 'Input Image',
    description: 'Input image to start generating from. Ideal images are 16:9 or 9:16 and 1280x720 or 720x1280, depending on the aspect ratio you choose.',
    required: false,
    default: null,
    ui_type: 'text',
  },
  {
    name: 'duration',
    type: 'number',
    label: 'Duration',
    description: 'Video duration in seconds',
    required: false,
    default: 8,
    min: 2,
    max: 10,
    ui_type: 'number',
  },
  {
    name: 'last_frame',
    type: 'string',
    label: 'Last Frame',
    description: 'Ending image for interpolation. When provided with an input image, creates a transition between the two images.',
    required: false,
    default: null,
    ui_type: 'text',
  },
  {
    name: 'resolution',
    type: 'string',
    label: 'Resolution',
    description: 'Resolution of the generated video',
    required: false,
    default: '1080p',
    enum: ['720p', '1080p'],
    ui_type: 'select',
  },
  {
    name: 'aspect_ratio',
    type: 'string',
    label: 'Aspect Ratio',
    description: 'Video aspect ratio',
    required: false,
    default: '16:9',
    enum: ['16:9', '9:16', '1:1'],
    ui_type: 'select',
  },
  {
    name: 'generate_audio',
    type: 'boolean',
    label: 'Generate Audio',
    description: 'Generate audio with the video',
    required: false,
    default: true,
    ui_type: 'switch',
  },
  {
    name: 'negative_prompt',
    type: 'string',
    label: 'Negative Prompt',
    description: 'Description of what to exclude from the generated video',
    required: false,
    default: null,
    ui_type: 'textarea',
  },
];

// Kling V3 Video parameters (kwaivgi/kling-v3-video)
const KLING_V3_VIDEO_PARAMS: ParameterDefinition[] = [
  {
    name: 'mode',
    type: 'string',
    label: 'Mode',
    description: 'standard = 720p, pro = 1080p',
    required: false,
    default: 'pro',
    enum: ['standard', 'pro'],
    ui_type: 'select',
  },
  {
    name: 'duration',
    type: 'number',
    label: 'Duration',
    description: 'Video duration in seconds (3–15)',
    required: false,
    default: 5,
    min: 3,
    max: 15,
    ui_type: 'number',
  },
  {
    name: 'aspect_ratio',
    type: 'string',
    label: 'Aspect Ratio',
    description: 'Ignored when start image is provided',
    required: false,
    default: '16:9',
    enum: ['16:9', '9:16', '1:1'],
    ui_type: 'select',
  },
  {
    name: 'generate_audio',
    type: 'boolean',
    label: 'Generate Audio',
    description: 'Generate native audio including lip sync',
    required: false,
    default: true,
    ui_type: 'switch',
  },
  {
    name: 'negative_prompt',
    type: 'string',
    label: 'Negative Prompt',
    description: 'What to exclude from the video',
    required: false,
    default: null,
    ui_type: 'textarea',
  },
  {
    name: 'multi_prompt',
    type: 'string',
    label: 'Multi-shot (JSON)',
    description: 'JSON array of shots: [{"prompt": "...", "duration": N}]',
    required: false,
    default: null,
    ui_type: 'textarea',
  },
];

// Kling V3 Omni Video parameters (kwaivgi/kling-v3-omni-video)
const KLING_V3_OMNI_VIDEO_PARAMS: ParameterDefinition[] = [
  {
    name: 'mode',
    type: 'string',
    label: 'Mode',
    description: 'standard = 720p, pro = 1080p',
    required: false,
    default: 'pro',
    enum: ['standard', 'pro'],
    ui_type: 'select',
  },
  {
    name: 'duration',
    type: 'number',
    label: 'Duration',
    description: 'Video duration in seconds (3–15). Ignored when editing with reference video.',
    required: false,
    default: 5,
    min: 3,
    max: 15,
    ui_type: 'number',
  },
  {
    name: 'aspect_ratio',
    type: 'string',
    label: 'Aspect Ratio',
    description: '16:9, 9:16, or 1:1',
    required: false,
    default: '16:9',
    enum: ['16:9', '9:16', '1:1'],
    ui_type: 'select',
  },
  {
    name: 'video_reference_type',
    type: 'string',
    label: 'Reference Video Type',
    description: 'base = edit this video; feature = use style/camera for new content',
    required: false,
    default: 'feature',
    enum: ['feature', 'base'],
    ui_type: 'select',
  },
  {
    name: 'generate_audio',
    type: 'boolean',
    label: 'Generate Audio',
    description: 'Native audio (cannot use with reference video)',
    required: false,
    default: true,
    ui_type: 'switch',
  },
  {
    name: 'keep_original_sound',
    type: 'boolean',
    label: 'Keep Original Sound',
    description: 'Keep audio from reference video when editing',
    required: false,
    default: false,
    ui_type: 'switch',
  },
  {
    name: 'negative_prompt',
    type: 'string',
    label: 'Negative Prompt',
    description: 'What to exclude from the video',
    required: false,
    default: null,
    ui_type: 'textarea',
  },
  {
    name: 'multi_prompt',
    type: 'string',
    label: 'Multi-shot (JSON)',
    description: 'JSON array of shots: [{"prompt": "...", "duration": N}]',
    required: false,
    default: null,
    ui_type: 'textarea',
  },
];

// Kling V2.6 Pro parameters (kwaivgi/kling-v2.6)
const KLING_V2_6_PRO_PARAMS: ParameterDefinition[] = [
  {
    name: 'start_image',
    type: 'string',
    label: 'Start Image',
    description: 'First frame of the video',
    required: false,
    default: null,
    ui_type: 'text',
  },
  {
    name: 'aspect_ratio',
    type: 'string',
    label: 'Aspect Ratio',
    description: 'Aspect ratio of the video (ignored if start image is provided)',
    required: false,
    default: '16:9',
    enum: ['16:9', '9:16', '1:1'],
    ui_type: 'select',
  },
  {
    name: 'duration',
    type: 'number',
    label: 'Duration',
    description: 'Duration of the video in seconds',
    required: false,
    default: 5,
    min: 5,
    max: 10,
    ui_type: 'number',
  },
  {
    name: 'generate_audio',
    type: 'boolean',
    label: 'Generate Audio',
    description: 'Generate audio for the video',
    required: false,
    default: true,
    ui_type: 'switch',
  },
  {
    name: 'negative_prompt',
    type: 'string',
    label: 'Negative Prompt',
    description: 'Description of what to exclude from the generated video',
    required: false,
    default: null,
    ui_type: 'textarea',
  },
];

// Grok Imagine Image parameters
const GROK_IMAGINE_PARAMS: ParameterDefinition[] = [
  {
    name: 'aspectRatio',
    type: 'string',
    label: 'Aspect Ratio',
    description: 'Aspect ratio of the generated image',
    required: false,
    default: '1:1',
    enum: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '2:1', '1:2', '19.5:9', '9:19.5', '20:9', '9:20'],
    ui_type: 'select',
  },
  {
    name: 'n',
    type: 'number',
    label: 'Number of Images',
    description: 'Number of images to generate (max 10)',
    required: false,
    default: 1,
    min: 1,
    max: 10,
    ui_type: 'number',
  },
  {
    name: 'seed',
    type: 'number',
    label: 'Seed',
    description: 'Seed for reproducibility',
    required: false,
    default: null,
    min: 0,
    max: 2147483647,
    ui_type: 'number',
  },
  {
    name: 'image_url',
    type: 'string',
    label: 'Input Image URL',
    description: 'Source image for editing or style transfer (public URL or base64 data URI)',
    required: false,
    default: null,
    ui_type: 'text',
  },
];

// Flux Kontext Fast parameters
const FLUX_KONTEXT_FAST_PARAMS: ParameterDefinition[] = [
  {
    name: 'speed_mode',
    type: 'string',
    label: 'Speed Mode',
    description: 'Speed optimization level',
    required: false,
    default: 'Juiced 🔥',
    enum: ['Juiced 🔥', 'Fast', 'Standard'],
    ui_type: 'select',
  },
  {
    name: 'num_inference_steps',
    type: 'number',
    label: 'Inference Steps',
    description: 'Number of diffusion (inference) steps',
    required: false,
    default: 30,
    min: 1,
    max: 100,
    ui_type: 'number',
  },
  {
    name: 'guidance',
    type: 'number',
    label: 'Guidance Scale',
    description: 'Strength of the guidance during generation. Lower = looser; higher = closer to prompt',
    required: false,
    default: 3.5,
    min: 0,
    max: 20,
    step: 0.1,
    ui_type: 'slider',
  },
  {
    name: 'seed',
    type: 'number',
    label: 'Seed',
    description: 'Seed for random generation, for reproducibility. Use -1 for random',
    required: false,
    default: -1,
    min: -1,
    max: 2147483647,
    ui_type: 'number',
  },
  {
    name: 'aspect_ratio',
    type: 'string',
    label: 'Aspect Ratio',
    description: 'Aspect ratio of the output; by default matches input image if given',
    required: false,
    default: 'match_input_image',
    enum: ['match_input_image', '1:1', '16:9', '9:16', '4:3', '3:4'],
    ui_type: 'select',
  },
  {
    name: 'image_size',
    type: 'number',
    label: 'Image Size',
    description: 'Base image size on the longest side; sets scale of output',
    required: false,
    default: 1024,
    min: 512,
    max: 2048,
    ui_type: 'number',
  },
  {
    name: 'output_format',
    type: 'string',
    label: 'Output Format',
    description: 'Format of the output image',
    required: false,
    default: 'jpg',
    enum: ['jpg', 'png', 'webp'],
    ui_type: 'select',
  },
  {
    name: 'output_quality',
    type: 'number',
    label: 'Output Quality',
    description: 'Quality parameter (1-100) for lossy formats (jpg, webp)',
    required: false,
    default: 80,
    min: 1,
    max: 100,
    ui_type: 'slider',
  },
];

// Nano Banana Pro parameters
const NANO_BANANA_PRO_PARAMS: ParameterDefinition[] = [
  {
    name: 'aspect_ratio',
    type: 'string',
    label: 'Aspect Ratio',
    description: 'Aspect ratio of the generated image',
    required: false,
    default: 'match_input_image',
    enum: ['match_input_image', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4'],
    ui_type: 'select',
  },
  {
    name: 'resolution',
    type: 'string',
    label: 'Resolution',
    description: 'Output resolution. Nano Banana Pro supports up to 4K',
    required: false,
    default: '2K',
    enum: ['1K', '2K', '4K'],
    ui_type: 'select',
  },
  {
    name: 'output_format',
    type: 'string',
    label: 'Output Format',
    description: 'Desired image file format',
    required: false,
    default: 'jpg',
    enum: ['jpeg', 'png', 'webp'],
    ui_type: 'select',
  },
  {
    name: 'safety_filter_level',
    type: 'string',
    label: 'Safety Filter Level',
    description: 'Controls content filtering / moderation',
    required: false,
    default: 'block_only_high',
    enum: ['block_only_high', 'block_medium_and_above'],
    ui_type: 'select',
  },
  {
    name: 'num_images',
    type: 'number',
    label: 'Number of Images',
    description: 'How many image variants to generate',
    required: false,
    default: 1,
    min: 1,
    max: 10,
    ui_type: 'number',
  },
];

// GPT Image 1.5 parameters
const GPT_IMAGE_1_5_PARAMS: ParameterDefinition[] = [
  {
    name: 'background',
    type: 'string',
    label: 'Background',
    description: 'Background type. When transparent, output format must support transparency (png or webp)',
    required: false,
    default: 'auto',
    enum: ['transparent', 'opaque', 'auto'],
    ui_type: 'select',
  },
  {
    name: 'moderation',
    type: 'string',
    label: 'Moderation',
    description: 'Controls content moderation level',
    required: false,
    default: 'auto',
    enum: ['low', 'auto'],
    ui_type: 'select',
  },
  {
    name: 'n',
    type: 'number',
    label: 'Number of Images',
    description: 'Number of images to generate',
    required: false,
    default: 1,
    min: 1,
    max: 10,
    ui_type: 'number',
  },
  {
    name: 'size',
    type: 'string',
    label: 'Size',
    description: 'Output image size',
    required: false,
    default: 'auto',
    enum: ['1024x1024', '1024x1536', '1536x1024', 'auto'],
    ui_type: 'select',
  },
  {
    name: 'quality',
    type: 'string',
    label: 'Quality',
    description: 'Image generation quality',
    required: false,
    default: 'auto',
    enum: ['low', 'medium', 'high', 'auto'],
    ui_type: 'select',
  },
  {
    name: 'output_format',
    type: 'string',
    label: 'Output Format',
    description: 'Image file format',
    required: false,
    default: 'png',
    enum: ['png', 'jpeg', 'webp'],
    ui_type: 'select',
  },
  {
    name: 'output_compression',
    type: 'number',
    label: 'Output Compression',
    description: 'Compression level 0-100% for webp or jpeg',
    required: false,
    default: 100,
    min: 0,
    max: 100,
    ui_type: 'slider',
  },
];

// Seedream 4.5 parameters
const SEEDREAM_4_5_PARAMS: ParameterDefinition[] = [
  {
    name: 'size',
    type: 'string',
    label: 'Size',
    description: 'Pre-set image resolution',
    required: false,
    default: '2K',
    enum: ['2K', '4K'],
    ui_type: 'select',
  },
  {
    name: 'aspect_ratio',
    type: 'string',
    label: 'Aspect Ratio',
    description: 'Aspect ratio when size is not custom',
    required: false,
    default: 'match_input_image',
    enum: ['match_input_image', '1:1', '16:9', '9:16', '4:3', '3:4'],
    ui_type: 'select',
  },
  {
    name: 'width',
    type: 'number',
    label: 'Width',
    description: 'Custom width when size is custom. Typically 1024-4096 px',
    required: false,
    default: null,
    min: 1024,
    max: 4096,
    ui_type: 'number',
  },
  {
    name: 'height',
    type: 'number',
    label: 'Height',
    description: 'Custom height when size is custom. Typically 1024-4096 px',
    required: false,
    default: null,
    min: 1024,
    max: 4096,
    ui_type: 'number',
  },
  {
    name: 'sequential_image_generation',
    type: 'string',
    label: 'Sequential Image Generation',
    description: 'Controls multi-image set or sequential generation',
    required: false,
    default: 'disabled',
    enum: ['disabled', 'auto'],
    ui_type: 'select',
  },
  {
    name: 'max_images',
    type: 'number',
    label: 'Max Images',
    description: 'Max images when sequential mode enabled. Limits like 15 total (including inputs)',
    required: false,
    default: 1,
    min: 1,
    max: 15,
    ui_type: 'number',
  },
  {
    name: 'num_images',
    type: 'number',
    label: 'Number of Images',
    description: 'Number of separate generations',
    required: false,
    default: 1,
    min: 1,
    max: 10,
    ui_type: 'number',
  },
  {
    name: 'enhance_prompt',
    type: 'boolean',
    label: 'Enhance Prompt',
    description: 'Whether to apply prompt enhancement for improved quality. Takes more generation time',
    required: false,
    default: true,
    ui_type: 'switch',
  },
  {
    name: 'seed',
    type: 'number',
    label: 'Seed',
    description: 'Random seed to reproduce results with same prompt/model/version',
    required: false,
    default: null,
    min: 0,
    max: 2147483647,
    ui_type: 'number',
  },
  {
    name: 'watermark',
    type: 'boolean',
    label: 'Watermark',
    description: 'Optionally add an invisible watermark to outputs',
    required: false,
    default: false,
    ui_type: 'switch',
  },
  {
    name: 'enable_safety_checker',
    type: 'boolean',
    label: 'Enable Safety Checker',
    description: 'Whether safety filters are applied to content',
    required: false,
    default: true,
    ui_type: 'switch',
  },
];

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

/**
 * Google Nano Banana - High-quality image generation
 */
export const GOOGLE_NANO_BANANA_MODEL: Model = {
  id: 'model-google-nano-banana',
  identifier: MODEL_IDENTIFIERS.GOOGLE_NANO_BANANA,
  name: 'Google Nano Banana',
  description: 'High-quality image generation model by Google',
  type: 'image',
  provider: 'replicate',
  is_active: true,
  model_cost: 0.001,
  parameters: {
    parameters: GOOGLE_NANO_BANANA_PARAMS,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Kling V2.6 Motion Control - Advanced video generation with motion control
 */
export const KLING_V2_6_MODEL: Model = {
  id: 'model-kling-v2.6',
  identifier: MODEL_IDENTIFIERS.KWAIVGI_KLING_V2_6,
  name: 'Kling V2.6 Motion Control',
  description: 'Advanced video generation with motion control',
  type: 'video',
  provider: 'replicate',
  is_active: true,
  model_cost: 0.01,
  parameters: {
    parameters: KLING_V2_6_PARAMS,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Veed Fabric 1.0 - Lip sync video generation
 */
export const FABRIC_1_0_MODEL: Model = {
  id: 'model-fabric-1.0',
  identifier: MODEL_IDENTIFIERS.VEED_FABRIC_1_0,
  name: 'Veed Fabric 1.0',
  description: 'Lip sync video generation model',
  type: 'video',
  provider: 'replicate',
  is_active: true,
  model_cost: 0.005,
  parameters: {
    parameters: FABRIC_1_0_PARAMS,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Minimax Hailuo 2.3 Fast - Fast image-to-video generation
 */
export const HAILUO_2_3_FAST_MODEL: Model = {
  id: 'model-hailuo-2.3-fast',
  identifier: MODEL_IDENTIFIERS.MINIMAX_HAILUO_2_3_FAST,
  name: 'Hailuo 2.3 Fast',
  description: 'A lower-latency image-to-video version of Hailuo 2.3 that preserves core motion quality, visual consistency, and stylization performance while enabling faster iteration cycles.',
  type: 'video',
  provider: 'replicate',
  is_active: true,
  model_cost: 0.008,
  parameters: {
    parameters: HAILUO_2_3_FAST_PARAMS,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Google Veo 3.1 Fast - High-fidelity video with context-aware audio
 */
export const VEO_3_1_FAST_MODEL: Model = {
  id: 'model-veo-3.1-fast',
  identifier: MODEL_IDENTIFIERS.GOOGLE_VEO_3_1_FAST,
  name: 'Veo 3.1 Fast',
  description: 'New and improved version of Veo 3 Fast, with higher-fidelity video, context-aware audio and last frame support',
  type: 'video',
  provider: 'replicate',
  is_active: true,
  model_cost: 0.012,
  parameters: {
    parameters: VEO_3_1_FAST_PARAMS,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Kling V2.6 Pro - Top-tier image-to-video with cinematic visuals
 */
export const KLING_V2_6_PRO_MODEL: Model = {
  id: 'model-kling-v2.6-pro',
  identifier: MODEL_IDENTIFIERS.KWAIVGI_KLING_V2_6_PRO,
  name: 'Kling V2.6 Pro',
  description: 'Kling 2.6 Pro: Top-tier image-to-video with cinematic visuals, fluid motion, and native audio generation',
  type: 'video',
  provider: 'replicate',
  is_active: true,
  model_cost: 0.015,
  parameters: {
    parameters: KLING_V2_6_PRO_PARAMS,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Kling Video 3.0 - Cinematic video up to 15s, native audio, multi-shot
 */
export const KLING_V3_VIDEO_MODEL: Model = {
  id: 'model-kling-v3-video',
  identifier: MODEL_IDENTIFIERS.KWAIVGI_KLING_V3_VIDEO,
  name: 'Kling Video 3.0',
  description: 'Generate cinematic videos up to 15 seconds from text or images. Native audio, lip sync, and multi-shot mode.',
  type: 'video',
  provider: 'replicate',
  is_active: true,
  model_cost: 0.02,
  parameters: {
    parameters: KLING_V3_VIDEO_PARAMS,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Kling Video 3.0 Omni - Unified text/image/video, reference images, editing, multi-shot
 */
export const KLING_V3_OMNI_VIDEO_MODEL: Model = {
  id: 'model-kling-v3-omni-video',
  identifier: MODEL_IDENTIFIERS.KWAIVGI_KLING_V3_OMNI_VIDEO,
  name: 'Kling Video 3.0 Omni',
  description: 'Unified video model: text/image/video input, reference images (<<<image_1>>>), video editing or style reference, multi-shot, native audio.',
  type: 'video',
  provider: 'replicate',
  is_active: true,
  model_cost: 0.025,
  parameters: {
    parameters: KLING_V3_OMNI_VIDEO_PARAMS,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Flux Kontext Fast - Ultra fast image generation
 */
export const FLUX_KONTEXT_FAST_MODEL: Model = {
  id: 'model-flux-kontext-fast',
  identifier: MODEL_IDENTIFIERS.PRUNAAI_FLUX_KONTEXT_FAST,
  name: 'Flux Kontext Fast',
  description: 'Ultra fast flux kontext endpoint for image generation',
  type: 'image',
  provider: 'replicate',
  is_active: true,
  model_cost: 0.002,
  parameters: {
    parameters: FLUX_KONTEXT_FAST_PARAMS,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Grok Imagine - xAI's image generation model
 */
export const GROK_IMAGINE_MODEL: Model = {
  id: 'model-grok-imagine',
  identifier: MODEL_IDENTIFIERS.XAI_GROK_IMAGINE,
  name: 'Grok Imagine',
  description: 'xAI Grok Imagine image generation model with support for creating images from text prompts',
  type: 'image',
  provider: 'xai',
  is_active: true,
  model_cost: 0.004,
  parameters: {
    parameters: GROK_IMAGINE_PARAMS,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Nano Banana Pro - State of the art image generation and editing
 */
export const NANO_BANANA_PRO_MODEL: Model = {
  id: 'model-nano-banana-pro',
  identifier: MODEL_IDENTIFIERS.GOOGLE_NANO_BANANA_PRO,
  name: 'Nano Banana Pro',
  description: "Google's state of the art image generation and editing model",
  type: 'image',
  provider: 'replicate',
  is_active: true,
  model_cost: 0.003,
  parameters: {
    parameters: NANO_BANANA_PRO_PARAMS,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * GPT Image 1.5 - OpenAI's latest image generation model
 */
export const GPT_IMAGE_1_5_MODEL: Model = {
  id: 'model-gpt-image-1.5',
  identifier: MODEL_IDENTIFIERS.OPENAI_GPT_IMAGE_1_5,
  name: 'GPT Image 1.5',
  description:
    "OpenAI's latest image generation model with better instruction following and adherence to prompts",
  type: 'image',
  provider: 'replicate',
  is_active: true,
  model_cost: 0.004,
  parameters: {
    parameters: GPT_IMAGE_1_5_PARAMS,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Seedream 4.5 - Upgraded Bytedance image model
 */
export const SEEDREAM_4_5_MODEL: Model = {
  id: 'model-seedream-4.5',
  identifier: MODEL_IDENTIFIERS.BYTEDANCE_SEEDREAM_4_5,
  name: 'Seedream 4.5',
  description: 'Seedream 4.5: Upgraded Bytedance image model with stronger spatial understanding and world knowledge',
  type: 'image',
  provider: 'replicate',
  is_active: true,
  model_cost: 0.0025,
  parameters: {
    parameters: SEEDREAM_4_5_PARAMS,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ============================================================================
// MODEL COLLECTIONS
// ============================================================================

/**
 * All available models organized by type
 */
export const IMAGE_MODELS = [
  GOOGLE_NANO_BANANA_MODEL,
  NANO_BANANA_PRO_MODEL,
  GPT_IMAGE_1_5_MODEL,
  SEEDREAM_4_5_MODEL,
  FLUX_KONTEXT_FAST_MODEL,
  GROK_IMAGINE_MODEL,
] as const;

export const VIDEO_MODELS = [
  KLING_V2_6_MODEL,
  KLING_V2_6_PRO_MODEL,
  KLING_V3_VIDEO_MODEL,
  KLING_V3_OMNI_VIDEO_MODEL,
  FABRIC_1_0_MODEL,
  HAILUO_2_3_FAST_MODEL,
  VEO_3_1_FAST_MODEL,
] as const;

export const AUDIO_MODELS = [] as const;

/**
 * All available models in a single array
 */
export const ALL_MODELS = [
  ...IMAGE_MODELS,
  ...VIDEO_MODELS,
  ...AUDIO_MODELS,
] as const;

// Fix identifiers in collections
const IMAGE_MODELS_FIXED = [
  GOOGLE_NANO_BANANA_MODEL,
  NANO_BANANA_PRO_MODEL,
  GPT_IMAGE_1_5_MODEL,
  SEEDREAM_4_5_MODEL,
  FLUX_KONTEXT_FAST_MODEL,
  GROK_IMAGINE_MODEL,
] as const;

const VIDEO_MODELS_FIXED = [
  KLING_V2_6_MODEL,
  KLING_V2_6_PRO_MODEL,
  KLING_V3_VIDEO_MODEL,
  KLING_V3_OMNI_VIDEO_MODEL,
  FABRIC_1_0_MODEL,
  HAILUO_2_3_FAST_MODEL,
  VEO_3_1_FAST_MODEL,
] as const;

const ALL_MODELS_FIXED = [
  ...IMAGE_MODELS_FIXED,
  ...VIDEO_MODELS_FIXED,
] as const;

// Export corrected collections
export { IMAGE_MODELS_FIXED as IMAGE_MODELS_ALL };
export { VIDEO_MODELS_FIXED as VIDEO_MODELS_ALL };
export { ALL_MODELS_FIXED as ALL_MODELS_LIST };

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a model by its identifier
 */
export function getModelByIdentifier(identifier: string): Model | undefined {
  return ALL_MODELS_FIXED.find((model: Model) => model.identifier === identifier);
}

/**
 * Get all models of a specific type
 */
export function getModelsByType(type: ModelType): Model[] {
  return ALL_MODELS_FIXED.filter((model: Model) => model.type === type);
}

/**
 * Get all active models
 */
export function getActiveModels(): Model[] {
  return ALL_MODELS_FIXED.filter((model: Model) => model.is_active);
}

/**
 * Get all active models of a specific type
 */
export function getActiveModelsByType(type: ModelType): Model[] {
  return ALL_MODELS_FIXED.filter((model: Model) => model.type === type && model.is_active);
}

/**
 * Get parameters for a specific model
 */
export function getModelParameters(identifier: string): ParameterDefinition[] {
  const model = getModelByIdentifier(identifier);
  if (!model || !model.parameters) {
    return [];
  }
  return model.parameters.parameters || [];
}

/**
 * Get a specific parameter definition from a model
 */
export function getParameterDefinition(
  modelIdentifier: string,
  parameterName: string
): ParameterDefinition | undefined {
  const parameters = getModelParameters(modelIdentifier);
  return parameters.find(p => p.name === parameterName);
}

/**
 * Get default parameter values for a model as a record
 */
export function getModelDefaultParameters(identifier: string): Record<string, unknown> {
  const parameters = getModelParameters(identifier);
  const defaults: Record<string, unknown> = {};
  
  parameters.forEach(param => {
    if (param.default !== undefined && param.default !== null) {
      defaults[param.name] = param.default;
    }
  });
  
  return defaults;
}

/**
 * Check if a model exists and is active
 */
export function isModelActive(identifier: string): boolean {
  const model = getModelByIdentifier(identifier);
  return model ? model.is_active : false;
}

/**
 * Get the cost of using a model
 */
export function getModelCost(identifier: string): number {
  const model = getModelByIdentifier(identifier);
  return model ? model.model_cost : 0;
}
