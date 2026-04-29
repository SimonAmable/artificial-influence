-- Happy Horse on Fal: single catalog id routed to text-to-video, image-to-video, or reference-to-video.
-- https://fal.ai/models/alibaba/happy-horse/text-to-video
-- https://fal.ai/models/alibaba/happy-horse/image-to-video
-- https://fal.ai/models/alibaba/happy-horse/reference-to-video

INSERT INTO public.models (
  identifier,
  name,
  description,
  type,
  provider,
  is_active,
  model_cost,
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
  'alibaba/happy-horse',
  'Happy Horse',
  'Alibaba Happy Horse on fal: text-to-video, image-to-video, or reference-to-video under one selector item. Backend chooses the correct Fal endpoint from the supplied inputs.',
  'video',
  'fal',
  true,
  20,
  '{
    "parameters": [
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
        "name": "duration",
        "type": "number",
        "label": "Duration",
        "description": "Video duration in seconds",
        "required": false,
        "default": 5,
        "min": 3,
        "max": 15,
        "ui_type": "number"
      },
      {
        "name": "resolution",
        "type": "string",
        "label": "Resolution",
        "description": "Output video resolution tier",
        "required": false,
        "default": "1080p",
        "enum": ["720p", "1080p"],
        "ui_type": "select"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Used for text-to-video and reference-to-video. Ignored for image-to-video.",
        "required": false,
        "default": "16:9",
        "enum": ["16:9", "9:16", "1:1", "4:3", "3:4"],
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
  ARRAY['16:9', '9:16', '1:1', '4:3', '3:4'],
  '16:9',
  true,
  false,
  false,
  true,
  false,
  NULL,
  NULL
)
ON CONFLICT (identifier) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  provider = EXCLUDED.provider,
  is_active = EXCLUDED.is_active,
  model_cost = EXCLUDED.model_cost,
  parameters = EXCLUDED.parameters,
  aspect_ratios = EXCLUDED.aspect_ratios,
  default_aspect_ratio = EXCLUDED.default_aspect_ratio,
  supports_reference_image = EXCLUDED.supports_reference_image,
  supports_reference_video = EXCLUDED.supports_reference_video,
  supports_reference_audio = EXCLUDED.supports_reference_audio,
  supports_first_frame = EXCLUDED.supports_first_frame,
  supports_last_frame = EXCLUDED.supports_last_frame,
  duration_options = EXCLUDED.duration_options,
  max_images = EXCLUDED.max_images;

UPDATE public.models
SET agent_usage = $json${
  "agentSummary": "Fal-hosted Happy Horse unified video model. Backend routes alibaba/happy-horse to text-to-video, image-to-video, or reference-to-video based on the supplied visual inputs.",
  "bestFor": ["text-to-video with native audio", "image-to-video from a single start frame", "character-consistent reference-to-video", "multilingual lip-sync friendly video prompts"],
  "avoidFor": ["last-frame interpolation", "reference-video editing", "masked or localized video edits"],
  "inputSemantics": {
    "prompt": "Required for text-to-video and reference-to-video. Optional for image-to-video.",
    "image": "Single start frame for image-to-video only.",
    "reference_images": "One to nine still references for reference-to-video. When present, they take precedence over start-frame mode."
  },
  "routingRules": [
    "Use the canonical catalog id alibaba/happy-horse, never the concrete Fal endpoint ids.",
    "Use text-to-video when there are no image inputs.",
    "Use image-to-video when there is exactly one start frame and no reference image gallery.",
    "Use reference-to-video when the user supplies reference images; do not send a start frame in that mode."
  ],
  "promptGuidance": [
    "For reference-to-video, refer to subjects as character1, character2, and so on in the same order as the supplied images.",
    "Keep prompts concise and shot-focused unless the user explicitly wants a multi-shot description."
  ],
  "pitfalls": ["Reference-to-video requires a prompt.", "Image-to-video ignores aspect ratio because the start frame defines it.", "This unified id hides three different Fal endpoints; backend routing handles the split."]
}$json$::jsonb
WHERE identifier = 'alibaba/happy-horse';
