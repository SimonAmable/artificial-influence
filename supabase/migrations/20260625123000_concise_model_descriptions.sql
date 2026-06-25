-- Keep model selector descriptions concise and user-facing.
-- Each description below is five words or fewer.

UPDATE public.models AS model
SET description = updates.description
FROM (
  VALUES
    ('google/nano-banana', 'Fast everyday image generation'),
    ('google/nano-banana-2', 'Fast multi-reference image editing'),
    ('google/nano-banana-pro', 'Premium image generation and editing'),
    ('openai/gpt-image-1.5', 'Precise prompt-following images'),
    ('openai/gpt-image-2', 'Best prompt-following image model'),
    ('bytedance/seedream-4.5', 'Realistic multi-reference image generation'),
    ('bytedance/seedream-5-lite', 'Reasoning-led image generation'),
    ('prunaai/z-image-turbo', 'Ultra-fast image brainstorming'),
    ('prunaai/flux-kontext-fast', 'Fast guided image edits'),
    ('black-forest-labs/flux-2-dev', 'Reference-guided image generation'),
    ('fal-ai/qwen-image-2', 'Flexible reference image editing'),
    ('qwen/qwen-image-edit-plus-lora', 'Reference-guided image editing'),
    ('xai/grok-imagine-image', 'Expressive creative image generation'),
    ('xai/grok-imagine-image-quality', 'Sharper high-resolution Grok images'),
    ('fal-ai/wan/v2.7', 'Flexible image generation and edits'),
    ('fal-ai/wan/v2.7/pro', 'Premium Wan image generation'),
    ('google/veo-3.1-fast', 'Cinematic video with audio'),
    ('kwaivgi/kling-v2.5-turbo-pro', 'Fast cinematic video generation'),
    ('kwaivgi/kling-v2.6', 'Premium image-to-video clips'),
    ('kwaivgi/kling-v2.6-motion-control', 'Legacy reference motion transfer'),
    ('kwaivgi/kling-v3-motion-control', 'Best reference motion transfer'),
    ('kwaivgi/kling-v3-video', 'Cinematic multi-shot videos'),
    ('kwaivgi/kling-v3-omni-video', 'Text, image, video creation'),
    ('minimax/hailuo-2.3-fast', 'Fast image-to-video iteration'),
    ('veed/fabric-1.0', 'Lip-sync videos from audio'),
    ('bytedance/seedance-2.0', 'Flexible multimodal video creation'),
    ('alibaba/happy-horse', 'Versatile Fal video generation'),
    ('prunaai/p-video', 'Flexible prompt and media video'),
    ('xai/grok-imagine-video', 'Creative Grok video generation'),
    ('xai/grok-imagine-video-1.5', 'Improved Grok image animation'),
    ('wan-video/wan-2.7', 'Prompt-to-video with frame control'),
    ('zsxkib/seedvr2', 'Restore and upscale media'),
    ('prunaai/p-image-upscale', 'Fast sharp image upscaling'),
    ('google/gemini-3.1-flash-tts', 'Expressive text-to-speech voices')
) AS updates(identifier, description)
WHERE model.identifier = updates.identifier;

UPDATE public.models
SET description = 'Fast realistic people photos'
WHERE identifier LIKE 'prunaai/z-image-turbo-lora%';
