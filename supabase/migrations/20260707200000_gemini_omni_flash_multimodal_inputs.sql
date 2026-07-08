-- Gemini Omni Flash: unified t2v / i2v / reference-to-video routing like Happy Horse.
-- https://fal.ai/models/google/gemini-omni-flash
-- https://fal.ai/models/google/gemini-omni-flash/image-to-video
-- https://fal.ai/models/google/gemini-omni-flash/reference-to-video

UPDATE public.models
SET
  description = 'Google Gemini Omni Flash on fal: text-to-video, image-to-video, or reference-to-video with synchronized audio.',
  supports_reference_image = true,
  supports_first_frame = true,
  parameters = '{
    "parameters": [
      {
        "name": "image",
        "type": "string",
        "label": "Start Frame",
        "description": "Optional first frame for image-to-video. Disabled when reference images are attached.",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Used for text-to-video and reference-to-video.",
        "required": false,
        "default": "16:9",
        "enum": ["16:9", "9:16"],
        "ui_type": "select"
      },
      {
        "name": "duration",
        "type": "number",
        "label": "Duration",
        "description": "Video duration in seconds",
        "required": false,
        "default": 8,
        "min": 3,
        "max": 10,
        "ui_type": "number"
      }
    ]
  }'::jsonb,
  agent_usage = $json${
  "agentSummary": "Fal-hosted Gemini Omni Flash unified video model. Backend routes google/gemini-omni-flash to text-to-video, image-to-video, or reference-to-video based on the supplied visual inputs.",
  "bestFor": ["text-to-video with native audio", "image-to-video from a single start frame", "reference-guided video with multiple stills"],
  "avoidFor": ["last-frame interpolation", "reference-video editing", "video editing"],
  "inputSemantics": {
    "prompt": "Required for all modes.",
    "image": "Single start frame for image-to-video only.",
    "reference_images": "One or more still references for reference-to-video. When present, they take precedence over start-frame mode."
  },
  "routingRules": [
    "Use the canonical catalog id google/gemini-omni-flash, never the concrete Fal endpoint ids.",
    "Use text-to-video when there are no image inputs.",
    "Use image-to-video when there is exactly one start frame and no reference image gallery.",
    "Use reference-to-video when the user supplies reference images; do not send a start frame in that mode."
  ],
  "pitfalls": ["All modes require a prompt.", "Duration must stay between 3 and 10 seconds.", "Only 16:9 and 9:16 aspect ratios are supported."]
}$json$::jsonb,
  updated_at = now()
WHERE identifier = 'google/gemini-omni-flash';

UPDATE public.models
SET description = 'Gemini video with text, image, or refs'
WHERE identifier = 'google/gemini-omni-flash';
