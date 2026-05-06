-- Extend model agent guidance with optional workflow playbooks.
-- This keeps workflow-specific best practices close to the model rows without
-- adding a separate table yet.

COMMENT ON COLUMN public.models.agent_usage IS
  'Compact model-specific guidance for LLM agents: selection, input semantics, routing rules, pitfalls, and optional workflow playbooks.';

UPDATE public.models
SET
  agent_usage = jsonb_set(
    COALESCE(agent_usage, '{}'::jsonb),
    '{workflows}',
    CASE identifier
      WHEN 'google/nano-banana-pro' THEN
        $json$[
          {
            "id": "character_swap_pro",
            "name": "Character Swap Pro",
            "active": true,
            "priority": 100,
            "bestFor": [
              "full character swaps",
              "identity into scene composites",
              "wardrobe-preserving person replacement"
            ],
            "whenToUse": [
              "The user wants the person from image 1 placed into the scene from image 2.",
              "Identity, clothing, lighting integration, and realism all matter."
            ],
            "requiredInputs": [
              "2 reference images"
            ],
            "followupQuestions": [
              "Which image is the character source and which is the scene source if the order is unclear?"
            ],
            "inputRoleRules": [
              "Reference 1 must be the character or identity source.",
              "Reference 2 must be the scene, pose, and lighting source.",
              "Default to full character swap, not face-only transfer, unless the user explicitly asks for identity-only."
            ],
            "promptTemplate": {
              "mode": "text",
              "template": "Character swap task using two reference images. First image is the reference character. Second image is the reference scene and pose. Place the character from the first image into the scene from the second image. Preserve the character's facial identity, hairstyle, body shape, skin tone, clothing, outfit, and accessories from the first image. Strictly preserve the exact pose, body positioning, limb placement, gesture, and overall stance from the second image. Preserve scene composition, camera angle, environment layout, and lighting mood from the second image. Blend naturally with correct perspective, realistic scale, contact shadows, reflections, and occlusion."
            },
            "pitfalls": [
              "Do not swap the reference order.",
              "Do not drop the realism clause covering perspective, scale, shadows, reflections, and occlusion."
            ]
          }
        ]$json$::jsonb
      WHEN 'google/nano-banana-2' THEN
        $json$[
          {
            "id": "first_frame_recreation_for_motion",
            "name": "First-Frame Recreation for Motion",
            "active": true,
            "priority": 95,
            "bestFor": [
              "building a strong driving image before animation",
              "character-consistent first frames for later video generation",
              "camera-angle-controlled motion prep"
            ],
            "whenToUse": [
              "The user wants to animate a character later and needs a better driving image first.",
              "Camera angle and subject framing matter more than motion at this stage."
            ],
            "requiredInputs": [
              "1 or more reference images"
            ],
            "followupQuestions": [
              "Should the output be optimized for portrait, product, or cinematic scene motion?"
            ],
            "inputRoleRules": [
              "Use images for camera, angle, identity, wardrobe, and composition control.",
              "Do not treat this step as the motion step; it is the prep image for later animation."
            ],
            "promptTemplate": {
              "mode": "json",
              "template": {
                "workflow": "first_frame_recreation_for_motion",
                "keep_locked": [
                  "identity",
                  "camera angle",
                  "wardrobe",
                  "overall framing"
                ],
                "change_requests": [
                  "recreate as a clean high-quality first frame ready for motion",
                  "improve anatomy and edge fidelity",
                  "preserve a readable silhouette for animation"
                ]
              }
            },
            "pitfalls": [
              "Do not overload with motion verbs meant for the later video step.",
              "Do not change framing or pose unless the user asks."
            ]
          },
          {
            "id": "creative_upscale_4k_nano",
            "name": "Creative 4K Upscale",
            "active": true,
            "priority": 90,
            "bestFor": [
              "portrait upscaling",
              "repairing image distortions",
              "adding fine realistic detail"
            ],
            "whenToUse": [
              "The user wants a polished final image, not only a larger file.",
              "The source image should stay compositionally similar."
            ],
            "requiredInputs": [
              "1 source image"
            ],
            "followupQuestions": [
              "Do you want strict preservation or light creative enhancement?"
            ],
            "inputRoleRules": [
              "Treat the input as the preservation anchor.",
              "Keep identity, pose, composition, and lighting intent unless the user requests changes."
            ],
            "promptTemplate": {
              "mode": "json",
              "template": {
                "workflow": "creative_upscale_4k",
                "keep_locked": [
                  "identity",
                  "composition",
                  "camera angle",
                  "lighting intent"
                ],
                "repair_targets": [
                  "facial distortions",
                  "hand artifacts",
                  "texture smearing"
                ],
                "enhancement_targets": [
                  "skin pores",
                  "fine facial hairs",
                  "fabric texture",
                  "micro surface detail"
                ],
                "output_specs": {
                  "resolution": "4K"
                }
              }
            },
            "pitfalls": [
              "Do not invent new props or accessories.",
              "Do not over-smooth skin or change face shape."
            ]
          }
        ]$json$::jsonb
      WHEN 'openai/gpt-image-2' THEN
        $json$[
          {
            "id": "creative_upscale_4k_gpt",
            "name": "Creative 4K Upscale",
            "active": true,
            "priority": 92,
            "bestFor": [
              "final image polish",
              "high-fidelity repair and detail enhancement",
              "text-aware upscale-adjacent restaging"
            ],
            "whenToUse": [
              "The user wants a final polished still with distortion repair and more realism.",
              "The source image must remain recognizable while gaining fine detail."
            ],
            "requiredInputs": [
              "1 source image"
            ],
            "followupQuestions": [
              "Is this a portrait, product shot, or environment scene?"
            ],
            "inputRoleRules": [
              "Preserve layout, identity, and lighting unless asked to revise them.",
              "Focus enhancements on repair plus detail, not composition changes."
            ],
            "promptTemplate": {
              "mode": "json",
              "template": {
                "workflow": "creative_upscale_4k",
                "keep_locked": [
                  "identity",
                  "composition",
                  "camera angle",
                  "lighting intent",
                  "visible text layout"
                ],
                "repair_targets": [
                  "distorted anatomy",
                  "soft text edges",
                  "muddy textures"
                ],
                "enhancement_targets": [
                  "pores",
                  "tiny flyaway hairs",
                  "material texture",
                  "micro-contrast"
                ],
                "output_specs": {
                  "resolution": "4K"
                }
              }
            },
            "pitfalls": [
              "Do not add new design elements the user did not request.",
              "Do not rewrite visible text during enhancement unless asked."
            ]
          }
        ]$json$::jsonb
      WHEN 'bytedance/seedance-2.0' THEN
        $json$[
          {
            "id": "seedance_marketing_studio_formats",
            "name": "Seedance Marketing Studio Formats",
            "active": true,
            "priority": 100,
            "bestFor": [
              "UGC ads",
              "tutorials",
              "unboxings",
              "hyper motion product spots",
              "product reviews",
              "TV spots"
            ],
            "whenToUse": [
              "The user wants a polished ad-style multi-shot video.",
              "Shot structure and audio direction matter more than pure vibe prompting."
            ],
            "requiredInputs": [
              "prompt",
              "at least one visual anchor for product or character fidelity"
            ],
            "followupQuestions": [
              "Which format fits best: UGC, Tutorial, Unboxing, Hyper Motion, Product Review, TV Spot, Wild Card, or Try-On?",
              "Should audio be dialogue, voiceover, music, Foley, or silent?"
            ],
            "inputRoleRules": [
              "Lead with production specs: shot count, duration, aspect ratio, and format.",
              "Write prompts in shot beats with one hero action per shot.",
              "Use reference images for product or character fidelity, and use reference audio only when a visual anchor is present."
            ],
            "promptTemplate": {
              "mode": "text",
              "template": "{shot_count} shots, {duration} seconds total, {aspect_ratio}, {format}. Product or subject: {hero_subject}. References: use uploaded visual references for exact fidelity. Audio: {audio_direction}. Shot 1: {camera + action + sound}. Shot 2: {camera + action + sound}. Shot 3: {camera + action + sound}. Final frame: {hero ending}. Constraints: keep product or character accurate, maintain consistency, no extra logos, no distorted text."
            },
            "pitfalls": [
              "Do not write a vibe-only paragraph with no shot structure.",
              "Do not confuse reference images with first-frame image semantics."
            ]
          },
          {
            "id": "seedance_reference_driven_animation",
            "name": "Reference-Driven Animation",
            "active": true,
            "priority": 96,
            "bestFor": [
              "animating a prepared still",
              "reference-image-guided motion",
              "audio-conditioned scene animation"
            ],
            "whenToUse": [
              "The user wants to animate an existing image but not necessarily force it as frame 1.",
              "A separate first-frame image, loose references, and audio may each play different roles."
            ],
            "requiredInputs": [
              "1 visual anchor"
            ],
            "followupQuestions": [
              "Should the uploaded image be used as a loose reference or as the exact first frame?"
            ],
            "inputRoleRules": [
              "Use reference_images when the user says reference, style, identity, or consistency.",
              "Use image only when the user clearly wants the exact still to become frame 1.",
              "Use reference_audios only when a visual anchor is also present, and mention [Audio1] in the prompt."
            ],
            "promptTemplate": {
              "mode": "text",
              "template": "Animate the scene with clear camera motion, subject motion, and environment motion. Preserve identity and core composition from [Image1]. If reference audio is supplied, sync pacing and emphasis to [Audio1]."
            },
            "pitfalls": [
              "Do not collapse loose image-reference intent into first-frame mode.",
              "Do not attach reference audio without a visual anchor."
            ]
          }
        ]$json$::jsonb
      WHEN 'google/gemini-3.1-flash-tts' THEN
        $json$[
          {
            "id": "expressive_dialogue_read",
            "name": "Expressive Dialogue Read",
            "active": true,
            "priority": 90,
            "bestFor": [
              "ads",
              "dialogue takes",
              "narration",
              "emotion-led voiceover"
            ],
            "whenToUse": [
              "The user wants spoken audio now and cares about delivery style.",
              "A voice preset plus a focused style prompt can carry the performance."
            ],
            "requiredInputs": [
              "spoken script"
            ],
            "followupQuestions": [
              "What is the dominant emotion or delivery style?",
              "Do you want one read or multiple emotional takes?"
            ],
            "inputRoleRules": [
              "Keep the script literal unless the user asked for writing help.",
              "Use stylePrompt for one dominant emotion plus at most one delivery modifier.",
              "Use inline tags like [whispering] or [shouting] only when they clearly help performance."
            ],
            "promptTemplate": {
              "mode": "json",
              "template": {
                "workflow": "expressive_dialogue_read",
                "stylePromptPattern": "dominant emotion + optional delivery modifier",
                "scriptRule": "preserve exact spoken words"
              }
            },
            "pitfalls": [
              "Do not stack contradictory emotions in the style prompt.",
              "Do not rewrite the spoken text by default."
            ]
          }
        ]$json$::jsonb
      WHEN 'prunaai/z-image-turbo' THEN
        $json$[
          {
            "id": "rapid_image_ideation",
            "name": "Rapid Image Ideation",
            "active": true,
            "priority": 80,
            "bestFor": [
              "cheap prompt exploration",
              "thumbnail concepts",
              "fast draft variations"
            ],
            "whenToUse": [
              "The user values speed over precision or final polish.",
              "No reference image must be preserved."
            ],
            "requiredInputs": [
              "text prompt only"
            ],
            "inputRoleRules": [
              "Keep prompts short and concrete.",
              "Do not use this workflow when references or exact editing are needed."
            ],
            "pitfalls": [
              "No reference-image support.",
              "Escalate to a stronger model for final deliverables."
            ]
          }
        ]$json$::jsonb
      WHEN 'prunaai/p-video' THEN
        $json$[
          {
            "id": "rapid_video_ideation",
            "name": "Rapid Video Ideation",
            "active": true,
            "priority": 80,
            "bestFor": [
              "fast motion concept tests",
              "cheap storyboard-like video drafts",
              "quick audio-conditioned experiments"
            ],
            "whenToUse": [
              "The user wants a rough fast video direction before committing to a premium model.",
              "Iteration speed matters more than final fidelity."
            ],
            "requiredInputs": [
              "prompt or start image"
            ],
            "followupQuestions": [
              "Do you want the fastest draft possible or a slightly more directed draft?"
            ],
            "inputRoleRules": [
              "Treat this as an ideation model, not the default final-output model.",
              "Use short, direct motion prompts and keep clip expectations modest."
            ],
            "pitfalls": [
              "Do not present draft quality as final premium output.",
              "Escalate to Seedance or another higher-fidelity model once the concept is approved."
            ]
          }
        ]$json$::jsonb
      ELSE '[]'::jsonb
    END,
    true
  ),
  updated_at = timezone('utc'::text, now())
WHERE identifier IN (
  'google/nano-banana-pro',
  'google/nano-banana-2',
  'openai/gpt-image-2',
  'bytedance/seedance-2.0',
  'google/gemini-3.1-flash-tts',
  'prunaai/z-image-turbo',
  'prunaai/p-video'
);
