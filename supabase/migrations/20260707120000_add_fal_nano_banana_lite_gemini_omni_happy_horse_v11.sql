-- Nano Banana 2 Lite (fal): https://fal.ai/models/google/nano-banana-2-lite
-- Gemini Omni Flash (fal): https://fal.ai/models/google/gemini-omni-flash
-- Happy Horse 1.1 (fal): https://fal.ai/models/alibaba/happy-horse/v1.1/image-to-video

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
  'google/nano-banana-2-lite',
  'Nano Banana 2 Lite',
  'Fast, cost-efficient Nano Banana on fal: text-to-image and multi-reference editing at 1K with safety_tolerance 6 (least strict).',
  'image',
  'fal',
  true,
  2,
  '{
    "parameters": [
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Use auto or match_input_image for edit flows.",
        "required": false,
        "default": "auto",
        "enum": ["auto", "match_input_image", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16", "4:1", "1:4", "8:1", "1:8"],
        "ui_type": "select"
      },
      {
        "name": "num_images",
        "type": "number",
        "label": "Number of images",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 4,
        "ui_type": "number"
      },
      {
        "name": "output_format",
        "type": "string",
        "label": "Output format",
        "required": false,
        "default": "png",
        "enum": ["png", "jpeg", "webp"],
        "ui_type": "select"
      },
      {
        "name": "safety_tolerance",
        "type": "string",
        "label": "Safety tolerance",
        "description": "1 is strictest, 6 is least strict.",
        "required": false,
        "default": "6",
        "enum": ["1", "2", "3", "4", "5", "6"],
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
    ],
    "fal_input_defaults": {
      "safety_tolerance": "6",
      "limit_generations": true
    }
  }'::jsonb,
  ARRAY['auto', 'match_input_image', '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16', '4:1', '1:4', '8:1', '1:8'],
  'auto',
  true,
  false,
  false,
  false,
  false,
  NULL,
  4
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
  'google/gemini-omni-flash',
  'Gemini Omni Flash',
  'Google Gemini Omni Flash on fal: text-to-video with synchronized audio, 16:9 or 9:16, 3–10 seconds.',
  'video',
  'fal',
  true,
  10,
  10.00,
  '{
    "parameters": [
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "required": false,
        "default": "16:9",
        "enum": ["16:9", "9:16"],
        "ui_type": "select"
      },
      {
        "name": "duration",
        "type": "number",
        "label": "Duration",
        "description": "Video duration in seconds",
        "required": false,
        "default": 8,
        "min": 3,
        "max": 10,
        "ui_type": "number"
      }
    ]
  }'::jsonb,
  ARRAY['16:9', '9:16'],
  '16:9',
  false,
  false,
  false,
  false,
  false,
  ARRAY[3, 4, 5, 6, 7, 8, 9, 10],
  NULL
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
  max_images = EXCLUDED.max_images;

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
  'alibaba/happy-horse/v1.1',
  'Happy Horse 1.1',
  'Alibaba Happy Horse 1.1 on fal: text-to-video, image-to-video, or reference-to-video under one selector. Safety checker is disabled by default.',
  'video',
  'fal',
  true,
  20,
  12.00,
  '{
    "parameters": [
      {
        "name": "enable_safety_checker",
        "type": "boolean",
        "label": "Safety checker",
        "description": "Enable content moderation for input and output.",
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
        "enum": ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "9:21", "5:4", "4:5"],
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
  ARRAY['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21', '5:4', '4:5'],
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
  max_images = EXCLUDED.max_images;

UPDATE public.models
SET is_active = false,
    updated_at = now()
WHERE identifier = 'alibaba/happy-horse';

UPDATE public.models
SET agent_usage = $json${
  "agentSummary": "Fal-hosted Nano Banana 2 Lite image model. Backend routes google/nano-banana-2-lite to text-to-image or edit based on reference images. Uses safety_tolerance 6 by default.",
  "bestFor": ["fast ideation", "cost-efficient edits", "multi-reference image editing"],
  "avoidFor": ["4K output", "when Nano Banana 2 Pro fidelity is required"],
  "inputSemantics": {
    "prompt": "Required for both text-to-image and edit.",
    "reference_images": "Optional; when present, routes to the edit endpoint."
  },
  "routingRules": [
    "Use the canonical catalog id google/nano-banana-2-lite.",
    "Always send safety_tolerance 6 unless the user explicitly requests stricter filtering."
  ],
  "pitfalls": ["Output is fixed 1K resolution.", "Edit mode uses aspect_ratio auto when matching the input image."]
}$json$::jsonb
WHERE identifier = 'google/nano-banana-2-lite';

UPDATE public.models
SET agent_usage = $json${
  "agentSummary": "Fal-hosted Gemini Omni Flash text-to-video with synchronized audio.",
  "bestFor": ["text-to-video with native audio", "grounded real-world motion", "quick cinematic clips"],
  "avoidFor": ["image-to-video", "reference-image character consistency", "last-frame interpolation"],
  "inputSemantics": {
    "prompt": "Required text prompt describing the video."
  },
  "routingRules": [
    "Use the canonical catalog id google/gemini-omni-flash.",
    "Duration must stay between 3 and 10 seconds.",
    "Only 16:9 and 9:16 aspect ratios are supported."
  ],
  "pitfalls": ["No image or reference inputs.", "Billing is token-based on the provider side."]
}$json$::jsonb
WHERE identifier = 'google/gemini-omni-flash';

UPDATE public.models
SET agent_usage = $json${
  "agentSummary": "Fal-hosted Happy Horse 1.1 unified video model. Backend routes alibaba/happy-horse/v1.1 to text-to-video, image-to-video, or reference-to-video based on the supplied visual inputs.",
  "bestFor": ["text-to-video with native audio", "image-to-video from a single start frame", "character-consistent reference-to-video", "multilingual lip-sync friendly video prompts"],
  "avoidFor": ["last-frame interpolation", "reference-video editing", "masked or localized video edits"],
  "inputSemantics": {
    "prompt": "Required for text-to-video and reference-to-video. Optional for image-to-video.",
    "image": "Single start frame for image-to-video only.",
    "reference_images": "One to nine still references for reference-to-video. When present, they take precedence over start-frame mode."
  },
  "routingRules": [
    "Use the canonical catalog id alibaba/happy-horse/v1.1, never the concrete Fal endpoint ids.",
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
WHERE identifier = 'alibaba/happy-horse/v1.1';

UPDATE public.models AS model
SET description = CASE model.identifier
    WHEN 'google/nano-banana-2-lite' THEN 'Fast Nano Banana edits and generation'
    WHEN 'google/gemini-omni-flash' THEN 'Gemini text-to-video with audio'
    WHEN 'alibaba/happy-horse/v1.1' THEN 'Alibaba video with native audio'
    ELSE model.description
  END,
  updated_at = now()
WHERE model.identifier IN (
  'google/nano-banana-2-lite',
  'google/gemini-omni-flash',
  'alibaba/happy-horse/v1.1'
);

UPDATE public.models
SET model_cost_per_second = CASE identifier
    WHEN 'alibaba/happy-horse/v1.1' THEN 12.00
    WHEN 'alibaba/happy-horse/v1.1/text-to-video' THEN 12.00
    WHEN 'alibaba/happy-horse/v1.1/image-to-video' THEN 12.00
    WHEN 'alibaba/happy-horse/v1.1/reference-to-video' THEN 12.00
    WHEN 'google/gemini-omni-flash' THEN 10.00
    ELSE model_cost_per_second
  END,
  updated_at = now()
WHERE identifier IN (
  'alibaba/happy-horse/v1.1',
  'alibaba/happy-horse/v1.1/text-to-video',
  'alibaba/happy-horse/v1.1/image-to-video',
  'alibaba/happy-horse/v1.1/reference-to-video',
  'google/gemini-omni-flash'
);
