-- November 2026 image and video catalog additions on Fal.
-- GPT Image 2.6, Nano Banana 2.1, FLUX 3, Seedream 5 Flash,
-- Kling 4.0, Wan 3.0, FLUX 3 Max, and MiniMax H3 Max.
-- Also points Gemini Omni Flash at the 1.2 duration and price.

UPDATE public.models
SET
  name = 'Gemini Omni Flash 1.2',
  description = 'Gemini Omni Flash 1.2 on fal: 3 to 15 second video with audio, from text, images, or an existing clip.',
  model_cost = 6,
  model_cost_per_second = 6,
  duration_options = ARRAY[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  pricing_config = '{
    "strategy": "per_second",
    "defaultCreditsPerSecond": 6,
    "tiers": [
      { "match": { "resolution": "360p" }, "creditsPerSecond": 2 },
      { "match": { "resolution": "720p" }, "creditsPerSecond": 6 },
      { "match": { "resolution": "1080p" }, "creditsPerSecond": 9 },
      { "match": { "resolution": "4k" }, "creditsPerSecond": 17 }
    ]
  }'::jsonb,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'google/gemini-omni-flash';

UPDATE public.models
SET parameters = jsonb_set(
  parameters,
  '{parameters}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN elem->>'name' = 'duration' THEN jsonb_set(elem, '{max}', '15'::jsonb)
        ELSE elem
      END
      ORDER BY ordinality
    ), '[]'::jsonb)
    FROM jsonb_array_elements(parameters->'parameters') WITH ORDINALITY AS items(elem, ordinality)
  )
)
WHERE identifier = 'google/gemini-omni-flash'
  AND jsonb_typeof(parameters->'parameters') = 'array';

UPDATE public.models
SET parameters = jsonb_set(
  parameters,
  '{parameters}',
  (parameters->'parameters') || '{
    "name": "resolution",
    "type": "string",
    "label": "Resolution",
    "description": "Output resolution. Higher resolutions cost more.",
    "required": false,
    "default": "720p",
    "enum": ["360p", "720p", "1080p", "4k"],
    "ui_type": "select"
  }'::jsonb
)
WHERE identifier = 'google/gemini-omni-flash'
  AND jsonb_typeof(parameters->'parameters') = 'array'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(parameters->'parameters') elem
    WHERE elem->>'name' = 'resolution'
  );

INSERT INTO public.models (
  identifier, name, description, type, provider, is_active, model_cost, model_cost_per_second,
  parameters, aspect_ratios, default_aspect_ratio, supports_reference_image, supports_reference_video,
  supports_reference_audio, supports_first_frame, supports_last_frame, duration_options, max_images,
  pricing_config, agent_usage
) VALUES
(
  'openai/gpt-image-2.6/flare',
  'GPT Image 2.6 Flare',
  'OpenAI''s fast image model on Fal. Text-to-image and precise edits, about 50% faster than GPT Image 2.5.',
  'image', 'fal', true, 8, NULL,
  '{"parameters":[{"name":"quality","type":"string","label":"Quality","default":"high","enum":["auto","low","medium","high","xhigh","max"],"ui_type":"select"},{"name":"output_format","type":"string","label":"Output Format","default":"png","enum":["png","jpeg","webp"],"ui_type":"select"}]}'::jsonb,
  ARRAY['match_input_image','1:1','16:9','9:16','4:3','3:4','3:2','2:3','21:9'],
  '1:1', true, false, false, false, false, NULL, 16,
  '{"strategy":"tiered_per_output","defaultCredits":8,"dimensions":[{"parameter":"quality","values":{"auto":8,"low":1,"medium":4,"high":8,"xhigh":12,"max":16}}]}'::jsonb,
  '{"agentSummary":"Default OpenAI image model. Fal GPT Image 2.6 Flare. Routes to text-to-image, or edit when reference images are attached.","bestFor":["everyday generation","fast stills","precise edits"],"avoidFor":["video"]}'::jsonb
),
(
  'openai/gpt-image-2.6/sunburst',
  'GPT Image 2.6 Sunburst',
  'OpenAI''s precision image model on Fal for extra detail and tighter edits.',
  'image', 'fal', true, 8, NULL,
  '{"parameters":[{"name":"quality","type":"string","label":"Quality","default":"high","enum":["auto","low","medium","high","xhigh","max"],"ui_type":"select"},{"name":"output_format","type":"string","label":"Output Format","default":"png","enum":["png","jpeg","webp"],"ui_type":"select"}]}'::jsonb,
  ARRAY['match_input_image','1:1','16:9','9:16','4:3','3:4','3:2','2:3','21:9'],
  '1:1', true, false, false, false, false, NULL, 16,
  '{"strategy":"tiered_per_output","defaultCredits":8,"dimensions":[{"parameter":"quality","values":{"auto":8,"low":1,"medium":4,"high":8,"xhigh":12,"max":16}}]}'::jsonb,
  '{"agentSummary":"Precision OpenAI image model. Use when the user asks for GPT Image 2.6 Sunburst.","bestFor":["premium stills","tight edits"],"avoidFor":["speed-first volume","video"]}'::jsonb
),
(
  'google/nano-banana-2.1',
  'Nano Banana 2.1',
  'Google''s newer Nano Banana image model on Fal, with 1K to 4K output and multi-reference edits.',
  'image', 'fal', true, 3, NULL,
  '{"parameters":[{"name":"resolution","type":"string","label":"Resolution","default":"1K","enum":["1K","2K","4K"],"ui_type":"select"},{"name":"output_format","type":"string","label":"Output Format","default":"png","enum":["png","jpeg","webp"],"ui_type":"select"}]}'::jsonb,
  ARRAY['auto','match_input_image','21:9','16:9','3:2','4:3','5:4','1:1','4:5','3:4','2:3','9:16','4:1','1:4','8:1','1:8'],
  'auto', true, false, false, false, false, NULL, 14,
  '{"strategy":"tiered_per_output","defaultCredits":3,"dimensions":[{"parameter":"resolution","values":{"1k":3,"2k":5,"4k":11}}]}'::jsonb,
  '{"agentSummary":"Nano Banana 2.1 on Fal. Use for Google image generation and multi-reference edits up to 4K.","bestFor":["subject consistency","4K stills","reference edits"],"avoidFor":["video"]}'::jsonb
),
(
  'blackforestlabs/flux-3',
  'FLUX 3',
  'Black Forest Labs FLUX 3 on Fal. Native 2K and 4K stills, with edits from up to 10 references.',
  'image', 'fal', true, 4, NULL,
  '{"parameters":[{"name":"resolution","type":"string","label":"Resolution","default":"1k","enum":["768sq","1k","1.5k","2k","4k"],"ui_type":"select"},{"name":"output_format","type":"string","label":"Output Format","default":"jpeg","enum":["jpeg","png"],"ui_type":"select"}]}'::jsonb,
  ARRAY['auto','21:9','2:1','16:9','3:2','7:5','4:3','5:4','1:1','4:5','3:4','5:7','2:3','9:16','1:2'],
  'auto', true, false, false, false, false, NULL, 10,
  '{"strategy":"tiered_per_output","defaultCredits":4,"dimensions":[{"parameter":"resolution","values":{"768sq":2,"1k":4,"1.5k":8,"2k":16,"4k":64}}]}'::jsonb,
  '{"agentSummary":"FLUX 3 image model on Fal. Text-to-image, or edit when reference images are attached.","bestFor":["layout","4K stills","multi-reference edits"],"avoidFor":["video"]}'::jsonb
),
(
  'blackforestlabs/flux-3/klein',
  'FLUX 3 Klein',
  'Small, fast FLUX 3 on Fal for text-to-image and multi-reference edits.',
  'image', 'fal', true, 1, NULL,
  '{"parameters":[{"name":"resolution","type":"string","label":"Resolution","default":"1k","enum":["768sq","1k","1.5k","2k","4k"],"ui_type":"select"},{"name":"output_format","type":"string","label":"Output Format","default":"jpeg","enum":["jpeg","png"],"ui_type":"select"}]}'::jsonb,
  ARRAY['auto','21:9','2:1','16:9','3:2','7:5','4:3','5:4','1:1','4:5','3:4','5:7','2:3','9:16','1:2'],
  'auto', true, false, false, false, false, NULL, 10,
  '{"strategy":"tiered_per_output","defaultCredits":1,"dimensions":[{"parameter":"resolution","values":{"768sq":1,"1k":1,"1.5k":2,"2k":4,"4k":12}}]}'::jsonb,
  '{"agentSummary":"Fast FLUX 3 Klein image model. Use when the user wants Flux speed over FLUX 3 flagship detail.","bestFor":["fast flux stills","edits"],"avoidFor":["video"]}'::jsonb
),
(
  'bytedance/seedream-5-flash',
  'Seedream 5.0 Flash',
  'Fast Seedream 5.0 on Fal for text-to-image and multi-reference edits up to 2K.',
  'image', 'fal', true, 2, NULL,
  '{"parameters":[{"name":"size","type":"string","label":"Size","default":"2K","enum":["1K","1.5K","2K"],"ui_type":"select"}]}'::jsonb,
  ARRAY['match_input_image','1:1','16:9','9:16','4:3','3:4'],
  '1:1', true, false, false, false, false, NULL, 10,
  '{"strategy":"flat_per_output","credits":2}'::jsonb,
  '{"agentSummary":"Cheap Seedream 5.0 Flash stills on Fal.","bestFor":["fast seedream drafts"],"avoidFor":["4K","video"]}'::jsonb
),
(
  'kling/v4',
  'Kling 4.0',
  'Kling 4.0 on Fal. 3 to 30 second clips at 720p or 1080p from text or a start frame.',
  'video', 'fal', true, 19, 19,
  '{"parameters":[{"name":"duration","type":"number","label":"Duration","default":5,"min":3,"max":30,"ui_type":"number"},{"name":"resolution","type":"string","label":"Resolution","default":"1080p","enum":["720p","1080p"],"ui_type":"select"},{"name":"aspect_ratio","type":"string","label":"Aspect Ratio","default":"16:9","enum":["16:9","9:16","1:1","21:9"],"ui_type":"select"}]}'::jsonb,
  ARRAY['16:9','9:16','1:1','21:9'],
  '16:9', true, false, false, true, true, ARRAY[3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30], NULL,
  '{"strategy":"per_second","defaultCreditsPerSecond":19,"tiers":[{"match":{"resolution":"720p"},"creditsPerSecond":13},{"match":{"resolution":"1080p"},"creditsPerSecond":19}]}'::jsonb,
  '{"agentSummary":"Kling 4.0 video on Fal. Text-to-video, or image-to-video when a start frame is attached. Optional last frame.","bestFor":["3 to 30 second clips","1080p"],"avoidFor":["motion copy"]}'::jsonb
),
(
  'kling/v4/flash',
  'Kling 4.0 Flash',
  'Faster Kling 4.0 on Fal. 3 to 20 second 720p clips from text or a start frame.',
  'video', 'fal', true, 8, 8,
  '{"parameters":[{"name":"duration","type":"number","label":"Duration","default":5,"min":3,"max":20,"ui_type":"number"},{"name":"resolution","type":"string","label":"Resolution","default":"720p","enum":["720p"],"ui_type":"select"},{"name":"aspect_ratio","type":"string","label":"Aspect Ratio","default":"16:9","enum":["16:9","9:16","1:1","21:9"],"ui_type":"select"}]}'::jsonb,
  ARRAY['16:9','9:16','1:1','21:9'],
  '16:9', true, false, false, true, true, ARRAY[3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], NULL,
  '{"strategy":"per_second","defaultCreditsPerSecond":8,"tiers":[]}'::jsonb,
  '{"agentSummary":"Cheap Kling 4.0 Flash 720p video.","bestFor":["fast drafts","720p"],"avoidFor":["1080p","motion copy"]}'::jsonb
),
(
  'alibaba/wan-3.0',
  'Wan 3.0',
  'Alibaba Wan 3.0 on Fal. Text or first-and-last frame video up to 30 seconds with audio.',
  'video', 'fal', true, 12, 12,
  '{"parameters":[{"name":"duration","type":"number","label":"Duration","default":5,"min":3,"max":30,"ui_type":"number"},{"name":"resolution","type":"string","label":"Resolution","default":"1080p","enum":["480p","720p","1080p"],"ui_type":"select"},{"name":"aspect_ratio","type":"string","label":"Aspect Ratio","default":"adaptive","enum":["adaptive","16:9","4:3","1:1","3:4","9:16"],"ui_type":"select"}]}'::jsonb,
  ARRAY['adaptive','16:9','4:3','1:1','3:4','9:16'],
  'adaptive', true, false, false, true, true, NULL, NULL,
  '{"strategy":"per_second","defaultCreditsPerSecond":12,"tiers":[{"match":{"resolution":"480p"},"creditsPerSecond":4},{"match":{"resolution":"720p"},"creditsPerSecond":8},{"match":{"resolution":"1080p"},"creditsPerSecond":12}]}'::jsonb,
  '{"agentSummary":"Wan 3.0 video on Fal with optional start and end frames.","bestFor":["30 second clips","audio"],"avoidFor":["motion copy"]}'::jsonb
),
(
  'alibaba/wan-3.0-prime',
  'Wan 3.0 Prime',
  'Faster Wan 3.0 Prime on Fal for text and image-to-video up to 30 seconds.',
  'video', 'fal', true, 12, 12,
  '{"parameters":[{"name":"duration","type":"number","label":"Duration","default":5,"min":3,"max":30,"ui_type":"number"},{"name":"resolution","type":"string","label":"Resolution","default":"1080p","enum":["480p","720p","1080p"],"ui_type":"select"},{"name":"aspect_ratio","type":"string","label":"Aspect Ratio","default":"adaptive","enum":["adaptive","16:9","4:3","1:1","3:4","9:16"],"ui_type":"select"}]}'::jsonb,
  ARRAY['adaptive','16:9','4:3','1:1','3:4','9:16'],
  'adaptive', true, false, false, true, true, NULL, NULL,
  '{"strategy":"per_second","defaultCreditsPerSecond":12,"tiers":[{"match":{"resolution":"480p"},"creditsPerSecond":4},{"match":{"resolution":"720p"},"creditsPerSecond":8},{"match":{"resolution":"1080p"},"creditsPerSecond":12}]}'::jsonb,
  '{"agentSummary":"Wan 3.0 Prime, the faster Wan 3.0 video route.","bestFor":["faster wan video"],"avoidFor":["motion copy"]}'::jsonb
),
(
  'blackforestlabs/flux-3-max',
  'FLUX 3 Max',
  'fal''s fast FLUX 3 video model. Text or image to video, 5 to 20 seconds, with native audio.',
  'video', 'fal', true, 14, 14,
  '{"parameters":[{"name":"duration","type":"number","label":"Duration","default":5,"min":5,"max":20,"ui_type":"number"},{"name":"resolution","type":"string","label":"Resolution","default":"720p","enum":["720p","1080p","2K","4K"],"ui_type":"select"},{"name":"aspect_ratio","type":"string","label":"Aspect Ratio","default":"auto","enum":["auto","21:9","2:1","16:9","4:3","1:1","3:4","9:16"],"ui_type":"select"},{"name":"generate_audio","type":"boolean","label":"Audio","default":true,"ui_type":"switch"}]}'::jsonb,
  ARRAY['auto','21:9','2:1','16:9','4:3','1:1','3:4','9:16'],
  'auto', true, false, false, true, true, ARRAY[5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], NULL,
  '{"strategy":"per_second","defaultCreditsPerSecond":14,"tiers":[{"match":{"resolution":"720p"},"creditsPerSecond":14},{"match":{"resolution":"1080p"},"creditsPerSecond":20},{"match":{"resolution":"2k"},"creditsPerSecond":28},{"match":{"resolution":"4k"},"creditsPerSecond":40}]}'::jsonb,
  '{"agentSummary":"FLUX 3 Max fast video. Text-to-video, or image-to-video with an optional end frame.","bestFor":["fast video drafts","native audio"],"avoidFor":["motion copy"]}'::jsonb
),
(
  'minimax/h3-max',
  'MiniMax H3 Max',
  'Faster MiniMax H3 Max text-to-video on Fal, with native audio at 480P, 768P, or 1080P.',
  'video', 'fal', true, 7, 7,
  '{"parameters":[{"name":"duration","type":"number","label":"Duration","default":5,"min":2,"max":15,"ui_type":"number"},{"name":"resolution","type":"string","label":"Resolution","default":"768P","enum":["480P","768P","1080P"],"ui_type":"select"},{"name":"aspect_ratio","type":"string","label":"Aspect Ratio","default":"16:9","enum":["21:9","16:9","4:3","1:1","3:4","9:16"],"ui_type":"select"}]}'::jsonb,
  ARRAY['21:9','16:9','4:3','1:1','3:4','9:16'],
  '16:9', false, false, false, false, false, NULL, NULL,
  '{"strategy":"per_second","defaultCreditsPerSecond":7,"tiers":[]}'::jsonb,
  '{"agentSummary":"MiniMax H3 Max text-to-video. It does not take a start frame; use MiniMax H3 for image-to-video.","bestFor":["fast text-to-video","native audio"],"avoidFor":["image-to-video","motion copy"]}'::jsonb
),
(
  'minimax/h3-max-turbo',
  'MiniMax H3 Max Turbo',
  'Draft-speed MiniMax H3 Max Turbo text-to-video on Fal.',
  'video', 'fal', true, 4, 4,
  '{"parameters":[{"name":"duration","type":"number","label":"Duration","default":5,"min":2,"max":15,"ui_type":"number"},{"name":"resolution","type":"string","label":"Resolution","default":"768P","enum":["480P","768P","1080P"],"ui_type":"select"},{"name":"aspect_ratio","type":"string","label":"Aspect Ratio","default":"16:9","enum":["21:9","16:9","4:3","1:1","3:4","9:16"],"ui_type":"select"}]}'::jsonb,
  ARRAY['21:9','16:9','4:3','1:1','3:4','9:16'],
  '16:9', false, false, false, false, false, NULL, NULL,
  '{"strategy":"per_second","defaultCreditsPerSecond":4,"tiers":[]}'::jsonb,
  '{"agentSummary":"Cheapest MiniMax H3 Max Turbo text-to-video draft model.","bestFor":["draft video"],"avoidFor":["image-to-video"]}'::jsonb
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
