-- MiniMax H3 Highspeed and H3 Lite on Replicate.
-- Full H3 stays on the existing Fal model.

INSERT INTO public.models (
  identifier, name, description, type, provider, is_active, model_cost, model_cost_per_second,
  parameters, aspect_ratios, default_aspect_ratio, supports_reference_image, supports_reference_video,
  supports_reference_audio, supports_first_frame, supports_last_frame, duration_options, max_images,
  pricing_config, agent_usage
) VALUES
(
  'minimax/h3-highspeed',
  'MiniMax H3 Highspeed',
  'MiniMax H3 Highspeed on Replicate. 768P video from text, a start frame, or up to 9 images, 3 videos, and 3 audio clips.',
  'video', 'replicate', true, 25, 5,
  '{"parameters":[{"name":"first_frame_image","type":"string","label":"First Frame","required":false,"default":null,"ui_type":"text"},{"name":"last_frame_image","type":"string","label":"Last Frame","required":false,"default":null,"ui_type":"text"},{"name":"duration","type":"number","label":"Duration","description":"4 to 15 seconds.","required":false,"default":5,"enum":[4,5,6,7,8,9,10,11,12,13,14,15],"ui_type":"select"},{"name":"aspect_ratio","type":"string","label":"Aspect Ratio","required":false,"default":"16:9","enum":["21:9","16:9","4:3","1:1","3:4","9:16"],"ui_type":"select"}]}'::jsonb,
  ARRAY['21:9','16:9','4:3','1:1','3:4','9:16'],
  '16:9', true, true, true, true, true, ARRAY[4,5,6,7,8,9,10,11,12,13,14,15], 9,
  '{"strategy":"per_second","defaultCreditsPerSecond":5,"tiers":[]}'::jsonb,
  '{"agentSummary":"MiniMax H3 Highspeed on Replicate. 768P only, about 5 credits per second. Text, start and last frame, or references: up to 9 images, 3 videos, and 3 audio clips. Audio needs an image or video.","bestFor":["fast h3 iteration","reference video"],"avoidFor":["2k output","480p drafts"]}'::jsonb
),
(
  'minimax/h3-lite',
  'MiniMax H3 Lite',
  'MiniMax H3 Lite on Replicate. Draft video at 480P or 768P, with a start frame or image, video, and audio references.',
  'video', 'replicate', true, 20, 4,
  '{"parameters":[{"name":"first_frame_image","type":"string","label":"First Frame","required":false,"default":null,"ui_type":"text"},{"name":"last_frame_image","type":"string","label":"Last Frame","required":false,"default":null,"ui_type":"text"},{"name":"duration","type":"number","label":"Duration","description":"4 to 15 seconds.","required":false,"default":5,"enum":[4,5,6,7,8,9,10,11,12,13,14,15],"ui_type":"select"},{"name":"aspect_ratio","type":"string","label":"Aspect Ratio","required":false,"default":"16:9","enum":["21:9","16:9","4:3","1:1","3:4","9:16"],"ui_type":"select"},{"name":"resolution","type":"string","label":"Resolution","required":false,"default":"768P","enum":["480P","768P"],"ui_type":"select","affects_pricing":true}]}'::jsonb,
  ARRAY['21:9','16:9','4:3','1:1','3:4','9:16'],
  '16:9', true, true, true, true, true, ARRAY[4,5,6,7,8,9,10,11,12,13,14,15], 9,
  '{"strategy":"per_second","defaultCreditsPerSecond":4,"tiers":[{"match":{"resolution":"480P"},"creditsPerSecond":2}]}'::jsonb,
  '{"agentSummary":"MiniMax H3 Lite on Replicate. 2 credits per second at 480P, 4 at 768P. Same frame and reference inputs as H3 Highspeed.","bestFor":["draft video","cheap batches"],"avoidFor":["final 2k output"]}'::jsonb
)
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
