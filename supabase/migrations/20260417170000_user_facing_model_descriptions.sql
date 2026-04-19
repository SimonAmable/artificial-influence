-- Rewrite model descriptions to be user-facing, benefit-driven, and use-case focused.
-- Previous copy was technical (parameter counts, backend endpoints, SDK names).
-- These versions tell users what the model helps them DO and when to pick it.

-- ============================================================================
-- IMAGE MODELS
-- ============================================================================

-- Google Nano Banana, the flagship everyday image model
UPDATE public.models
SET description = 'Everyday go-to for clean, high-quality images from a simple prompt. Great for social posts, thumbnails, and quick concept art when you just want something that looks good.'
WHERE identifier = 'google/nano-banana';

-- Google Nano Banana Pro, top-tier quality, edits with reference images
UPDATE public.models
SET description = 'Top-quality image generation and editing. Reach for this when the result has to look polished, product shots, hero images, brand visuals, or when you need to edit an existing image with tight control.'
WHERE identifier = 'google/nano-banana-pro';

-- Nano Banana 2, fast + reference-heavy editing
UPDATE public.models
SET description = 'Fast, high-quality image generation with powerful editing. Upload up to 14 reference images to blend styles, keep characters consistent across shots, or remix photos you already have.'
WHERE identifier = 'google/nano-banana-2';

-- GPT Image 1.5, best prompt following
UPDATE public.models
SET description = 'Best when the image has to match your prompt exactly, text in images, specific layouts, precise details, and complex scenes. Choose this when other models keep "almost" getting it right.'
WHERE identifier = 'openai/gpt-image-1.5';

-- Seedream 4.5, strong world knowledge, realistic scenes
UPDATE public.models
SET description = 'Realistic scenes with believable spaces, lighting, and real-world detail. Great for lifestyle shots, environments, and anything that needs to feel grounded rather than stylized.'
WHERE identifier = 'bytedance/seedream-4.5';

-- Seedream 5 Lite, reasoning + example-based editing
UPDATE public.models
SET description = 'Smart image model that understands your intent, copies the style of an example image, and can generate matching sets. Use it when you want multiple on-brand images that feel like they belong together.'
WHERE identifier = 'bytedance/seedream-5-lite';

-- Flux Kontext Fast, speed-first editing
UPDATE public.models
SET description = 'Super fast image edits and generations. Pick this when you want to iterate quickly, trying prompts, tweaking details, without waiting.'
WHERE identifier = 'prunaai/flux-kontext-fast';

-- Flux 2 Dev, reference-supported quality
UPDATE public.models
SET description = 'High-quality images with reference image support. A solid all-rounder when you want to guide the look with an example image or do image-to-image edits.'
WHERE identifier = 'black-forest-labs/flux-2-dev';

-- Z-Image Turbo, ultra fast text-to-image
UPDATE public.models
SET description = 'Lightning-fast text-to-image. Perfect for brainstorming, mood boards, and rapid idea exploration when you want lots of options in seconds.'
WHERE identifier = 'prunaai/z-image-turbo';

-- Z-Image Turbo LoRA (realism fast), photorealism preset
UPDATE public.models
SET description = 'Fast photorealistic portraits and lifestyle shots. Pre-tuned for realistic people and skin detail, great when you want believable photos in seconds.'
WHERE identifier LIKE 'prunaai/z-image-turbo-lora%';

-- Grok Imagine (image), xAI creative image model
UPDATE public.models
SET description = 'Creative, bold images from xAI. Good for stylized, expressive, or playful visuals when you want something with personality rather than a straight photo.'
WHERE identifier = 'xai/grok-imagine-image';

-- Qwen Image 2, text-to-image + reference editing
UPDATE public.models
SET description = 'Generate images from text, or upload reference images to edit them. A flexible choice for both fresh creations and touching up existing visuals.'
WHERE identifier = 'fal-ai/qwen-image-2';

-- ============================================================================
-- VIDEO MODELS
-- ============================================================================

-- Veo 3.1 Fast, flagship video with audio
UPDATE public.models
SET description = 'High-fidelity videos with synced, context-aware audio baked in. Great for short cinematic clips, ads, and scenes where sound matters as much as the visuals.'
WHERE identifier = 'google/veo-3.1-fast';

-- Kling 2.5 Turbo Pro, fast T2V / I2V
UPDATE public.models
SET description = 'Fast, cinematic videos from text or a starting image. Strong motion and prompt adherence, a dependable pick when you want good-looking clips quickly.'
WHERE identifier = 'kwaivgi/kling-v2.5-turbo-pro';

-- Kling V2.6 Pro, premium image-to-video
UPDATE public.models
SET description = 'Premium image-to-video with cinematic look, smooth natural motion, and native audio. Turn a still image into a polished short clip.'
WHERE identifier = 'kwaivgi/kling-v2.6';

-- Kling V2.6 Motion Control, transfer motion
UPDATE public.models
SET description = 'Transfer the motion from a reference video onto any image, the character in your image performs the actions from the reference. Great for dances, gestures, and reenactments.'
WHERE identifier = 'kwaivgi/kling-v2.6-motion-control';

-- Kling 3.0 Motion Control, upgraded motion transfer
UPDATE public.models
SET description = 'Make any character move like the one in your reference video. Sharper, more consistent motion transfer with longer clips, ideal for dance, action, and character animation.'
WHERE identifier = 'kwaivgi/kling-v3-motion-control';

-- Kling Video 3.0, cinematic T2V / I2V, up to 15s
UPDATE public.models
SET description = 'Cinematic videos up to 15 seconds with native audio, lip sync, and multi-shot scenes. Pick this when you want a short story, not just a single clip.'
WHERE identifier = 'kwaivgi/kling-v3-video';

-- Kling Video 3.0 Omni, all-in-one video
UPDATE public.models
SET description = 'All-in-one video: text, image, or video input, up to 7 reference images for consistent characters, plus editing, style transfer, and multi-shot mode. Use this when one clip needs to juggle multiple references or styles.'
WHERE identifier = 'kwaivgi/kling-v3-omni-video';

-- Hailuo 2.3 Fast, quick image-to-video iteration
UPDATE public.models
SET description = 'Quick image-to-video iteration. Keeps motion and style consistent while generating faster, so you can try many variations of the same shot without the wait.'
WHERE identifier = 'minimax/hailuo-2.3-fast';

-- Veed Fabric 1.0, lip sync
UPDATE public.models
SET description = 'Make a person in a video lip-sync to any audio. Great for dubbing, voiceovers, and making talking-head videos from a single clip and an audio track.'
WHERE identifier = 'veed/fabric-1.0';

-- Seedance 2.0, multimodal video
UPDATE public.models
SET description = 'Do almost anything with video, generate from text, animate an image, extend an existing clip, or edit one you already have, with synced audio. A Swiss-army-knife for video work.'
WHERE identifier = 'bytedance/seedance-2.0';

-- Grok Imagine Video, xAI video
UPDATE public.models
SET description = 'Create or edit videos with xAI''s Grok. Text-to-video, image-to-video, and video editing in one, good for expressive, creative clips with a bit of personality.'
WHERE identifier = 'xai/grok-imagine-video';

-- Wan 2.7, Alibaba text/image-to-video
UPDATE public.models
SET description = 'Generate video from a prompt, or drop in a starting image to bring it to life. Optional ending frame and audio for finer control over how the clip plays out.'
WHERE identifier = 'wan-video/wan-2.7';

-- ============================================================================
-- UPSCALE / UTILITY MODELS
-- ============================================================================

-- SeedVR2, creative upscale + restoration
UPDATE public.models
SET description = 'Make images bigger and sharper, and clean up blurry or damaged ones. Use this to rescue old photos or bump up resolution before printing or posting.'
WHERE identifier = 'zsxkib/seedvr2';
