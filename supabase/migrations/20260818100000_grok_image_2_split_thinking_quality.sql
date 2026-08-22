-- Split Grok Image 2 controls: quality is Thinking (low/medium), resolution is Quality (1k/2k).
-- xAI only accepts quality low|medium for grok-imagine-image-2.0; high is invalid.

UPDATE public.models
SET
  parameters = '{
    "replicate_input_defaults": {
      "quality": "low",
      "resolution": "1k"
    },
    "parameters": [
      {
        "name": "quality",
        "type": "string",
        "label": "Thinking",
        "description": "Reasoning pass before rendering. Off is faster and cheaper; On follows complex layouts more carefully",
        "required": false,
        "default": "low",
        "enum": ["low", "medium"],
        "ui_type": "select",
        "affects_pricing": true
      },
      {
        "name": "resolution",
        "type": "string",
        "label": "Quality",
        "description": "Output resolution. 1K is faster; 2K is sharper",
        "required": false,
        "default": "1k",
        "enum": ["1k", "2k"],
        "ui_type": "select"
      }
    ]
  }'::jsonb,
  agent_usage = $json${
    "agentSummary": "Grok Image 2 is xAI's latest image generation and editing model, routed through Vercel AI Gateway. It is especially strong at detailed instructions, typography, layouts, posters, title screens, and infographics.",
    "bestFor": ["posters and title cards", "infographics", "readable text", "layout-heavy visuals", "precise image edits", "multi-reference compositions", "multiple output variations"],
    "avoidFor": ["transparent-background guarantees", "requests that require more than four outputs"],
    "inputSemantics": {
      "prompt": "Detailed image brief, or a precise edit instruction when a reference image is attached.",
      "quality": "Thinking. low is off (2 credits); medium is on (4 credits). Never send high.",
      "resolution": "Output quality. 1k is faster; 2k is sharper. Forwarded through providerOptions.xai.",
      "referenceIds": "Up to three optional source images for editing and compositing, used in attachment order.",
      "variantCount": "One to four output images per generation. Credits are charged per output."
    },
    "routingRules": [
      "Use xai/grok-imagine-image-2.0 when the user asks for Grok Image 2, Grok Imagine 2, dense typography, layout planning, an infographic, a poster, or a title screen.",
      "Treat quality as Thinking: low unless the user asks to turn thinking on, reason more carefully, or follow a complex layout.",
      "Treat resolution as Quality: 1k unless the user asks for 2k, sharper, or higher-resolution output.",
      "When editing, pass up to three reference images and describe the requested change plus what must remain unchanged."
    ],
    "promptGuidance": [
      "Preserve exact text strings and state their visual hierarchy and placement.",
      "For layout-heavy work, describe sections, spacing, alignment, reading order, and typography.",
      "For edits, name the change precisely and list the elements that should stay untouched."
    ],
    "pitfalls": ["Reference-image order matters when the prompt refers to first, second, or third inputs.", "Do not send quality high; map it to medium."]
  }$json$::jsonb,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'xai/grok-imagine-image-2.0';
