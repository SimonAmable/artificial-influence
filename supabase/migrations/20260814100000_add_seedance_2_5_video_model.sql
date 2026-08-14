-- ByteDance Seedance 2.5: Replicate for text/image-to-video; Fal for video-input
-- reference-to-video (cheaper than Replicate when a clip is attached).
-- https://replicate.com/bytedance/seedance-2.5
-- https://fal.ai/models/bytedance/seedance-2.5/reference-to-video

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
  max_images,
  pricing_config
) VALUES (
  'bytedance/seedance-2.5',
  'Seedance 2.5',
  'ByteDance Seedance 2.5: native 30s multimodal video with synced audio. Text and frames on Replicate; video references via Fal.',
  'video',
  'replicate',
  true,
  90,
  18.00,
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
        "description": "4–30 seconds, or -1 for model-chosen length",
        "required": false,
        "default": 5,
        "min": -1,
        "max": 30,
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
        "ui_type": "select",
        "affects_pricing": true
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
        "description": "Up to 10 public HTTPS URLs (wav/mp3). Use [Audio1] in the prompt; requires at least one reference image or video, or a first-frame image.",
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
  ARRAY[-1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  30,
  '{
    "strategy": "per_second",
    "defaultCreditsPerSecond": 18,
    "tiers": [
      { "match": { "resolution": "480p", "has_reference_video": true }, "creditsPerSecond": 10 },
      { "match": { "resolution": "720p", "has_reference_video": true }, "creditsPerSecond": 22 },
      { "match": { "resolution": "480p" }, "creditsPerSecond": 8 },
      { "match": { "resolution": "720p" }, "creditsPerSecond": 18 }
    ]
  }'::jsonb
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
  pricing_config = EXCLUDED.pricing_config,
  updated_at = now();

UPDATE public.models
SET agent_usage = $json${
  "agentSummary": "ByteDance Seedance 2.5 multimodal video. Catalog id bytedance/seedance-2.5. Text-to-video and first/last-frame image-to-video run on Replicate. When the user attaches a reference video, the backend routes to Fal bytedance/seedance-2.5/reference-to-video.",
  "bestFor": ["native 30-second clips", "multi-shot cinematic video", "large reference sets", "video editing and extension", "synced dialogue and music"],
  "avoidFor": ["motion copy from a still plus a driving video (use Kling Motion Control)", "lipsync from a still plus speech audio (use Fabric)"],
  "inputSemantics": {
    "prompt": "Required. Cite references as [Image1], [Video1], [Audio1] in attachment order. Put spoken lines in double quotes.",
    "image": "Optional first frame for image-to-video when there are no loose reference images or videos.",
    "last_frame": "Optional last frame. Requires a first frame. Ignored in reference-video mode.",
    "reference_images": "Up to 30 stills for identity and style.",
    "reference_videos": "Up to 10 clips (about 2-30s each, 30s combined). Presence of a clip routes the job to Fal.",
    "reference_audios": "Up to 10 clips. Audio cannot be the only reference; include at least one image or video."
  },
  "routingRules": [
    "Use the canonical catalog id bytedance/seedance-2.5.",
    "Text-to-video and first/last-frame jobs go to Replicate.",
    "Any attached reference video goes to Fal reference-to-video.",
    "Duration is 4-30 seconds, or -1 for model-chosen length.",
    "Resolution is 480p or 720p (default 720p)."
  ],
  "promptGuidance": [
    "Label every attached asset: [Image1] is the protagonist, [Video1] supplies motion, [Audio1] is the score.",
    "For edits, say what changes and what must stay the same.",
    "For first-to-last-frame work, request a physically plausible transition."
  ],
  "pitfalls": [
    "Every Seedance 2.5 request requires a prompt.",
    "Reference audio without a visual anchor is rejected.",
    "Fal prompt tags use @Image1; the app converts [Image1] when routing video jobs to Fal."
  ]
}$json$::jsonb,
  description = 'Native 30s multimodal video with synced audio',
  updated_at = now()
WHERE identifier = 'bytedance/seedance-2.5';
