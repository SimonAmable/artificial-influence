UPDATE ai_models
SET
  supports_last_frame = true,
  parameters = '{
    "parameters": [
      {
        "name": "image",
        "type": "string",
        "label": "Input Image",
        "description": "Optional input image for image-to-video generation",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "audio",
        "type": "string",
        "label": "Input Audio",
        "description": "Optional audio clip to condition motion and timing",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "last_frame_image",
        "type": "string",
        "label": "Last Frame",
        "description": "Optional last frame reference image for steering the ending shot",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "duration",
        "type": "number",
        "label": "Duration",
        "description": "Video duration in seconds (1-10). Ignored when audio is provided.",
        "required": false,
        "default": 5,
        "min": 1,
        "max": 10,
        "ui_type": "number"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Ignored when an input image is provided",
        "required": false,
        "default": "16:9",
        "enum": ["16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "1:1"],
        "ui_type": "select"
      },
      {
        "name": "resolution",
        "type": "string",
        "label": "Resolution",
        "description": "Output video resolution",
        "required": false,
        "default": "720p",
        "enum": ["720p", "1080p"],
        "ui_type": "select"
      },
      {
        "name": "fps",
        "type": "number",
        "label": "FPS",
        "description": "Frames per second of the output video",
        "required": false,
        "default": 24,
        "enum": [24, 48],
        "ui_type": "select"
      },
      {
        "name": "draft",
        "type": "boolean",
        "label": "Draft Mode",
        "description": "Faster lower-quality preview mode",
        "required": false,
        "default": false,
        "ui_type": "switch"
      },
      {
        "name": "prompt_upsampling",
        "type": "boolean",
        "label": "Prompt Upsampling",
        "description": "Automatically enhance the prompt before generation",
        "required": false,
        "default": true,
        "ui_type": "switch"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "description": "Random seed for reproducibility",
        "required": false,
        "default": null,
        "min": 0,
        "max": 2147483647,
        "ui_type": "number"
      }
    ]
  }'::jsonb,
  updated_at = NOW()
WHERE identifier = 'prunaai/p-video';
