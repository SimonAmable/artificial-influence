-- xAI Grok Imagine Video 1.5 (Replicate preview), image-to-video with synchronized audio
-- Source: https://replicate.com/xai/grok-imagine-video-1.5
-- Pricing snapshot: $0.08/sec at 480p, $0.14/sec at 720p (plus $0.01 input image)

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
  'xai/grok-imagine-video-1.5',
  'Grok Imagine Video 1.5',
  'Animate a still image into a short video with synchronized audio. Focus prompts on motion, camera moves, and sound — not re-describing the image.',
  'video',
  'replicate',
  true,
  15,
  5.00,
  '{
    "parameters": [
      {
        "name": "image",
        "type": "string",
        "label": "Input Image",
        "description": "Required starting frame to animate (jpg, jpeg, png, webp). Output aspect ratio defaults to the image when set to auto.",
        "required": true,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "duration",
        "type": "number",
        "label": "Duration (seconds)",
        "description": "1–15 seconds",
        "required": false,
        "default": 5,
        "min": 1,
        "max": 15,
        "ui_type": "number"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Output aspect ratio. auto matches the input image.",
        "required": false,
        "default": "auto",
        "enum": ["auto", "16:9", "4:3", "1:1", "9:16", "3:4", "3:2", "2:3"],
        "ui_type": "select"
      },
      {
        "name": "resolution",
        "type": "string",
        "label": "Resolution",
        "description": "Output resolution",
        "required": false,
        "default": "720p",
        "enum": ["720p", "480p"],
        "ui_type": "select"
      }
    ]
  }'::jsonb,
  ARRAY['auto', '16:9', '4:3', '1:1', '9:16', '3:4', '3:2', '2:3'],
  'auto',
  true,
  false,
  false,
  true,
  false,
  ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]::INTEGER[],
  1
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
  "agentSummary": "Grok Imagine Video 1.5 is xAI's preview image-to-video model on Replicate. It animates a still image into a short clip with native synchronized audio. Text-to-video and video editing are not supported — always attach a starting image.",
  "bestFor": ["image-to-video with synced audio", "portrait animation", "product showcase motion", "character animation from illustrations", "cinematic camera moves from a single frame"],
  "avoidFor": ["text-to-video without a source image", "video editing or restyling existing clips", "negative prompts", "complex multi-subject scenes", "long clips over 15 seconds"],
  "inputSemantics": {
    "image": "Required starting frame. The model preserves composition and style from this image.",
    "prompt": "Describe motion, camera movement, atmosphere, and audio — do not re-describe what is already in the image.",
    "duration": "1-15 seconds. Shorter clips (5-8s) are more stable.",
    "aspect_ratio": "auto matches the input image; override for platform-specific framing.",
    "resolution": "480p or 720p."
  },
  "routingRules": [
    "Use xai/grok-imagine-video-1.5 when the user has a strong starting image and wants higher-fidelity image-to-video with synced sound.",
    "Use xai/grok-imagine-video for text-to-video, video editing, or video extension workflows.",
    "Always require an input image before calling this model."
  ],
  "promptGuidance": [
    "One subject, one primary action, one camera move.",
    "Use specific motion verbs and intensity modifiers.",
    "Mention audio mood or effects in the prompt (background music, ambience, dialogue).",
    "Avoid negative prompts and tag stacking."
  ],
  "pitfalls": ["Image is mandatory — model rejects text-only requests.", "Negative prompts are ignored.", "Do not contradict the source image content."]
}$json$::jsonb,
    updated_at = timezone('utc'::text, now())
WHERE identifier = 'xai/grok-imagine-video-1.5';
