-- DB-backed model guidance for UniCan's creative agent.
-- This column is intentionally separate from public descriptions and provider
-- parameters: it teaches the LLM when to choose a model and how to map user
-- intent to tool inputs.

ALTER TABLE public.models
  ADD COLUMN IF NOT EXISTS agent_usage JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.models.agent_usage IS
  'Compact model-specific guidance for LLM agents: selection, input semantics, routing rules, prompt advice, and pitfalls.';

UPDATE public.models AS m
SET
  agent_usage = v.agent_usage,
  updated_at = timezone('utc'::text, now())
FROM (
  VALUES
  (
    'google/nano-banana',
    $json${
      "agentSummary": "Fast conversational image generation and editing. Best when the user wants practical image edits, character/product consistency, or iterative visual changes without needing the most expensive model.",
      "bestFor": ["quick image edits", "character consistency", "product variations", "multi-turn creative iteration", "style transfer"],
      "avoidFor": ["highest-fidelity typography or dense infographics when Nano Banana Pro, Nano Banana 2, GPT Image 2, or Qwen Image 2 is available", "video"],
      "inputSemantics": {
        "prompt": "Natural-language creation or edit instruction.",
        "image_input": "Reference/edit images. Tell the model what to change and what to preserve.",
        "aspect_ratio": "Use match_input_image for edits unless the user asks for a new format."
      },
      "routingRules": [
        "Use for everyday reference-image edits and fast iterations.",
        "When editing, pass the user image as referenceIds and set aspectRatio to match_input_image unless the user requests a target ratio.",
        "Prefer Nano Banana Pro, Nano Banana 2, GPT Image 2, Qwen Image 2, or Seedream 4.5 when the request emphasizes text rendering, layouts, or production fidelity."
      ],
      "promptGuidance": [
        "Use direct edit language: change X to Y, keep A/B/C unchanged.",
        "For identity or product preservation, explicitly say which details must remain identical.",
        "Avoid keyword stuffing; write natural instructions."
      ],
      "pitfalls": ["Do not assume attached images are auto-used; pass referenceIds.", "Do not use for video animation."]
    }$json$::jsonb
  ),
  (
    'google/nano-banana-pro',
    $json${
      "agentSummary": "Premium Google image generation/editing model for professional creative control, text rendering, multi-image blending, and high-resolution outputs.",
      "bestFor": ["posters and ads with readable text", "brand mockups", "infographics", "multi-image blending", "high-resolution image edits", "professional product visuals"],
      "avoidFor": ["cheap rough drafts where Nano Banana or Z-Image Turbo is enough", "transparent-background requirements", "video"],
      "inputSemantics": {
        "prompt": "Detailed visual brief or edit instruction. Exact visible text should be in quotes.",
        "image_input": "Up to many images for blending, editing, style, products, or people; label roles in the prompt.",
        "resolution": "Use 2K or 4K for final assets; use lower/faster options for drafts.",
        "aspect_ratio": "Use match_input_image for source-image edits unless a target layout is requested."
      },
      "routingRules": [
        "Choose when the user asks for best quality, typography, brand assets, infographics, product mockups, or complex multi-reference editing.",
        "Use for generation and editing; references should be described by role, not just attached.",
        "For factual/current infographic content, warn that generated facts should be checked unless separate web grounding/data verification is performed."
      ],
      "promptGuidance": [
        "Put exact text in double quotes and specify typography, hierarchy, and placement.",
        "For edits, state what to change and what must remain unchanged.",
        "For multi-reference work, label references by order: image 1 subject, image 2 style, image 3 product, etc."
      ],
      "pitfalls": ["May produce artifacts with very complex masked-style edits or many references.", "Character consistency is strong but not guaranteed.", "Do not claim factual accuracy for generated charts without verification."]
    }$json$::jsonb
  ),
  (
    'google/nano-banana-2',
    $json${
      "agentSummary": "High-efficiency Google image model with strong text rendering, multi-image fusion, character consistency, broad aspect ratios, and optional Google grounding flags in the backend.",
      "bestFor": ["fast high-quality image generation", "multilingual text in images", "multi-reference compositions", "character or object consistency", "wide/tall unusual aspect ratios"],
      "avoidFor": ["absolute top-end final polish when Nano Banana Pro is explicitly preferred", "transparent-background requests", "video"],
      "inputSemantics": {
        "prompt": "Natural-language generation/edit instruction. Put exact image text in quotes.",
        "image_input": "Reference or edit images; up to 14 according to provider docs.",
        "aspect_ratio": "Supports standard ratios plus extreme wide/tall ratios in provider docs; match_input_image is best for edits.",
        "resolution": "Use 1K for normal work, 2K/4K for final assets, 512 for fast drafts."
      },
      "routingRules": [
        "Prefer over original Nano Banana when the user asks for better fidelity, text, or more aspect-ratio flexibility.",
        "Use for text-heavy social graphics if GPT Image 2/Qwen Image 2 are not specifically requested.",
        "Use referenceIds for every image the user wants incorporated; do not rely on attachment memory."
      ],
      "promptGuidance": [
        "Use clear natural-language briefs, not tag lists.",
        "For text, quote exact copy and describe layout constraints.",
        "For edits, include preserve clauses for face, pose, product geometry, colors, or camera angle."
      ],
      "pitfalls": ["Grounding/search flags are provider-specific and should only be used when the user wants current/real-world context.", "Generated facts and small text still need review."]
    }$json$::jsonb
  ),
  (
    'bytedance/seedream-4.5',
    $json${
      "agentSummary": "High-fidelity ByteDance image model for spatial reasoning, world knowledge, reference consistency, professional visual creatives, and multi-image editing.",
      "bestFor": ["reference-preserving edits", "commercial creatives", "spatially complex scenes", "dense text or typography compared with older image models", "consistent characters/products"],
      "avoidFor": ["very cheap drafts", "video", "when the user needs sub-second speed"],
      "inputSemantics": {
        "prompt": "Natural-language visual brief or edit instruction.",
        "image_input": "One or more source/reference images; can be used for editing, consistency, or multi-reference generation.",
        "size": "2K default; 4K or custom where supported for final assets.",
        "sequential_image_generation": "Use auto only when the user asks for a set, sequence, variations, story panels, or multiple related outputs."
      },
      "routingRules": [
        "Choose for high-quality, consistent image edits where preserving reference details matters.",
        "Use when prompt involves spatial relationships, product scenes, architecture/interiors, or professional ad visuals.",
        "Prefer match_input_image for edits unless the target format is explicit."
      ],
      "promptGuidance": [
        "Use prose instructions; include subject, composition, lighting, material, and exact preservation requirements.",
        "For text, quote the desired words and specify style/placement.",
        "For multi-image edits, describe the role of each input image."
      ],
      "pitfalls": ["Do not enable multi-image sequence mode for a single requested output.", "Reference order matters; label it in the prompt."]
    }$json$::jsonb
  ),
  (
    'bytedance/seedream-5-lite',
    $json${
      "agentSummary": "ByteDance Seedream 5.0-lite style image model for reasoning-heavy generation, example-based editing, and coherent image sets.",
      "bestFor": ["reasoning-heavy image prompts", "example-based edits", "material/style transformations", "coherent sets or sequences", "2K/3K output"],
      "avoidFor": ["simple fastest drafts", "video", "transparent background work"],
      "inputSemantics": {
        "prompt": "Conversational image brief; use natural language rather than tags.",
        "image_input": "Source images, reference images, or before/after examples for example-based editing.",
        "sequential_image_generation": "Use auto for requested sets, panels, variations, or related outputs.",
        "size": "Use 2K by default; 3K for final detail."
      },
      "routingRules": [
        "Choose when the request involves logic, before/after examples, spatial relationships, or coherent series generation.",
        "For example-based editing, pass the before/after example pair plus target image and explain the transformation.",
        "For exact one-off edits, state what to preserve."
      ],
      "promptGuidance": [
        "Write natural instructions with context and purpose.",
        "Put desired visible text in quotes.",
        "Tell the model what not to change in edits."
      ],
      "pitfalls": ["Your app identifier is bytedance/seedream-5-lite while provider docs may expose bytedance/seedream-5; keep the app identifier in tool calls.", "Do not use sequence mode unless multiple outputs are desired."]
    }$json$::jsonb
  ),
  (
    'prunaai/z-image-turbo',
    $json${
      "agentSummary": "Very fast text-to-image model for cheap drafts and quick ideation. It does not use reference images.",
      "bestFor": ["rapid concept thumbnails", "cheap prompt exploration", "simple text-to-image drafts", "fast variations"],
      "avoidFor": ["image editing", "reference-image consistency", "complex text rendering", "final brand assets", "video"],
      "inputSemantics": {
        "prompt": "Text-only image prompt.",
        "width": "Output width in pixels.",
        "height": "Output height in pixels.",
        "guidance_scale": "Should stay 0 for Turbo behavior.",
        "num_inference_steps": "Default around 8 is fast; increasing may slow without proportional quality gains."
      },
      "routingRules": [
        "Use only when no references are required.",
        "Pick dimensions from requested aspect ratio; do not pass referenceIds.",
        "Escalate to Flux, GPT Image, Nano Banana, Qwen, or Seedream for edits or precise outputs."
      ],
      "promptGuidance": ["Short, concrete visual prompts work best.", "Avoid overloading with many constraints."],
      "pitfalls": ["No reference-image support.", "Guidance scale should remain 0 for Turbo models."]
    }$json$::jsonb
  ),
  (
    'prunaai/z-image-turbo-lora:197b2db2015aa366d2bc61a941758adf4c31ac66b18573f5c66dc388ab081ca2',
    $json${
      "agentSummary": "Fast Z-Image Turbo LoRA preset named realism fast. Text-only photorealistic generation with preconfigured LoRA weights.",
      "bestFor": ["fast photorealistic drafts", "influencer-style portraits", "cheap realism variations"],
      "avoidFor": ["reference-image edits", "brand/product fidelity", "text-heavy designs", "video"],
      "inputSemantics": {
        "prompt": "Text-only image prompt.",
        "lora_weights": "Preconfigured by model parameters; do not override unless the user explicitly asks for LoRA control.",
        "lora_scales": "Preconfigured; keep aligned with lora_weights.",
        "guidance_scale": "Should stay 0 for Turbo behavior.",
        "width_height": "Use explicit width/height for target aspect ratio."
      },
      "routingRules": [
        "Use for fast realism when the user does not need an existing image preserved.",
        "Do not pass references; choose another model for image editing.",
        "Keep the full versioned identifier when calling Replicate."
      ],
      "promptGuidance": ["Describe subject, camera, lens, lighting, styling, and background.", "Use concise photoreal language instead of long contradictory style stacks."],
      "pitfalls": ["Versioned identifier is required.", "No image reference support.", "LoRA preset may bias outputs toward its trained style."]
    }$json$::jsonb
  ),
  (
    'xai/grok-imagine-image',
    $json${
      "agentSummary": "xAI image model for text-to-image and reference-assisted image generation/editing. Useful for stylized, photoreal, anime, and flexible creative outputs.",
      "bestFor": ["fast creative image generation", "style variations", "reference-assisted image edits", "photoreal or stylized social content"],
      "avoidFor": ["high-assurance brand safety", "sensitive likeness work", "precise typography where GPT Image/Qwen/Nano Banana Pro fit better", "video"],
      "inputSemantics": {
        "prompt": "Describe intended result naturally.",
        "reference_images": "Used through xAI provider options in this app. State how strongly to follow the source image.",
        "reference_strength": "weak/moderate/strong if exposed; strong for preservation, weak for inspiration.",
        "detail_level": "Use high for detailed scenes, balanced by default."
      },
      "routingRules": [
        "Use when the user specifically asks for Grok Imagine image or wants its look.",
        "Prefer other image models for strict text rendering, brand-safe production assets, or tightly controlled edits.",
        "For references, explicitly describe preserve/change behavior."
      ],
      "promptGuidance": ["Use one clear creative direction.", "Mention style family if needed: photorealistic, anime, illustration, surreal, retro, commercial."],
      "pitfalls": ["Be cautious with public figures, sexualized content, and sensitive likeness requests.", "Do not overpromise policy or moderation behavior."]
    }$json$::jsonb
  ),
  (
    'openai/gpt-image-1.5',
    $json${
      "agentSummary": "OpenAI image model focused on fast, precise editing, instruction following, detail preservation, and transparent-background support where available.",
      "bestFor": ["precise photo edits", "try-ons", "style filters that preserve the original", "transparent PNG needs", "faster OpenAI image workflows"],
      "avoidFor": ["GPT Image 2-only highest quality requests", "video", "very large multi-reference compositions if another model supports more references better"],
      "inputSemantics": {
        "prompt": "Specific generation or edit instruction.",
        "reference_images": "Input images for edits/compositions.",
        "aspect_ratio": "Use supported ratios only.",
        "transparent_background": "Prefer this model over GPT Image 2 if transparent background is required and the app supports it."
      },
      "routingRules": [
        "Choose when the user requests OpenAI image generation and needs transparent background or fast precise edits.",
        "Prefer GPT Image 2 for state-of-the-art OpenAI fidelity when transparency is not needed.",
        "For edits, explicitly lock unchanged details."
      ],
      "promptGuidance": ["Say exactly what to change and what to keep.", "Quote exact text for image typography."],
      "pitfalls": ["Do not select GPT Image 2 for transparent backgrounds; use GPT Image 1.5 if available.", "Verify app parameter support before promising transparency."]
    }$json$::jsonb
  ),
  (
    'openai/gpt-image-2',
    $json${
      "agentSummary": "OpenAI state-of-the-art image generation/editing model with strong prompt following, sharp text rendering, high-fidelity inputs, and precise edits. No transparent background support.",
      "bestFor": ["text-heavy designs", "logos and layouts", "precise image edits", "photoreal product scenes", "UI mockups", "multi-image composition", "final OpenAI image output"],
      "avoidFor": ["transparent backgrounds", "video", "very cheap drafts"],
      "inputSemantics": {
        "prompt": "Clear generation or edit instruction. Put exact visible text in quotes.",
        "input_images": "One or more reference/edit images; the model preserves high-fidelity details automatically.",
        "aspect_ratio": "Only 1:1, 3:2, or 2:3 in this app's Replicate adapter.",
        "quality": "low for speed/cost, high or auto for final quality.",
        "background": "auto or opaque; transparent output is not supported.",
        "number_of_images": "Use multiple only when variants are requested."
      },
      "routingRules": [
        "Choose for precise edits, text rendering, marketing graphics, product mockups, and OpenAI-preferred image work.",
        "Do not route transparent background requests here; use GPT Image 1.5 or another transparent-capable path.",
        "When editing, include preserve clauses for identity, pose, lighting, composition, and product details."
      ],
      "promptGuidance": [
        "Use specific instructions instead of broad requests like make it better.",
        "For realism, include lens/framing/lighting language.",
        "For multiple inputs, label each image role in the prompt."
      ],
      "pitfalls": ["Only 1:1/3:2/2:3 aspect ratios are supported by this app adapter.", "No transparent backgrounds.", "Generated facts/text should be reviewed."]
    }$json$::jsonb
  ),
  (
    'black-forest-labs/flux-2-dev',
    $json${
      "agentSummary": "FLUX.2 Dev is a high-quality image generation/editing model with multi-reference support, photorealism, text rendering, and strong spatial understanding.",
      "bestFor": ["product photography", "brand-consistent visuals", "multi-reference compositions", "character consistency", "UI/mockup images", "photoreal concept art"],
      "avoidFor": ["cheapest drafts", "video", "strict transparent-background work"],
      "inputSemantics": {
        "prompt": "Detailed natural-language prompt or edit instruction.",
        "image_input": "Reference/edit images; provider docs mention up to 10 references.",
        "aspect_ratio": "Use match_input_image for edits or requested output ratio for text-to-image.",
        "go_fast": "Use true for speed unless final quality is more important."
      },
      "routingRules": [
        "Choose for high-quality multi-reference image work where product/character/style consistency matters.",
        "Use for photoreal and design images with complex composition.",
        "Prefer GPT Image 2/Qwen/Nano Banana Pro for maximum typography-specific requests if requested."
      ],
      "promptGuidance": [
        "Describe exact role of each reference image.",
        "Use preservation language for edits.",
        "For product shots, specify material, lighting, camera, background, and brand constraints."
      ],
      "pitfalls": ["Editing large images may be slower.", "Do not assume unlimited references; keep inputs focused."]
    }$json$::jsonb
  ),
  (
    'fal-ai/qwen-image-2',
    $json${
      "agentSummary": "Fal-hosted Qwen Image 2 unified generation/editing model with strong prompt understanding, text rendering, structured layouts, and natural-language editing.",
      "bestFor": ["text rendering", "structured layouts", "posters", "infographics", "precise natural-language edits", "2K images", "fast edit iteration"],
      "avoidFor": ["masked editing workflows", "video", "transparent-background promises"],
      "inputSemantics": {
        "prompt": "Can be conversational and long; provider guidance supports up to about 1000 prompt tokens.",
        "image_urls": "When references are present the backend routes to edit; describe edit and preservation targets.",
        "num_images": "Use 2-3 for comparing edit variants when user wants options.",
        "guidance_scale": "If exposed, lower for loose creative style transfer, higher for strict adherence but possible artifacts."
      },
      "routingRules": [
        "Choose for text-heavy image generation, layout work, and instruction-based image editing without masks.",
        "For edits, provide a source image and describe the desired change; no mask is needed.",
        "Use text-to-image endpoint when no references exist and edit endpoint when references exist; app handles this under the canonical id."
      ],
      "promptGuidance": [
        "Specify both the change and what to preserve.",
        "For typography, quote exact copy and describe hierarchy, alignment, and style.",
        "Avoid vague prompts like improve this; name the concrete visual changes."
      ],
      "pitfalls": ["Do not pass endpoint-specific ids to the catalog; use fal-ai/qwen-image-2.", "More strict guidance can add artifacts."]
    }$json$::jsonb
  ),
  (
    'minimax/hailuo-2.3-fast',
    $json${
      "agentSummary": "Lower-latency Hailuo image-to-video model for fast animation of a first-frame image with strong visual consistency.",
      "bestFor": ["fast image-to-video iteration", "realistic human motion", "cinematic movement from a still", "stylized motion tests"],
      "avoidFor": ["text-to-video without an image", "last-frame control", "long videos beyond 10 seconds", "native reference-video editing"],
      "inputSemantics": {
        "first_frame_image": "Required for the fast variant; output follows this image aspect ratio.",
        "prompt": "Describe motion/action/camera, not just the image contents.",
        "resolution": "768p default; 1080p is limited to 6 seconds.",
        "duration": "6 or 10 seconds in provider docs; 10 seconds only at 768p.",
        "prompt_optimizer": "Keep on for vague prompts, off when user demands exact wording."
      },
      "routingRules": [
        "Use when the user provides or selects an image and wants quick animation.",
        "Do not choose for pure text-to-video; choose Kling/Veo/Grok/Seedance/Wan instead.",
        "If the user asks for an exact ending frame, choose Veo, Kling, Seedance, or Wan."
      ],
      "promptGuidance": ["Focus on one main motion, camera move, and mood.", "Use image-aware phrasing: animate this scene by..."],
      "pitfalls": ["Fast variant is image-only according to provider docs.", "No last-frame support.", "1080p should stay short."]
    }$json$::jsonb
  ),
  (
    'google/veo-3.1-fast',
    $json${
      "agentSummary": "Fast Google Veo 3.1 video model for text-to-video, image-to-video, start/end frame transitions, and synchronized native audio.",
      "bestFor": ["rapid high-quality video generation", "native audio", "image-to-video", "start/end frame interpolation", "short cinematic clips", "reference-guided character/style consistency"],
      "avoidFor": ["clips longer than supported duration", "complex video editing from an existing clip if Seedance/Kling Omni/Grok fit better", "cases needing more than a few reference images"],
      "inputSemantics": {
        "prompt": "Describe visuals, motion, camera, and desired audio.",
        "image": "Starting image / image-to-video source.",
        "last_frame": "Ending image for transition; should be paired with image.",
        "duration": "Provider docs list 4, 6, or 8 seconds.",
        "resolution": "720p or 1080p.",
        "generate_audio": "True when the user wants sound/dialogue/ambience; false for silent clips."
      },
      "routingRules": [
        "Choose for fast polished short videos with audio.",
        "Use image + last_frame only when the user wants a transition from one image to another.",
        "If the user wants a reference image that is not the first frame, verify whether the tool supports reference_images; current chat adapter maps primary image to image."
      ],
      "promptGuidance": [
        "Include camera angle, movement, lighting, mood, subject action, and audio cues.",
        "For image-to-video, describe what should change/move rather than re-describing the source image.",
        "For frame-to-frame, request physically plausible transition."
      ],
      "pitfalls": ["Image input acts as start frame in the current app adapter.", "Last frame requires a compatible start image.", "All outputs are Google SynthID-watermarked according to docs."]
    }$json$::jsonb
  ),
  (
    'kwaivgi/kling-v2.6',
    $json${
      "agentSummary": "Kling 2.6 Pro video model for text-to-video or image-to-video with cinematic motion and native audio up to about 10 seconds.",
      "bestFor": ["cinematic image-to-video", "native sound effects/dialogue", "smooth motion", "realistic short clips"],
      "avoidFor": ["reference-video motion transfer", "multimodal editing", "longer than 10 seconds", "strict last-frame workflows if another model fits better"],
      "inputSemantics": {
        "start_image": "First frame / image-to-video source.",
        "prompt": "Describe action, camera, scene, and sound if generate_audio is true.",
        "duration": "5 or 10 seconds.",
        "aspect_ratio": "Ignored when start_image is provided.",
        "generate_audio": "Enable for native audio; prompt should include audio direction."
      },
      "routingRules": [
        "Use for general cinematic video and image-to-video when native audio is desired.",
        "Do not use for motion-copy from a reference video; choose Kling motion-control.",
        "Use newer Kling v3 video for multi-shot or longer/more advanced workflows."
      ],
      "promptGuidance": ["Write a scene brief with subject, action, camera, lighting, and audio.", "For dialogue, quote the spoken line."],
      "pitfalls": ["Aspect ratio is not a control when using a start image.", "Do not confuse start_image with loose visual reference."]
    }$json$::jsonb
  ),
  (
    'kwaivgi/kling-v2.5-turbo-pro',
    $json${
      "agentSummary": "Kling 2.5 Turbo Pro is a fast text-to-video and image-to-video model with start-image and optional end-image control.",
      "bestFor": ["fast Kling-style video", "image-to-video", "simple start/end frame control", "cost-conscious cinematic drafts"],
      "avoidFor": ["native reference-video editing", "complex multi-shot v3 workflows", "audio-specific requests if v2.6/v3/Veo/Seedance are better"],
      "inputSemantics": {
        "start_image": "First frame; use for image-to-video.",
        "end_image": "Ending frame if user wants the clip to land on a specific image.",
        "aspect_ratio": "Ignored if start_image is provided.",
        "duration": "Typically 5 seconds in provider schema; only use supported options.",
        "negative_prompt": "Use for unwanted visual artifacts or exclusions."
      },
      "routingRules": [
        "Choose for fast visual-only Kling animation or simple first/end frame control.",
        "Use Kling v3 video when multi-shot, native audio, or stronger consistency is requested.",
        "Use motion-control model when a reference video should drive movement."
      ],
      "promptGuidance": ["Describe motion and camera clearly.", "Use negativePrompt only for visual exclusions, not to steer core action."],
      "pitfalls": ["Provider schema marks image as deprecated; use start_image.", "Aspect ratio is ignored with start_image."]
    }$json$::jsonb
  ),
  (
    'kwaivgi/kling-v2.6-motion-control',
    $json${
      "agentSummary": "Deprecated Kling motion-control model. Transfers motion from a reference video to a character/reference image; prefer Kling 3.0 Motion Control.",
      "bestFor": ["legacy motion transfer", "image plus reference-video animation"],
      "avoidFor": ["new work when kwaivgi/kling-v3-motion-control is active", "text-to-video", "single-image animation without motion video"],
      "inputSemantics": {
        "image": "Character/subject appearance source.",
        "video": "Motion source to imitate.",
        "character_orientation": "video follows reference video orientation; image preserves still-image orientation with shorter cap.",
        "mode": "std for faster/lower-res, pro for higher quality."
      },
      "routingRules": [
        "Prefer kwaivgi/kling-v3-motion-control unless user explicitly wants v2.6.",
        "Require both image and video references.",
        "Use only for motion transfer, not general video generation."
      ],
      "promptGuidance": ["Keep prompt aligned with the reference motion.", "Mention background/style if it should differ from source video."],
      "pitfalls": ["Deprecated.", "Needs both image and video.", "Image/video body framing mismatch hurts results."]
    }$json$::jsonb
  ),
  (
    'kwaivgi/kling-v3-motion-control',
    $json${
      "agentSummary": "Kling 3.0 Motion Control transfers motion from a reference video onto the character/subject from an image with improved consistency and 720p/1080p modes.",
      "bestFor": ["dance transfer", "gesture transfer", "character animation from motion video", "mascot/person animation", "reference-video driven movement"],
      "avoidFor": ["text-to-video without both references", "image-to-video without a motion source", "video editing/restyling"],
      "inputSemantics": {
        "image": "Character/subject appearance image.",
        "video": "Reference motion video.",
        "character_orientation": "video matches reference video orientation and allows longer reference videos; image keeps still-image orientation but has shorter cap.",
        "mode": "std for 720p/cost-effective, pro for 1080p/higher quality.",
        "keep_original_sound": "Preserve audio from reference video if desired."
      },
      "routingRules": [
        "Only call when both an image reference and a video reference are available.",
        "Use when the user says copy this motion, make this character do this dance/move, or animate with the same movement.",
        "Default characterOrientation to video unless the user explicitly wants the still image orientation locked."
      ],
      "promptGuidance": [
        "Reference the motion concept in the prompt but do not over-describe contradictory actions.",
        "Use clear, full-body, unobstructed character images and steady motion references when possible."
      ],
      "pitfalls": ["Poor body/framing match between source image and motion video reduces quality.", "Do not use for normal I2V.", "Requires explicit referenceIds and referenceVideoIds."]
    }$json$::jsonb
  ),
  (
    'veed/fabric-1.0',
    $json${
      "agentSummary": "VEED Fabric 1.0 is specialized for talking-head/influencer/avatar videos from an image plus voice audio.",
      "bestFor": ["talking-head videos", "avatar/influencer speech", "creator-style social clips", "voice-driven lip movement"],
      "avoidFor": ["general cinematic video", "text-to-video", "motion transfer", "silent image animation"],
      "inputSemantics": {
        "image": "Portrait/avatar source image in dedicated lipsync flows.",
        "audio": "Speech audio that drives the talking video in dedicated lipsync flows.",
        "resolution": "480p or 720p."
      },
      "routingRules": [
        "Use only through a tool/API path that supplies both source image and speech audio.",
        "If the chat generateVideo tool cannot pass Fabric's required image/audio pair, do not choose this model for generic generation.",
        "For general video, choose Kling, Veo, Seedance, Wan, Hailuo, or Grok."
      ],
      "promptGuidance": ["Keep any script/audio direction separate from visual portrait instructions.", "Use clean portrait images and clean speech audio."],
      "pitfalls": ["Not a general video model.", "Generic generateVideo support may be incomplete without a lipsync-specific tool."]
    }$json$::jsonb
  ),
  (
    'xai/grok-imagine-video',
    $json${
      "agentSummary": "Grok Imagine Video animates images, generates short videos, and edits existing clips with native synchronized audio. Strong for simple image-to-video motion and creative restyles.",
      "bestFor": ["image-to-video with audio", "short cinematic animations", "video edits up to 8.7 seconds", "style restyling", "simple one-subject action"],
      "avoidFor": ["complex multi-action scenes", "strict negative prompting", "high-assurance safety-sensitive content", "long clips"],
      "inputSemantics": {
        "image": "Input image for image-to-video; prompt should focus on motion.",
        "video": "Input video for editing; max about 8.7 seconds and output matches duration/ratio/resolution.",
        "duration": "1-15 seconds for generation; ignored in video editing.",
        "aspect_ratio": "For T2V; image/video inputs determine ratio.",
        "resolution": "480p or 720p."
      },
      "routingRules": [
        "Use when the user asks for Grok video, wants to animate an image with audio, or wants a simple video edit/restyle.",
        "For image-to-video, do not re-describe the source image; describe motion/camera/audio.",
        "For video edits, describe what changes and what should remain."
      ],
      "promptGuidance": [
        "Use one main subject, one primary action, one camera move.",
        "Avoid tag stacking and negative prompts; say what should happen.",
        "Mention lighting/time of day and audio mood."
      ],
      "pitfalls": ["Negative prompts are ignored according to provider guidance.", "Shorter clips are more stable.", "Use caution with sensitive likeness/sexualized requests."]
    }$json$::jsonb
  ),
  (
    'kwaivgi/kling-v3-video',
    $json${
      "agentSummary": "Kling Video 3.0 generates cinematic videos up to 15 seconds from text or start/end images, with native audio and multi-shot control.",
      "bestFor": ["cinematic text-to-video", "image-to-video", "multi-shot clips", "native audio/dialogue", "short narrative sequences", "start/end frame control"],
      "avoidFor": ["reference-video editing or style transfer where Kling Omni is better", "motion-copy from a reference video where motion-control is needed"],
      "inputSemantics": {
        "start_image": "Starting frame for image-to-video.",
        "end_image": "Optional final frame.",
        "multi_prompt": "JSON shot list for multi-shot mode; shot durations should add up to total duration.",
        "duration": "3-15 seconds.",
        "generate_audio": "Enable for dialogue/SFX/music; describe audio in prompt."
      },
      "routingRules": [
        "Use for polished Kling v3 text/image-to-video and multi-shot generation.",
        "Use multi_prompt only when the user requests multiple shots/scenes or a clear sequence.",
        "Use Kling Omni when reference images/videos should guide character/style or edit existing video."
      ],
      "promptGuidance": [
        "Structure prompts with scene, subject, action, camera, lighting, mood, and audio.",
        "For dialogue, quote spoken lines.",
        "For multi-shot, keep each shot concise and timed."
      ],
      "pitfalls": ["Do not pass arbitrary reference images to this model as loose references; use start/end image semantics.", "Multi-shot durations must be coherent."]
    }$json$::jsonb
  ),
  (
    'kwaivgi/kling-v3-omni-video',
    $json${
      "agentSummary": "Kling 3.0 Omni is a unified multimodal video model for text, start/end images, reference images, reference-video editing/style, native audio, and multi-shot control.",
      "bestFor": ["reference-image video generation", "consistent characters", "video editing", "style/camera reference from a clip", "multi-shot brand/narrative videos", "native audio when no reference video is used"],
      "avoidFor": ["simple cheap drafts", "motion-copy dance transfer where Kling motion-control is more direct", "using native audio together with reference video"],
      "inputSemantics": {
        "start_image": "First frame for image-to-video.",
        "end_image": "Optional final frame.",
        "reference_images": "Loose character/style/object references; refer to them as <<<image_1>>> etc. in the prompt.",
        "reference_video": "Video source for editing or style/camera reference.",
        "video_reference_type": "base means edit the supplied video; feature means use video as style/camera reference.",
        "generate_audio": "Native audio is mutually exclusive with reference video in provider docs.",
        "keep_original_sound": "Use when editing a reference video and preserving its audio is desired."
      },
      "routingRules": [
        "Use when the user says use this image as a reference, not necessarily as first frame.",
        "Use video_reference_type=base for edit this video; feature for use this video as motion/style/camera reference.",
        "If a reference video is supplied, do not enable native audio; use keepOriginalSound when requested."
      ],
      "promptGuidance": [
        "Label reference images in prompt using the provider format where possible.",
        "For edits, say what to change and what to keep.",
        "For character consistency, use clear well-lit references."
      ],
      "pitfalls": ["Native audio cannot be used with reference video.", "Reference video should be short and within provider limits.", "Current chat adapter separates first/second/additional images; use explicit role support when available."]
    }$json$::jsonb
  ),
  (
    'bytedance/seedance-2.0',
    $json${
      "agentSummary": "ByteDance multimodal video model with text, first/last frame, reference images, reference videos, reference audio, native synchronized audio, editing, and extension.",
      "bestFor": ["multimodal reference video", "image/video/audio references", "native audio", "video editing", "video extension", "character consistency", "music/rhythm synced video"],
      "avoidFor": ["cheap quick drafts", "when the user explicitly wants an image only as first frame but another model is simpler", "motion-copy dance transfer where Kling motion-control is more direct"],
      "inputSemantics": {
        "image": "First-frame image for image-to-video; this pins frame 1.",
        "last_frame_image": "Ending frame; use with image/first frame.",
        "reference_images": "Loose character/style/object references; not forced as frame 1. Prompt can refer to [Image1], [Image2].",
        "reference_videos": "Reference clips for editing, extension, motion/style, or source video. Prompt can refer to [Video1].",
        "reference_audios": "Reference audio/rhythm/voice; requires at least one visual anchor. Prompt can refer to [Audio1].",
        "duration": "-1 lets the model choose; 5 seconds is good for experiments.",
        "aspect_ratio": "adaptive is useful when references should determine framing.",
        "generate_audio": "Enable for dialogue/SFX/music generated with the video."
      },
      "routingRules": [
        "Critical: if the user says use an image as a reference, route it to reference_images, not image.",
        "Only use image when the user says first frame, start with this image, animate this exact still from frame 1, or similar.",
        "Use reference_videos for edit/extend/use this clip as reference.",
        "Use reference_audios only with a visual anchor and mention [Audio1] in the prompt.",
        "For dialogue, put spoken words in double quotes."
      ],
      "promptGuidance": [
        "Label multimodal inputs explicitly: [Image1], [Video1], [Audio1].",
        "For editing, describe what to change and what to keep.",
        "Start with 5 seconds while testing, then increase or use -1 for model-chosen duration."
      ],
      "pitfalls": ["Do not collapse reference image intent into first-frame image.", "Reference audio fails without a visual anchor.", "A current chat adapter may need explicit image role support to avoid first-frame misuse."]
    }$json$::jsonb
  ),
  (
    'wan-video/wan-2.7',
    $json${
      "agentSummary": "Unified app id for Wan 2.7 video. Backend routes to text-to-video or image-to-video. Supports first frame, optional last frame, optional audio, prompt expansion, and 2-15 second clips.",
      "bestFor": ["high-quality text-to-video", "first-frame image-to-video", "first/last frame transitions", "audio-synchronized video", "2-15 second clips"],
      "avoidFor": ["loose reference-image guidance", "reference-video editing", "motion-copy from video", "non-HTTP blob/data media URLs"],
      "inputSemantics": {
        "first_frame": "If present, backend routes to Wan I2V and uses it as the starting image.",
        "last_frame": "Optional ending image; requires first_frame.",
        "audio": "Optional public audio URL for synchronization.",
        "aspect_ratio": "Used only in text-to-video when no first frame is set.",
        "enable_prompt_expansion": "On by default; disable for exact user wording."
      },
      "routingRules": [
        "Use first-frame mode only when the user wants the image to be the starting frame.",
        "Do not use for loose image references; choose Seedance or Kling Omni when reference semantics are needed.",
        "Reject or upload blob/data URLs before calling; Replicate requires public http(s) media."
      ],
      "promptGuidance": ["Describe motion/action/camera and audio timing.", "For first/last frame, request a physically plausible transition."],
      "pitfalls": ["Image input is first_frame, not a loose reference.", "Last frame requires first frame.", "Audio and images must be public HTTP(S) URLs after upload."]
    }$json$::jsonb
  ),
  (
    'zsxkib/seedvr2',
    $json${
      "agentSummary": "Creative Upscale uses SeedVR2 for one-step image/video restoration, upscaling, sharpening, and optional color correction while preserving video audio.",
      "bestFor": ["upscaling existing images", "restoring low-quality video", "sharpening footage", "color-fix restoration", "fast cleanup"],
      "avoidFor": ["new image generation", "creative edits that change content", "text-to-video", "lip sync"],
      "inputSemantics": {
        "media": "Existing image or video URL to restore.",
        "model_variant": "3b is default and faster; 7b for higher fidelity when available.",
        "sample_steps": "1 is fast one-step mode; keep low unless quality testing suggests otherwise.",
        "cfg_scale": "Higher sharpens/restores more but can overcook clean footage.",
        "apply_color_fix": "Use when preserving original hues/skin/sky color matters.",
        "fps": "Video output fps."
      },
      "routingRules": [
        "Use only when the user wants to improve an existing asset.",
        "Do not route generation prompts here unless an input media asset exists.",
        "For already clean media, use conservative cfg_scale to avoid over-sharpening."
      ],
      "promptGuidance": ["No creative prompt is needed; the key decision is restoration strength and color preservation."],
      "pitfalls": ["Heavy motion blur/extreme low light may still fail.", "Can over-sharpen clean inputs.", "Long videos may need chunking outside the model."]
    }$json$::jsonb
  ),
  (
    'google/gemini-3.1-flash-tts',
    $json${
      "agentSummary": "Google Gemini 3.1 Flash TTS converts text to expressive speech with voice selection, style prompt, language code, and inline delivery tags.",
      "bestFor": ["fast expressive voiceover", "narration", "ads", "podcasts", "character reads", "multi-language TTS"],
      "avoidFor": ["music generation", "voice cloning from audio", "changing existing audio", "visual/video generation"],
      "inputSemantics": {
        "text": "Exact spoken words. Preserve user wording unless asked to rewrite.",
        "voice": "Voice preset such as Kore; use searchVoices when selecting by qualities.",
        "prompt": "Style/delivery direction, speaker identity, emotion, pacing, scene context.",
        "language_code": "BCP-47 language code; set explicitly when the target language is known."
      },
      "routingRules": [
        "Use generateAudio when the user wants spoken audio now.",
        "Use searchVoices first when the user asks for voice qualities instead of an exact voice id.",
        "Keep stylePrompt focused: one dominant emotion plus one delivery modifier unless the user gave detailed direction."
      ],
      "promptGuidance": [
        "Use punctuation to shape pacing.",
        "Use inline tags like [whispering], [laughing], [shouting], or pause cues only when useful.",
        "Align script content, stylePrompt, and tags; avoid contradictory direction."
      ],
      "pitfalls": ["text + prompt size is limited by provider docs.", "Do not rewrite the spoken script by default.", "Not a voice-cloning model."]
    }$json$::jsonb
  )
) AS v(identifier, agent_usage)
WHERE m.identifier = v.identifier;
