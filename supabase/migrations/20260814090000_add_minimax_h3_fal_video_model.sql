-- MiniMax H3 on Fal: single catalog id routed to text-to-video, image-to-video (first/last frame),
-- or reference-to-video (images, clips, and audio). Video editing uses reference-to-video.
-- https://fal.ai/models/minimax/h3/text-to-video
-- https://fal.ai/models/minimax/h3/image-to-video
-- https://fal.ai/models/minimax/h3/reference-to-video

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
  'minimax/h3',
  'MiniMax H3',
  'MiniMax H3 on fal: text-to-video, first/last frame, or reference-to-video with images, clips, and audio at up to 4K.',
  'video',
  'fal',
  true,
  65,
  13.00,
  '{
    "parameters": [
      {
        "name": "enable_prompt_expansion",
        "type": "boolean",
        "label": "Prompt expansion",
        "description": "Expand the prompt with a vision language model before generation",
        "required": false,
        "default": true,
        "ui_type": "switch"
      },
      {
        "name": "enable_safety_checker",
        "type": "boolean",
        "label": "Safety checker",
        "description": "Enable content moderation for input and output",
        "required": false,
        "default": false,
        "ui_type": "switch"
      },
      {
        "name": "image",
        "type": "string",
        "label": "Start Frame",
        "description": "Optional first frame for image-to-video. Disabled when reference images are attached.",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "last_frame_image",
        "type": "string",
        "label": "Last Frame",
        "description": "Optional last frame for first-to-last generation. Ignored in reference-to-video mode.",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "duration",
        "type": "number",
        "label": "Duration",
        "description": "Video duration in seconds",
        "required": false,
        "default": 5,
        "min": 5,
        "max": 15,
        "ui_type": "number"
      },
      {
        "name": "resolution",
        "type": "string",
        "label": "Resolution",
        "description": "480P and 768P are native; 2K and 4K upscale a 768P base.",
        "required": false,
        "default": "2K",
        "enum": ["480P", "768P", "2K", "4K"],
        "ui_type": "select",
        "affects_pricing": true
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Used for text-to-video and reference-to-video. Image-to-video follows the start frame.",
        "required": false,
        "default": "16:9",
        "enum": ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"],
        "ui_type": "select"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "required": false,
        "default": null,
        "min": 0,
        "max": 2147483647,
        "ui_type": "number"
      }
    ]
  }'::jsonb,
  ARRAY['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'],
  '16:9',
  true,
  true,
  true,
  true,
  true,
  ARRAY[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  9,
  '{
    "strategy": "per_second",
    "defaultCreditsPerSecond": 13,
    "tiers": [
      { "match": { "resolution": "480P" }, "creditsPerSecond": 5 },
      { "match": { "resolution": "768P" }, "creditsPerSecond": 8 },
      { "match": { "resolution": "2K" }, "creditsPerSecond": 13 },
      { "match": { "resolution": "4K" }, "creditsPerSecond": 16 }
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
  "agentSummary": "Fal-hosted MiniMax H3 unified video model. Backend routes minimax/h3 to text-to-video, image-to-video (first/last frame), or reference-to-video based on the supplied media. Video editing is reference-to-video with the source clip.",
  "bestFor": ["2K/4K text-to-video", "first-to-last-frame interpolation", "character-consistent reference-to-video", "motion and audio references", "precise edits of an existing clip"],
  "avoidFor": ["motion copy from a still plus a driving video (use Kling Motion Control)", "lipsync from a still plus speech audio (use Fabric)"],
  "inputSemantics": {
    "prompt": "Required for every MiniMax H3 mode. In reference-to-video, cite assets as Image 1, Video 1, Audio 1 in list order.",
    "image": "Single start frame for image-to-video only.",
    "last_frame": "Optional end frame for first-to-last generation. Requires a start frame.",
    "reference_images": "One to nine stills for identity/style. When present, they take precedence over first/last-frame mode.",
    "reference_videos": "Up to three clips (2-15s each, 15s combined) for motion, camera, or footage to edit.",
    "reference_audios": "Up to three clips (2-15s each, 15s combined). Audio cannot be the only reference; include at least one image or video."
  },
  "routingRules": [
    "Use the canonical catalog id minimax/h3, never the concrete Fal endpoint ids.",
    "Use text-to-video when there are no image, video, or audio inputs.",
    "Use image-to-video when there is a start frame and/or last frame and no reference gallery, reference video, or reference audio.",
    "Use reference-to-video when the user supplies reference images, reference videos, or reference audio. Fold any start/last frames into the reference image list.",
    "Duration must stay between 5 and 15 seconds.",
    "Resolution is 480P, 768P, 2K (default), or 4K."
  ],
  "promptGuidance": [
    "For reference-to-video, assign an explicit job to every asset: Image 1 is the protagonist, Video 1 supplies the camera move, Audio 1 is the score.",
    "For video edits, pass the clip as a reference video and say what changes and what must stay the same.",
    "For first-to-last-frame work, request a physically plausible transition."
  ],
  "pitfalls": [
    "Every MiniMax H3 request requires a prompt.",
    "Image-to-video ignores aspect ratio because the start frame defines it.",
    "Reference audio without a visual anchor is rejected.",
    "Reference images, videos, and audio together cannot exceed 12 files."
  ]
}$json$::jsonb,
  description = 'MiniMax H3 2K video from text, frames, or refs',
  updated_at = now()
WHERE identifier = 'minimax/h3';
