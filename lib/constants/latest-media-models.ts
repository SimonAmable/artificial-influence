import type { Model } from "@/lib/types/models"
import type { ModelType } from "@/lib/types/models"

interface LatestModelMetadata {
  id: string
  identifier: string
  name: string
  description: string
  type: ModelType
  provider: string
  is_active: boolean
  model_cost: number
  supports_reference_image: boolean
  supports_reference_video: boolean
  aspect_ratios: string[]
  supports_first_frame?: boolean
  supports_last_frame?: boolean
}

const now = new Date().toISOString()

function imageModel(
  id: string,
  identifier: string,
  name: string,
  description: string,
  modelCost: number,
  aspectRatios: string[],
  parameters: Model["parameters"]["parameters"],
): Model {
  return {
    id,
    identifier,
    name,
    description,
    type: "image",
    provider: "fal",
    is_active: true,
    model_cost: modelCost,
    parameters: { parameters },
    aspect_ratios: aspectRatios,
    default_aspect_ratio: aspectRatios[0] ?? "1:1",
    supports_reference_image: true,
    created_at: now,
    updated_at: now,
  }
}

function videoModel(
  id: string,
  identifier: string,
  name: string,
  description: string,
  modelCost: number,
  creditsPerSecond: number,
  aspectRatios: string[],
  duration: { min: number; max: number; default: number },
  resolution: { options: string[]; default: string },
  supportsLastFrame: boolean,
  supportsStartFrame = true,
): Model {
  return {
    id,
    identifier,
    name,
    description,
    type: "video",
    provider: "fal",
    is_active: true,
    model_cost: modelCost,
    model_cost_per_second: creditsPerSecond,
    parameters: {
      parameters: [
        ...(supportsStartFrame
          ? [
              {
                name: "image",
                type: "string" as const,
                label: "Start Frame",
                required: false,
                default: null,
                ui_type: "text" as const,
              },
            ]
          : []),
        ...(supportsLastFrame
          ? [
              {
                name: "last_frame_image",
                type: "string" as const,
                label: "Last Frame",
                required: false,
                default: null,
                ui_type: "text" as const,
              },
            ]
          : []),
        {
          name: "duration",
          type: "number",
          label: "Duration",
          required: false,
          default: duration.default,
          min: duration.min,
          max: duration.max,
          ui_type: "number",
        },
        {
          name: "resolution",
          type: "string",
          label: "Resolution",
          required: false,
          default: resolution.default,
          enum: resolution.options,
          ui_type: "select",
        },
        {
          name: "aspect_ratio",
          type: "string",
          label: "Aspect Ratio",
          required: false,
          default: aspectRatios[0] ?? "16:9",
          enum: aspectRatios,
          ui_type: "select",
        },
      ],
    },
    aspect_ratios: aspectRatios,
    default_aspect_ratio: aspectRatios[0] ?? "16:9",
    supports_reference_image: supportsStartFrame,
    supports_first_frame: supportsStartFrame,
    supports_last_frame: supportsLastFrame,
    duration_options: Array.from(
      { length: duration.max - duration.min + 1 },
      (_, index) => duration.min + index,
    ),
    created_at: now,
    updated_at: now,
  }
}

const GPT_QUALITY = [
  {
    name: "quality",
    type: "string" as const,
    label: "Quality",
    required: false,
    default: "high",
    enum: ["auto", "low", "medium", "high", "xhigh", "max"],
    ui_type: "select" as const,
  },
  {
    name: "output_format",
    type: "string" as const,
    label: "Output Format",
    required: false,
    default: "png",
    enum: ["png", "jpeg", "webp"],
    ui_type: "select" as const,
  },
]

const WIDE_RATIOS = ["match_input_image", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"]
const NANO_RATIOS = ["auto", "match_input_image", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16", "4:1", "1:4", "8:1", "1:8"]
const FLUX_RATIOS = ["auto", "21:9", "2:1", "16:9", "3:2", "7:5", "4:3", "5:4", "1:1", "4:5", "3:4", "5:7", "2:3", "9:16", "1:2"]

export const GPT_IMAGE_26_FLARE_MODEL = imageModel(
  "model-gpt-image-2.6-flare",
  "openai/gpt-image-2.6/flare",
  "GPT Image 2.6 Flare",
  "OpenAI's fast image model on Fal. Text-to-image and precise edits, about 50% faster than GPT Image 2.5.",
  8,
  WIDE_RATIOS,
  GPT_QUALITY,
)

export const GPT_IMAGE_26_SUNBURST_MODEL = imageModel(
  "model-gpt-image-2.6-sunburst",
  "openai/gpt-image-2.6/sunburst",
  "GPT Image 2.6 Sunburst",
  "OpenAI's precision image model on Fal for extra detail and tighter edits.",
  8,
  WIDE_RATIOS,
  GPT_QUALITY,
)

export const NANO_BANANA_2_1_MODEL = imageModel(
  "model-nano-banana-2.1",
  "google/nano-banana-2.1",
  "Nano Banana 2.1",
  "Google's newer Nano Banana image model on Fal, with 1K to 4K output and multi-reference edits.",
  3,
  NANO_RATIOS,
  [
    {
      name: "resolution",
      type: "string",
      label: "Resolution",
      required: false,
      default: "1K",
      enum: ["1K", "2K", "4K"],
      ui_type: "select",
    },
    {
      name: "output_format",
      type: "string",
      label: "Output Format",
      required: false,
      default: "png",
      enum: ["png", "jpeg", "webp"],
      ui_type: "select",
    },
  ],
)

export const FLUX_3_MODEL = imageModel(
  "model-flux-3",
  "blackforestlabs/flux-3",
  "FLUX 3",
  "Black Forest Labs FLUX 3 on Fal. Native 2K and 4K stills, with edits from up to 10 references.",
  4,
  FLUX_RATIOS,
  [
    {
      name: "resolution",
      type: "string",
      label: "Resolution",
      required: false,
      default: "1k",
      enum: ["768sq", "1k", "1.5k", "2k", "4k"],
      ui_type: "select",
    },
    {
      name: "output_format",
      type: "string",
      label: "Output Format",
      required: false,
      default: "jpeg",
      enum: ["jpeg", "png"],
      ui_type: "select",
    },
  ],
)

export const FLUX_3_KLEIN_MODEL = imageModel(
  "model-flux-3-klein",
  "blackforestlabs/flux-3/klein",
  "FLUX 3 Klein",
  "Small, fast FLUX 3 on Fal for text-to-image and multi-reference edits.",
  1,
  FLUX_RATIOS,
  FLUX_3_MODEL.parameters.parameters,
)

export const SEEDREAM_5_FLASH_MODEL = imageModel(
  "model-seedream-5-flash",
  "bytedance/seedream-5-flash",
  "Seedream 5.0 Flash",
  "Fast Seedream 5.0 on Fal for text-to-image and multi-reference edits up to 2K.",
  2,
  ["match_input_image", "1:1", "16:9", "9:16", "4:3", "3:4"],
  [
    {
      name: "size",
      type: "string",
      label: "Size",
      required: false,
      default: "2K",
      enum: ["1K", "1.5K", "2K"],
      ui_type: "select",
    },
  ],
)

export const KLING_V4_MODEL = videoModel(
  "model-kling-v4",
  "kling/v4",
  "Kling 4.0",
  "Kling 4.0 on Fal. 3 to 30 second clips at 720p or 1080p from text or a start frame.",
  19,
  19,
  ["16:9", "9:16", "1:1", "21:9"],
  { min: 3, max: 30, default: 5 },
  { options: ["720p", "1080p"], default: "1080p" },
  true,
)

export const KLING_V4_FLASH_MODEL = videoModel(
  "model-kling-v4-flash",
  "kling/v4/flash",
  "Kling 4.0 Flash",
  "Faster Kling 4.0 on Fal. 3 to 20 second 720p clips from text or a start frame.",
  8,
  8,
  ["16:9", "9:16", "1:1", "21:9"],
  { min: 3, max: 20, default: 5 },
  { options: ["720p"], default: "720p" },
  true,
)

export const WAN_30_MODEL = videoModel(
  "model-wan-3.0",
  "alibaba/wan-3.0",
  "Wan 3.0",
  "Alibaba Wan 3.0 on Fal. Text or first-and-last frame video up to 30 seconds with audio.",
  12,
  12,
  ["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16"],
  { min: 3, max: 30, default: 5 },
  { options: ["480p", "720p", "1080p"], default: "1080p" },
  true,
)

export const WAN_30_PRIME_MODEL = videoModel(
  "model-wan-3.0-prime",
  "alibaba/wan-3.0-prime",
  "Wan 3.0 Prime",
  "Faster Wan 3.0 Prime on Fal for text and image-to-video up to 30 seconds.",
  12,
  12,
  ["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16"],
  { min: 3, max: 30, default: 5 },
  { options: ["480p", "720p", "1080p"], default: "1080p" },
  true,
)

export const FLUX_3_MAX_MODEL = videoModel(
  "model-flux-3-max",
  "blackforestlabs/flux-3-max",
  "FLUX 3 Max",
  "fal's fast FLUX 3 video model. Text or image to video, 5 to 20 seconds, with native audio.",
  14,
  14,
  ["auto", "21:9", "2:1", "16:9", "4:3", "1:1", "3:4", "9:16"],
  { min: 5, max: 20, default: 5 },
  { options: ["720p", "1080p", "2K", "4K"], default: "720p" },
  true,
)

export const MINIMAX_H3_MAX_MODEL = videoModel(
  "model-minimax-h3-max",
  "minimax/h3-max",
  "MiniMax H3 Max",
  "Faster MiniMax H3 Max text-to-video on Fal, with native audio at 480P, 768P, or 1080P.",
  7,
  7,
  ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
  { min: 2, max: 15, default: 5 },
  { options: ["480P", "768P", "1080P"], default: "768P" },
  false,
  false,
)

export const MINIMAX_H3_MAX_TURBO_MODEL = videoModel(
  "model-minimax-h3-max-turbo",
  "minimax/h3-max-turbo",
  "MiniMax H3 Max Turbo",
  "Draft-speed MiniMax H3 Max Turbo text-to-video on Fal.",
  4,
  4,
  ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
  { min: 2, max: 15, default: 5 },
  { options: ["480P", "768P", "1080P"], default: "768P" },
  false,
  false,
)

export const LATEST_IMAGE_MODELS = [
  GPT_IMAGE_26_FLARE_MODEL,
  GPT_IMAGE_26_SUNBURST_MODEL,
  NANO_BANANA_2_1_MODEL,
  FLUX_3_MODEL,
  FLUX_3_KLEIN_MODEL,
  SEEDREAM_5_FLASH_MODEL,
] as const

export const LATEST_VIDEO_MODELS = [
  KLING_V4_MODEL,
  KLING_V4_FLASH_MODEL,
  WAN_30_MODEL,
  WAN_30_PRIME_MODEL,
  FLUX_3_MAX_MODEL,
  MINIMAX_H3_MAX_MODEL,
  MINIMAX_H3_MAX_TURBO_MODEL,
] as const

function imageMeta(
  model: Model,
  aspectRatios: string[],
): LatestModelMetadata {
  return {
    id: `${model.id}-meta`,
    identifier: model.identifier,
    name: model.name,
    description: model.description ?? "",
    type: "image",
    provider: "fal",
    is_active: true,
    model_cost: model.model_cost,
    supports_reference_image: true,
    supports_reference_video: false,
    aspect_ratios: aspectRatios,
  }
}

function videoMeta(model: Model, aspectRatios: string[]): LatestModelMetadata {
  return {
    id: `${model.id}-meta`,
    identifier: model.identifier,
    name: model.name,
    description: model.description ?? "",
    type: "video",
    provider: "fal",
    is_active: true,
    model_cost: model.model_cost,
    supports_reference_image: model.supports_first_frame === true,
    supports_reference_video: false,
    supports_first_frame: model.supports_first_frame === true,
    supports_last_frame: model.supports_last_frame,
    aspect_ratios: aspectRatios,
  }
}

export const LATEST_IMAGE_MODELS_METADATA: LatestModelMetadata[] = [
  imageMeta(GPT_IMAGE_26_FLARE_MODEL, WIDE_RATIOS),
  imageMeta(GPT_IMAGE_26_SUNBURST_MODEL, WIDE_RATIOS),
  imageMeta(NANO_BANANA_2_1_MODEL, NANO_RATIOS),
  imageMeta(FLUX_3_MODEL, FLUX_RATIOS),
  imageMeta(FLUX_3_KLEIN_MODEL, FLUX_RATIOS),
  imageMeta(SEEDREAM_5_FLASH_MODEL, ["match_input_image", "1:1", "16:9", "9:16", "4:3", "3:4"]),
]

export const LATEST_VIDEO_MODELS_METADATA: LatestModelMetadata[] = [
  videoMeta(KLING_V4_MODEL, ["16:9", "9:16", "1:1", "21:9"]),
  videoMeta(KLING_V4_FLASH_MODEL, ["16:9", "9:16", "1:1", "21:9"]),
  videoMeta(WAN_30_MODEL, ["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16"]),
  videoMeta(WAN_30_PRIME_MODEL, ["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16"]),
  videoMeta(FLUX_3_MAX_MODEL, ["auto", "21:9", "2:1", "16:9", "4:3", "1:1", "3:4", "9:16"]),
  videoMeta(MINIMAX_H3_MAX_MODEL, ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]),
  videoMeta(MINIMAX_H3_MAX_TURBO_MODEL, ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]),
]
