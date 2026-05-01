-- Switch GPT Image 2 back to Fal and ensure the canonical model row exists.
-- Fal model pages:
--   https://fal.ai/models/openai/gpt-image-2/api
--   https://fal.ai/models/openai/gpt-image-2/edit/api

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
  'openai/gpt-image-2',
  'GPT Image 2',
  'Fal-hosted GPT Image 2 with one canonical model id for both text-to-image and guided image edits, plus broader aspect ratio support.',
  'image',
  'fal',
  true,
  4,
  '{
    "parameters": [
      {
        "name": "quality",
        "type": "string",
        "label": "Quality",
        "description": "Fal quality preset for GPT Image 2",
        "required": false,
        "default": "low",
        "enum": ["low", "medium", "high"],
        "ui_type": "select"
      },
      {
        "name": "num_images",
        "type": "number",
        "label": "Number of Images",
        "description": "How many image variants to generate",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 4,
        "ui_type": "number"
      },
      {
        "name": "output_format",
        "type": "string",
        "label": "Output Format",
        "description": "Image file format",
        "required": false,
        "default": "png",
        "enum": ["png", "jpeg", "webp"],
        "ui_type": "select"
      },
      {
        "name": "image_size",
        "type": "string",
        "label": "Image Size",
        "description": "Fal preset size used for common aspect ratios; custom dimensions are applied automatically for wider ratio support.",
        "required": false,
        "default": "square_hd",
        "enum": ["square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"],
        "ui_type": "select"
      }
    ]
  }'::jsonb,
  ARRAY['match_input_image', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '2:1', '1:2', '19.5:9', '9:19.5', '20:9', '9:20', '21:9'],
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
  "agentSummary": "Fal-hosted GPT Image 2 unified image generation/editing model. The app routes openai/gpt-image-2 to text-to-image when there are no references, or to the Fal edit endpoint when reference images are attached.",
  "bestFor": ["text-heavy designs", "logos and layouts", "precise image edits", "photoreal product scenes", "UI mockups", "multi-image composition", "final OpenAI image output"],
  "avoidFor": ["transparent backgrounds", "video", "very cheap drafts"],
  "inputSemantics": {
    "prompt": "Clear generation or edit instruction. Put exact visible text in quotes.",
    "image_urls": "One or more reference/edit images. The app routes to the Fal edit endpoint when these are present.",
    "aspect_ratio": "Use one of the ratios listed by listModels; this Fal-backed adapter supports broader ratios than the old Replicate path.",
    "quality": "low, medium, or high. Low is the default for this Fal integration.",
    "num_images": "Use multiple only when variants are requested.",
    "image_size": "The backend maps common ratios to Fal presets and uses custom dimensions for additional supported ratios."
  },
  "routingRules": [
    "Use the canonical catalog id openai/gpt-image-2, never separate text-to-image or edit ids.",
    "Use text-to-image when there are no references.",
    "Use edit when reference images are attached."
  ],
  "promptGuidance": [
    "Use specific instructions instead of broad requests like make it better.",
    "For realism, include lens, framing, and lighting language.",
    "For multiple inputs, label each image role in the prompt."
  ],
  "pitfalls": ["No transparent backgrounds.", "Generated facts and text should still be reviewed.", "Keep variant counts low unless the user explicitly asks for multiple options."]
}$json$::jsonb
WHERE identifier = 'openai/gpt-image-2';
