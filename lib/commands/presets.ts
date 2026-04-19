import type { CommandItem } from "./types"

/** Slash palette entries, text presets paste `inject`; entries with `uiAction` are handled by the host (see `onSlashUiAction`). Actions are listed first so the / menu matches keyboard order (top → bottom). */
export const PRESET_COMMANDS: CommandItem[] = [
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
    id: "preset-multi-angle-3x3",
    label: "Multi-shot: 3×3 angles",
    description:
      "Single image: 3×3 grid of the same subject from different realistic camera angles (attach reference)",
    inject: `Using the attached reference image, generate ONE composite image arranged as a neat 3×3 contact sheet (nine equal panels in a grid). Keep the same subject, identity, clothing, and materials as the reference; only change camera position and framing.

Each panel must show a different realistic angle: for example mix of front, 3/4 left, 3/4 right, profile left, profile right, three-quarter from above, three-quarter from below, wide establishing shot, and tight detail shot, assign one distinct angle per cell so no two panels repeat the same viewpoint.

Consistent photoreal style across all panels: same lighting mood and color grade as the reference unless the angle naturally changes shadow shape. Sharp focus, high detail, subtle natural grain. Thin white gutters between panels, no text labels, no watermarks.`,
  },
  {
    id: "preset-product-hero",
    label: "Product: clean hero",
    description: "Single catalog-style product shot from your reference",
    inject: `One photoreal product hero image from the attached reference. Soft seamless background (white or light neutral), centered, soft three-point lighting, crisp edges, accurate colors and labels. Shallow depth of field if it helps separation. Catalog-ready, no collage, single frame.`,
  },
  {
    id: "preset-selfie",
    label: "Natural selfie",
    description: "Casual phone selfie look, adjust place & vibe in brackets",
    inject: `Natural smartphone selfie: front camera feel, slight wide-angle, arm's-length framing, relaxed pose and genuine expression. Soft available light [golden hour window / indoor lamp / overcast day, pick one]. Casual everyday clothes, unpolished but flattering. Background: [coffee shop / bedroom mirror / city street, describe yours]. Photoreal skin texture, natural color, subtle phone-camera noise, not studio lighting.`,
  },
  {
    id: "preset-bg-swap",
    label: "Same subject, new place",
    description: "Keep who or what’s in the ref, only change the environment",
    inject: `Using the attached image, keep the subject’s identity, pose, clothing, and proportions the same. Replace only the environment/background with: [describe the new place, e.g. rainy Tokyo alley at night, sunlit Mediterranean balcony]. Match perspective and lighting so shadows and color temperature feel coherent with the new scene. Photoreal, single image, no cutout look.`,
  },
  {
    id: "preset-campaign-variants",
    label: "Campaign: A/B variations",
    description: "Same concept, small controlled tweaks for ads or thumbnails",
    inject: `Same core subject and layout for all variations; generate a small set of alternatives that only differ in: [background color or gradient], [headline mood: bold vs minimal], [crop: slightly tighter vs wider]. Keep branding and product geometry consistent. Clean, high-contrast, social-ad ready.`,
  },
]
