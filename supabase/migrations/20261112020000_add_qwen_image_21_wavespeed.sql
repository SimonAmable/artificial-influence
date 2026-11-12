-- Qwen Image 2.1 on WaveSpeed.
-- No references uses text-to-image-lora. References use edit-lora (up to 10 images).
-- Quoted credits: 1k = 3, 1.5k = 4, 2k = 10. 2k follows the published upper list price.

INSERT INTO public.models (
  identifier, name, description, type, provider, is_active, model_cost, model_cost_per_second,
  parameters, aspect_ratios, default_aspect_ratio, supports_reference_image, supports_reference_video,
  supports_reference_audio, supports_first_frame, supports_last_frame, duration_options, max_images,
  pricing_config, agent_usage
) VALUES (
  'wavespeed-ai/qwen-image-2.1',
  'Qwen Image 2.1',
  'Qwen Image 2.1 on WaveSpeed. Text-to-image, or an edit from up to 10 reference images.',
  'image', 'wavespeed', true, 4, NULL,
  '{"parameters":[{"name":"resolution","type":"string","label":"Resolution","default":"1k","enum":["1k","1.5k","2k"],"ui_type":"select"},{"name":"output_format","type":"string","label":"Output Format","default":"png","enum":["png","jpeg","webp"],"ui_type":"select"}]}'::jsonb,
  ARRAY['auto','1:1','16:9','9:16','4:3','3:4','3:2','2:3','21:9','9:21'],
  'auto', true, false, false, false, false, NULL, 1,
  '{"strategy":"tiered_per_output","defaultCredits":4,"dimensions":[{"parameter":"resolution","values":{"1k":3,"1.5k":4,"2k":10}}]}'::jsonb,
  '{"agentSummary":"Qwen Image 2.1 on WaveSpeed. Text-to-image with no references, or edit-lora when up to 10 reference images are attached. Resolutions 1k, 1.5k, and 2k. Aspect auto follows the references.","bestFor":["text in images","multi-reference edits","posters"],"avoidFor":["video","custom LoRA URLs"]}'::jsonb
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
