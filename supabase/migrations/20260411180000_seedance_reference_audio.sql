-- Seedance 2.0: reference audio (Replicate `reference_audios`) + model flag for search/UI

ALTER TABLE public.models
  ADD COLUMN IF NOT EXISTS supports_reference_audio BOOLEAN NOT NULL DEFAULT false;

UPDATE public.models
SET
  supports_reference_audio = true,
  parameters = '{
    "parameters": [
      {
        "name": "image",
        "type": "string",
        "label": "First Frame",
        "description": "Optional first frame for image-to-video (not combined with reference_images)",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "last_frame_image",
        "type": "string",
        "label": "Last Frame",
        "description": "Optional last frame (requires first frame; not combined with reference_images)",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "duration",
        "type": "number",
        "label": "Duration (seconds)",
        "description": "4–15 seconds, or -1 for model-chosen length",
        "required": false,
        "default": 5,
        "min": -1,
        "max": 15,
        "ui_type": "number"
      },
      {
        "name": "resolution",
        "type": "string",
        "label": "Resolution",
        "description": "Output resolution",
        "required": false,
        "default": "720p",
        "enum": ["480p", "720p"],
        "ui_type": "select"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Use adaptive to match inputs",
        "required": false,
        "default": "16:9",
        "enum": ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"],
        "ui_type": "select"
      },
      {
        "name": "generate_audio",
        "type": "boolean",
        "label": "Generate Audio",
        "description": "Synchronized dialogue, SFX, and music",
        "required": false,
        "default": true,
        "ui_type": "switch"
      },
      {
        "name": "reference_audios",
        "type": "string",
        "label": "Reference audios",
        "description": "Up to 3 public HTTPS URLs (wav/mp3). Use [Audio1] in the prompt; requires at least one reference image or video, or a first-frame image.",
        "required": false,
        "default": null,
        "ui_type": "textarea"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "description": "Optional seed for reproducibility",
        "required": false,
        "default": null,
        "min": 0,
        "max": 2147483647,
        "ui_type": "number"
      }
    ]
  }'::jsonb,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'bytedance/seedance-2.0';
