-- ByteDance Seedance 2.0 Mini (Replicate): same multimodal API as Seedance 2.0,
-- 480p/720p only, about half the per-second cost.
-- https://replicate.com/bytedance/seedance-2.0-mini

INSERT INTO public.models (
  identifier,
  name,
  description,
  type,
  provider,
  is_active,
  model_cost,
  model_cost_per_second,
  parameters,
  aspect_ratios,
  default_aspect_ratio,
  supports_reference_image,
  supports_reference_video,
  supports_reference_audio,
  supports_first_frame,
  supports_last_frame,
  duration_options,
  max_images
) VALUES (
  'bytedance/seedance-2.0-mini',
  'Seedance 2.0 Mini',
  'Cheaper 720p multimodal video with synced audio',
  'video',
  'replicate',
  true,
  30,
  6.00,
  '{
    "parameters": [
      {
        "name": "image",
        "type": "string",
        "label": "First Frame",
        "description": "Optional first frame for image-to-video (not combined with reference_images)",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "last_frame_image",
        "type": "string",
        "label": "Last Frame",
        "description": "Optional last frame (requires first frame; not combined with reference_images)",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "duration",
        "type": "number",
        "label": "Duration (seconds)",
        "description": "4–15 seconds, or -1 for model-chosen length",
        "required": false,
        "default": 5,
        "min": -1,
        "max": 15,
        "ui_type": "number"
      },
      {
        "name": "resolution",
        "type": "string",
        "label": "Resolution",
        "description": "Output resolution",
        "required": false,
        "default": "720p",
        "enum": ["480p", "720p"],
        "ui_type": "select"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Use adaptive to match inputs",
        "required": false,
        "default": "16:9",
        "enum": ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"],
        "ui_type": "select"
      },
      {
        "name": "generate_audio",
        "type": "boolean",
        "label": "Generate Audio",
        "description": "Synchronized dialogue, SFX, and music",
        "required": false,
        "default": true,
        "ui_type": "switch"
      },
      {
        "name": "reference_audios",
        "type": "string",
        "label": "Reference audios",
        "description": "Up to 3 public HTTPS URLs (wav/mp3). Use [Audio1] in the prompt; requires at least one reference image or video, or a first-frame image.",
        "required": false,
        "default": null,
        "ui_type": "textarea"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "description": "Optional seed for reproducibility",
        "required": false,
        "default": null,
        "min": 0,
        "max": 2147483647,
        "ui_type": "number"
      }
    ]
  }'::jsonb,
  ARRAY['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'],
  '16:9',
  true,
  true,
  true,
  true,
  true,
  ARRAY[-1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]::INTEGER[],
  9
)
ON CONFLICT (identifier) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  provider = EXCLUDED.provider,
  is_active = EXCLUDED.is_active,
  model_cost = EXCLUDED.model_cost,
  model_cost_per_second = EXCLUDED.model_cost_per_second,
  parameters = EXCLUDED.parameters,
  aspect_ratios = EXCLUDED.aspect_ratios,
  default_aspect_ratio = EXCLUDED.default_aspect_ratio,
  supports_reference_image = EXCLUDED.supports_reference_image,
  supports_reference_video = EXCLUDED.supports_reference_video,
  supports_reference_audio = EXCLUDED.supports_reference_audio,
  supports_first_frame = EXCLUDED.supports_first_frame,
  supports_last_frame = EXCLUDED.supports_last_frame,
  duration_options = EXCLUDED.duration_options,
  max_images = EXCLUDED.max_images,
  updated_at = timezone('utc'::text, now());

UPDATE public.models
SET agent_usage = $json${
  "agentSummary": "ByteDance Seedance 2.0 Mini. Catalog id bytedance/seedance-2.0-mini. Lower-cost 480p/720p variant of Seedance 2.0 with the same multimodal inputs: text-to-video, first/last frame, up to 9 reference images, 3 videos, and 3 audio clips, plus native synced audio. Duration is 4-15 seconds, or -1 for model-chosen length.",
  "bestFor": ["cheaper Seedance drafts", "high-volume 720p video", "multimodal reference video", "native audio", "video editing", "video extension"],
  "avoidFor": ["1080p or 4K output (use Seedance 2.0)", "native 30-second clips (use Seedance 2.5)", "motion copy from a still plus a driving video (use Kling Motion Control)", "lipsync from a still plus speech audio (use Fabric)"],
  "inputSemantics": {
    "prompt": "Required. Cite references as [Image1], [Video1], [Audio1] in attachment order. Put spoken lines in double quotes.",
    "image": "Optional first frame for image-to-video when there are no loose reference images or videos.",
    "last_frame": "Optional last frame. Requires a first frame. Ignored in reference-video mode.",
    "reference_images": "Up to 9 stills for identity and style. Prompt can refer to [Image1], [Image2].",
    "reference_videos": "Up to 3 clips for editing, extension, motion, or style. Prompt can refer to [Video1].",
    "reference_audios": "Up to 3 clips. Audio cannot be the only reference; include at least one image or video."
  },
  "routingRules": [
    "Use the canonical catalog id bytedance/seedance-2.0-mini.",
    "Prefer this model when the user asks for cheaper, faster, or high-volume Seedance at 480p/720p.",
    "Do not use this model when the user needs 1080p or 4K; route those to bytedance/seedance-2.0.",
    "Duration is 4-15 seconds, or -1 for model-chosen length.",
    "Resolution is 480p or 720p (default 720p)."
  ],
  "promptGuidance": [
    "Label every attached asset: [Image1] is the protagonist, [Video1] supplies motion, [Audio1] is the score.",
    "For edits, say what changes and what must stay the same.",
    "For first-to-last-frame work, request a physically plausible transition.",
    "Start with 5-second clips while prototyping."
  ],
  "pitfalls": [
    "Every Seedance Mini request requires a prompt.",
    "Reference audio without a visual anchor is rejected.",
    "Output is capped at 720p; do not promise 1080p or 4K."
  ]
}$json$::jsonb,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'bytedance/seedance-2.0-mini';
