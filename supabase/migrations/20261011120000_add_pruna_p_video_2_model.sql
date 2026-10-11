-- Pruna P-Video-2 replaces P-Video.
-- https://replicate.com/prunaai/p-video-2
-- Provider rates (per finished second): 720p $0.025 / draft $0.015, 1080p $0.05 / draft $0.03.
-- Credits use a 4x markup on those rates at $0.05 per credit, matching P-Video's 720p/1080p standard prices.

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
  pricing_config,
  agent_usage
) VALUES (
  'prunaai/p-video-2',
  'P-Video 2',
  'Premium text, image, and audio video with native speech',
  'video',
  'replicate',
  true,
  10,
  2,
  '{
    "replicate_input_defaults": {
      "disable_safety_filter": true
    },
    "parameters": [
      {
        "name": "image",
        "type": "string",
        "label": "Input Image",
        "description": "Optional input image for image-to-video generation",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "audio",
        "type": "string",
        "label": "Input Audio",
        "description": "Optional audio (flac, mp3, wav). Output length follows the audio and duration is ignored.",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "last_frame_image",
        "type": "string",
        "label": "Last Frame",
        "description": "Optional last frame reference image",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "duration",
        "type": "number",
        "label": "Duration",
        "description": "Video duration in seconds (1-20). Ignored when audio is provided.",
        "required": false,
        "default": 5,
        "min": 1,
        "max": 20,
        "ui_type": "number"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Ignored when an input image is provided",
        "required": false,
        "default": "16:9",
        "enum": ["16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "1:1"],
        "ui_type": "select"
      },
      {
        "name": "resolution",
        "type": "string",
        "label": "Resolution",
        "description": "Output video resolution",
        "required": false,
        "default": "720p",
        "enum": ["720p", "1080p"],
        "ui_type": "select"
      },
      {
        "name": "fps",
        "type": "number",
        "label": "FPS",
        "description": "24 fps is more stable at 1080p. 48 fps is smoother, preferably at 720p.",
        "required": false,
        "default": 24,
        "enum": [24, 48],
        "ui_type": "select"
      },
      {
        "name": "draft",
        "type": "boolean",
        "label": "Draft Mode",
        "description": "Faster, lower-cost preview",
        "required": false,
        "default": false,
        "ui_type": "switch"
      },
      {
        "name": "save_audio",
        "type": "boolean",
        "label": "Save Audio",
        "description": "Keep generated audio, including native speech and lip-sync",
        "required": false,
        "default": true,
        "ui_type": "switch"
      },
      {
        "name": "prompt_upsampling",
        "type": "boolean",
        "label": "Prompt Upsampling",
        "description": "Automatically enhance the prompt before generation",
        "required": false,
        "default": true,
        "ui_type": "switch"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "description": "Random seed for reproducibility",
        "required": false,
        "default": null,
        "min": 0,
        "max": 2147483647,
        "ui_type": "number"
      }
    ]
  }'::jsonb,
  ARRAY['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1'],
  '16:9',
  true,
  false,
  true,
  true,
  true,
  ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]::INTEGER[],
  NULL,
  '{
    "strategy": "per_second",
    "defaultCreditsPerSecond": 2,
    "tiers": [
      { "match": { "resolution": "720p", "draft": false }, "creditsPerSecond": 2 },
      { "match": { "resolution": "720p", "draft": true }, "creditsPerSecond": 1.2 },
      { "match": { "resolution": "1080p", "draft": false }, "creditsPerSecond": 4 },
      { "match": { "resolution": "1080p", "draft": true }, "creditsPerSecond": 2.4 }
    ]
  }'::jsonb,
  $json${
    "agentSummary": "Pruna P-Video 2. Catalog id prunaai/p-video-2. Default text-to-video model and the replacement for prunaai/p-video. Text-to-video, image-to-video, optional last frame, and optional audio conditioning. Native speech and lip-sync come from dialogue written in the prompt with save_audio on and no audio input. Duration is 1-20 seconds, or follows the audio clip when one is attached. 720p or 1080p, 24 or 48 fps.",
    "bestFor": ["default short video", "native speech and lip-sync", "image-to-video", "first-and-last-frame", "audio-timed clips"],
    "avoidFor": ["motion copy from a still plus a driving video (use Kling Motion Control)", "lipsync from a still plus speech audio (use Fabric)", "reference-video editing (use Seedance or MiniMax H3)"],
    "inputSemantics": {
      "prompt": "Required. Lead with subject, action, and scene. Put spoken lines in the prompt for native lip-sync; do not also attach audio.",
      "image": "Optional first frame. Aspect ratio is ignored when an image is provided.",
      "last_frame_image": "Optional end frame.",
      "audio": "Optional flac, mp3, or wav track. Duration is ignored and the clip length follows the audio.",
      "duration": "1-20 seconds when no audio is attached.",
      "resolution": "720p or 1080p. Prefer 24 fps at 1080p, or 48 fps at 720p.",
      "draft": "Faster, cheaper preview. Turn off for final quality."
    },
    "routingRules": [
      "Use the canonical catalog id prunaai/p-video-2.",
      "Do not route new requests to prunaai/p-video; it is inactive.",
      "For spoken performance, write the dialogue in the prompt and leave audio empty.",
      "Attach audio only when the video must follow a specific track."
    ],
    "promptGuidance": [
      "Start with one subject, one action, and the setting.",
      "Add camera, lighting, and style only when they change the result.",
      "Quote spoken lines directly in the prompt for native speech."
    ],
    "pitfalls": [
      "Duration is ignored when audio is attached.",
      "Aspect ratio is ignored when an image is attached.",
      "Do not attach an audio file and also expect prompt-written dialogue."
    ]
  }$json$::jsonb
)
ON CONFLICT (identifier, provider) DO UPDATE SET
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
  agent_usage = EXCLUDED.agent_usage,
  updated_at = timezone('utc'::text, now());

UPDATE public.models
SET
  is_active = false,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'prunaai/p-video';
