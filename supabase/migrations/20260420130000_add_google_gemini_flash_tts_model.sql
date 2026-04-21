INSERT INTO public.models (
  identifier,
  name,
  description,
  type,
  provider,
  is_active,
  model_cost,
  parameters
)
VALUES (
  'google/gemini-3.1-flash-tts',
  'Gemini 3.1 Flash TTS',
  'Google''s expressive text-to-speech model with style prompting and inline delivery tags',
  'audio',
  'replicate',
  true,
  0.001,
  jsonb_build_object(
    'parameters',
    jsonb_build_array(
      jsonb_build_object(
        'name', 'voice',
        'type', 'string',
        'label', 'Voice',
        'description', 'Gemini voice preset to use for speech synthesis',
        'required', true,
        'default', 'Kore',
        'ui_type', 'text'
      ),
      jsonb_build_object(
        'name', 'prompt',
        'type', 'string',
        'label', 'Style Prompt',
        'description', 'Delivery instructions for tone, pace, emotion, or character context',
        'required', false,
        'default', 'Say the following naturally.',
        'ui_type', 'textarea'
      ),
      jsonb_build_object(
        'name', 'language_code',
        'type', 'string',
        'label', 'Language Code',
        'description', 'BCP-47 language code for the spoken output',
        'required', false,
        'default', 'en-US',
        'ui_type', 'text'
      )
    )
  )
)
ON CONFLICT (identifier) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  provider = EXCLUDED.provider,
  is_active = EXCLUDED.is_active,
  model_cost = EXCLUDED.model_cost,
  parameters = EXCLUDED.parameters,
  updated_at = NOW();
