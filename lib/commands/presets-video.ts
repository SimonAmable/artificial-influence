import type { CommandItem } from "./types"

/** Slash palette for video prompts, same UI actions as image, plus short motion/camera presets. */
export const VIDEO_PRESET_COMMANDS: CommandItem[] = [
  {
    id: "action-create-asset",
    label: "Create asset",
    description: "Pick a file to upload, then save it to your asset library",
    inject: "",
    uiAction: "create-asset",
  },
  {
    id: "action-create-brand-kit",
    label: "Create brand kit",
    description: "Open the flow to add a new brand kit",
    inject: "",
    uiAction: "create-brand-kit",
  },
  {
    id: "preset-cinematic-wide",
    label: "Cinematic wide",
    description: "Slow push-in, shallow depth, film grain",
    inject: `Cinematic wide shot, slow subtle push-in, shallow depth of field, natural film grain, soft contrast, motivated practical lighting, stable tripod feel, photoreal motion, no text, no watermark.`,
  },
  {
    id: "preset-handheld-doc",
    label: "Documentary handheld",
    description: "Light handheld, natural motion",
    inject: `Documentary handheld camera: light natural shake, medium focal length, following action smoothly, available light, realistic motion blur, candid feel, photoreal, no text.`,
  },
  {
    id: "preset-product-spin",
    label: "Product reveal",
    description: "Clean studio spin / hero move",
    inject: `Clean product video on seamless neutral background, smooth orbital or subtle dolly around subject, soft three-point lighting, crisp materials, stable framing, no text overlays, catalog-quality motion.`,
  },
  {
    id: "preset-aerial-drone",
    label: "Aerial / drone",
    description: "High vantage, smooth glide",
    inject: `Aerial drone shot, high vantage, slow forward glide, wide landscape, golden-hour or clear-day lighting, stable gimbal-like motion, sharp horizon, photoreal, no UI text.`,
  },
]
