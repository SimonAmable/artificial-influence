-- Qwen Image 3 on Fal: text-to-image and edit, up to 3 reference images.
-- 1K is $0.04 and 2K is $0.075. The app sends ~1K presets, priced at 4 credits.

INSERT INTO public.models (
  identifier, name, description, type, provider, is_active, model_cost, model_cost_per_second,
  parameters, aspect_ratios, default_aspect_ratio, supports_reference_image, supports_reference_video,
  supports_reference_audio, supports_first_frame, supports_last_frame, duration_options, max_images,
  pricing_config, agent_usage
) VALUES (
  'alibaba/qwen-image-3',
  'Qwen Image 3',
  'Alibaba Qwen Image 3 on Fal. Strong text rendering, with edits from up to 3 reference images.',
  'image', 'fal', true, 4, NULL,
  '{"parameters":[{"name":"output_format","type":"string","label":"Output Format","default":"png","enum":["png","jpeg","webp"],"ui_type":"select"}]}'::jsonb,
  ARRAY['match_input_image','1:1','16:9','9:16','4:3','3:4'],
  '1:1', true, false, false, false, false, NULL, 4,
  '{"strategy":"flat_per_output","credits":4}'::jsonb,
  '{"agentSummary":"Qwen Image 3 on Fal. Text-to-image, or edit when up to 3 reference images are attached.","bestFor":["text in images","posters","identity-preserving edits"],"avoidFor":["video","more than 3 references"]}'::jsonb
)
ON CONFLICT (identifier, provider) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  is_active = EXCLUDED.is_active,
  model_cost = EXCLUDED.model_cost,
  parameters = EXCLUDED.parameters,
  aspect_ratios = EXCLUDED.aspect_ratios,
  default_aspect_ratio = EXCLUDED.default_aspect_ratio,
  supports_reference_image = EXCLUDED.supports_reference_image,
  max_images = EXCLUDED.max_images,
  pricing_config = EXCLUDED.pricing_config,
  agent_usage = EXCLUDED.agent_usage,
  updated_at = timezone('utc'::text, now());
