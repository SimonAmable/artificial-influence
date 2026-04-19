import type { CommandItem } from "./types"

/** Slash palette for /chat: commands express agent intent instead of tool-specific prompt presets. */
export const CHAT_AGENT_COMMANDS: CommandItem[] = [
  {
    id: "agent-generate-image",
    label: "Generate image",
    description: "Ask the agent to create an image now",
    inject: "Generate an image from this: ",
  },
  {
    id: "agent-edit-image",
    label: "Edit attached image",
    description: "Use the current image reference as the visual target",
    inject: "Edit the attached image so that: ",
  },
  {
    id: "agent-analyze-references",
    label: "Analyze references",
    description: "Review attached assets and call out what matters",
    inject: "Analyze the attached references and tell me: ",
  },
  {
    id: "agent-creative-brief",
    label: "Creative brief",
    description: "Turn a rough idea into a concise brief",
    inject: "Turn this into a concise creative brief: ",
  },
  {
    id: "agent-polish-prompt",
    label: "Polish prompt",
    description: "Rewrite the idea as a stronger generation prompt",
    inject: "Rewrite this as a stronger generation prompt: ",
  },
  {
    id: "agent-realistic-upscale",
    label: "Realistic upscale",
    description: "Use a high-fidelity identity-safe upscale direction",
    inject: `For each attached video/GIF: extract the last frame. Run exactly ONE generation per frame, sequentially (one frame at a time; exactly ONE image reference per generation (the current frame only); do not batch).

NB2 exact prompting: use the following prompt verbatim for each generation:

Enhance the portrait while strictly preserving the subject's identity with accurate facial geometry. Do not change their expression or face shape. Only allow subtle feature cleanup without altering who they are. Keep the exact same background from the reference image. No replacements, no changes, no new objects, no layout shifts. The environment must look identical.

The image must be recreated as if it was shot on a Sony A1, using an 85mm f1.4 lens, at f1.6, ISO 100, 1/200 shutter speed, cinematic shallow depth of field, perfect facial focus, and an editorial-neutral color profile. This Sony A1 + 85mm f1.4 setup is mandatory. The final image must clearly look like premium full-frame Sony A1 quality.

Lighting must match the exact direction, angle, and mood of the reference photo. Upgrade the lighting into a cinematic, subject-focused style: soft directional light, warm highlights, cool shadows, deeper contrast, expanded dynamic range, micro-contrast boost, smooth gradations, and zero harsh shadows. Maintain neutral premium color tone, cinematic contrast curve, natural saturation, real skin texture (not plastic), and subtle film grain. No fake glow, no runway lighting, no over smoothing.

Render in 4K resolution, 10-bit color, cinematic editorial style, premium clarity, portrait crop, and keep the original environmental vibe untouched. Re-render the subject with improved realism, depth, texture, and lighting while keeping identity and background fully preserved.

NEGATIVE INSTRUCTIONS:

No new background.

No background change.

No overly dramatic lighting.

No face morphing.

No fake glow.

No flat lighting.

No over-smooth skin.

When done, stitch the new images into one MP4 in order (listThreadMedia → composeTimelineVideo; pick 9:16-1080 or 16:9-1080).`,
  },
  {
    id: "agent-recommend-workflow",
    label: "Recommend workflow",
    description: "Choose the best Uni workflow for the goal",
    inject: "Recommend the best workflow for this goal: ",
  },
  {
    id: "agent-use-brand",
    label: "Use brand",
    description: "Steer the agent toward selected brand context",
    inject: "Use the selected brand context for this: ",
  },
]
