-- MiniMax H3 Highspeed generation moves to WaveSpeed. The Replicate row stays inactive.

INSERT INTO public.models (
  identifier, name, description, type, provider, is_active, model_cost, model_cost_per_second,
  parameters, aspect_ratios, default_aspect_ratio, supports_reference_image, supports_reference_video,
  supports_reference_audio, supports_first_frame, supports_last_frame, duration_options, max_images,
  pricing_config, agent_usage
)
SELECT
  identifier,
  name,
  'MiniMax H3 Highspeed on WaveSpeed. 768P video from text, a start frame, or up to 9 images, 3 videos, and 3 audio clips.',
  type,
  'wavespeed',
  true,
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
  '{"agentSummary":"MiniMax H3 Highspeed on WaveSpeed. 768P only, about 5 credits per second. Text, start and last frame, or references: up to 9 images, 3 videos, and 3 audio clips. Audio needs an image or video. Reference video time is billed by WaveSpeed as well.","bestFor":["fast h3 iteration","reference video"],"avoidFor":["2k output","480p drafts"]}'::jsonb
FROM public.models
WHERE identifier = 'minimax/h3-highspeed' AND provider = 'replicate'
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
WHERE identifier = 'minimax/h3-highspeed' AND provider = 'replicate';
