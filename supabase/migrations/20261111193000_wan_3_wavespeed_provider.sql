-- Wan 3.0 generation moves to WaveSpeed. The Fal row stays in the table and is inactive.

INSERT INTO public.models (
  identifier, name, description, type, provider, is_active, model_cost, model_cost_per_second,
  parameters, aspect_ratios, default_aspect_ratio, supports_reference_image, supports_reference_video,
  supports_reference_audio, supports_first_frame, supports_last_frame, duration_options, max_images,
  pricing_config, agent_usage
)
SELECT
  identifier,
  name,
  'Alibaba Wan 3.0 on WaveSpeed. Text, start and end frames, or reference images, videos, and audio, up to 30 seconds.',
  type,
  'wavespeed',
  true,
  model_cost,
  model_cost_per_second,
  '{"parameters":[{"max":30,"min":2,"name":"duration","type":"number","label":"Duration","default":5,"ui_type":"number"},{"enum":["480p","720p","1080p"],"name":"resolution","type":"string","label":"Resolution","default":"720p","ui_type":"select"},{"enum":["16:9","9:16","1:1","4:3","3:4"],"name":"aspect_ratio","type":"string","label":"Aspect Ratio","default":"16:9","ui_type":"select"}]}'::jsonb,
  ARRAY['16:9','9:16','1:1','4:3','3:4'],
  '16:9',
  supports_reference_image,
  supports_reference_video,
  supports_reference_audio,
  supports_first_frame,
  supports_last_frame,
  duration_options,
  10,
  '{"strategy":"per_second","defaultCreditsPerSecond":8,"tiers":[{"match":{"resolution":"480p"},"creditsPerSecond":4},{"match":{"resolution":"720p"},"creditsPerSecond":8},{"match":{"resolution":"1080p"},"creditsPerSecond":16}]}'::jsonb,
  '{"agentSummary":"Wan 3.0 on WaveSpeed. Text-to-video, image-to-video with an optional last frame, or reference-to-video with images, clips, and audio. 1080p is 16 credits per second.","bestFor":["30 second clips","reference video"],"avoidFor":["motion copy"]}'::jsonb
FROM public.models
WHERE identifier = 'alibaba/wan-3.0' AND provider = 'fal'
ON CONFLICT (identifier, provider) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
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
SET is_active = false, updated_at = timezone('utc'::text, now())
WHERE identifier = 'alibaba/wan-3.0' AND provider = 'fal';
