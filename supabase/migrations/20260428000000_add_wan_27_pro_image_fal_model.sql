-- Wan 2.7 Pro Image on Fal: single catalog id routed to text-to-image or edit.
-- https://fal.ai/models/fal-ai/wan/v2.7/pro/text-to-image
-- https://fal.ai/models/fal-ai/wan/v2.7/pro/edit

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
  'fal-ai/wan/v2.7/pro',
  'Wan 2.7 Pro Image',
  'WAN 2.7 Pro on fal: text-to-image, or attach reference image(s) for image editing (same selector item; backend picks text-to-image vs edit endpoint).',
  'image',
  'fal',
  true,
  10,
  '{
    "parameters": [
      {
        "name": "negative_prompt",
        "type": "string",
        "label": "Negative Prompt",
        "required": false,
        "default": null,
        "ui_type": "textarea"
      },
      {
        "name": "num_images",
        "type": "number",
        "label": "Number of images",
        "description": "Text-to-image uses Fal max_images; edit mode uses Fal num_images.",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 4,
        "ui_type": "number"
      },
      {
        "name": "enable_prompt_expansion",
        "type": "boolean",
        "label": "Prompt expansion",
        "description": "Supported by the Fal edit endpoint.",
        "required": false,
        "default": true,
        "ui_type": "switch"
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
      },
      {
        "name": "image_size",
        "type": "string",
        "label": "Image size",
        "required": false,
        "default": "square_hd",
        "enum": ["square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"],
        "ui_type": "select"
      }
    ]
  }'::jsonb,
  ARRAY['1:1', '16:9', '9:16', '4:3', '3:4'],
  '1:1',
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

UPDATE public.models
SET agent_usage = $json${
  "agentSummary": "Fal-hosted WAN 2.7 Pro unified image generation/editing model. Backend routes fal-ai/wan/v2.7/pro to text-to-image when there are no references, or edit when reference images are attached.",
  "bestFor": ["premium-quality text-to-image", "premium text-guided image edits", "style transformations", "creative image manipulation", "Chinese and English prompts"],
  "avoidFor": ["masked inpainting workflows", "video", "transparent-background promises", "more than 4 output variants in this app"],
  "inputSemantics": {
    "prompt": "Text prompt or edit instruction. For edits, reference images are addressed as image 1, image 2, image 3, image 4.",
    "image_urls": "When references are present, backend routes to Fal edit and sends up to 4 URLs.",
    "max_images": "Used by the text-to-image endpoint.",
    "num_images": "Used by the edit endpoint."
  },
  "routingRules": [
    "Use the canonical catalog id fal-ai/wan/v2.7/pro, never fal-ai/wan/v2.7/pro/text-to-image or fal-ai/wan/v2.7/pro/edit.",
    "Use text-to-image when there are no references.",
    "Use edit when the user supplies reference images; mention source order in the prompt when multiple images matter."
  ],
  "promptGuidance": [
    "For edits, state the desired change and what should remain unchanged.",
    "For multiple references, refer to image 1, image 2, image 3, or image 4 explicitly.",
    "Use the negative prompt for concrete exclusions rather than vague quality words."
  ],
  "pitfalls": ["The edit endpoint accepts 1-4 reference images.", "Text-to-image and edit use different count fields; backend handles this under the unified id."]
}$json$::jsonb
WHERE identifier = 'fal-ai/wan/v2.7/pro';
