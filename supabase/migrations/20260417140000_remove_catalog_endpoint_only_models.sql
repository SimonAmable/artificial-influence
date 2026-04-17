-- Remove implementation-only model rows; unified products use fal-ai/qwen-image-2 and wan-video/wan-2.7.
DELETE FROM public.models
WHERE identifier LIKE 'fal-ai/qwen-image-2/%'
   OR identifier IN ('wan-video/wan-2.7-t2v', 'wan-video/wan-2.7-i2v');
