-- Qwen3 TTS (Replicate), Seed Audio 1.0 (fal), and user-owned private voice profiles.
-- Provider schemas:
-- https://replicate.com/qwen/qwen3-tts/api
-- https://fal.ai/models/bytedance/seed-audio-1.0/api

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
VALUES
(
  'qwen/qwen3-tts',
  'Qwen3 TTS',
  'Natural multilingual speech with instant voice cloning and reusable voice design.',
  'audio',
  'replicate',
  true,
  0.001,
  jsonb_build_object(
    'parameters',
    jsonb_build_array(
      jsonb_build_object('name', 'mode', 'type', 'string', 'label', 'Mode', 'required', true, 'default', 'custom_voice', 'enum', jsonb_build_array('custom_voice', 'voice_clone', 'voice_design')),
      jsonb_build_object('name', 'language', 'type', 'string', 'label', 'Language', 'required', false, 'default', 'auto', 'enum', jsonb_build_array('auto', 'Chinese', 'English', 'Japanese', 'Korean', 'French', 'German', 'Italian', 'Spanish', 'Portuguese', 'Russian')),
      jsonb_build_object('name', 'speaker', 'type', 'string', 'label', 'Preset Voice', 'required', false, 'default', 'Serena', 'enum', jsonb_build_array('Aiden', 'Dylan', 'Eric', 'Ono_anna', 'Ryan', 'Serena', 'Sohee', 'Uncle_fu', 'Vivian')),
      jsonb_build_object('name', 'reference_audio', 'type', 'audio', 'label', 'Reference Audio', 'required', false, 'ui_type', 'upload'),
      jsonb_build_object('name', 'reference_text', 'type', 'string', 'label', 'Reference Transcript', 'required', false, 'ui_type', 'textarea'),
      jsonb_build_object('name', 'voice_description', 'type', 'string', 'label', 'Voice Description', 'required', false, 'ui_type', 'textarea'),
      jsonb_build_object('name', 'style_instruction', 'type', 'string', 'label', 'Style Instruction', 'required', false, 'ui_type', 'textarea')
    )
  )
),
(
  'bytedance/seed-audio-1.0',
  'Seed Audio 1.0',
  'Create natural speech and complete audio scenes from text, reference audio, or an image.',
  'audio',
  'fal',
  true,
  0.003125,
  jsonb_build_object(
    'parameters',
    jsonb_build_array(
      jsonb_build_object('name', 'voice', 'type', 'string', 'label', 'Voice', 'required', false),
      jsonb_build_object('name', 'audio_urls', 'type', 'audio[]', 'label', 'Reference Audio', 'required', false, 'max_items', 3, 'ui_type', 'multi_upload'),
      jsonb_build_object('name', 'image_url', 'type', 'image', 'label', 'Reference Image', 'required', false, 'ui_type', 'upload'),
      jsonb_build_object('name', 'output_format', 'type', 'string', 'label', 'Format', 'required', false, 'default', 'mp3', 'enum', jsonb_build_array('wav', 'mp3', 'pcm', 'ogg_opus')),
      jsonb_build_object('name', 'sample_rate', 'type', 'integer', 'label', 'Sample Rate', 'required', false, 'default', 24000, 'enum', jsonb_build_array(8000, 16000, 24000, 32000, 44100, 48000)),
      jsonb_build_object('name', 'speed', 'type', 'number', 'label', 'Speed', 'required', false, 'default', 1, 'minimum', 0.5, 'maximum', 2),
      jsonb_build_object('name', 'volume', 'type', 'number', 'label', 'Volume', 'required', false, 'default', 1, 'minimum', 0.5, 'maximum', 2),
      jsonb_build_object('name', 'pitch', 'type', 'integer', 'label', 'Pitch', 'required', false, 'default', 0, 'minimum', -12, 'maximum', 12),
      jsonb_build_object('name', 'multilingual', 'type', 'boolean', 'label', 'Multilingual', 'required', false, 'default', false)
    ),
    'mutuallyExclusive', jsonb_build_array('audio_urls', 'image_url')
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

CREATE TABLE IF NOT EXISTS public.private_audio_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  provider text NOT NULL CHECK (provider IN ('qwen', 'google')),
  model_id text NOT NULL CHECK (model_id IN ('qwen/qwen3-tts', 'google/gemini-3.1-flash-tts')),
  kind text NOT NULL CHECK (kind IN ('clone', 'design')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  reference_storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT private_audio_voices_clone_provider_check
    CHECK (kind <> 'clone' OR provider = 'qwen'),
  CONSTRAINT private_audio_voices_clone_reference_check
    CHECK (kind <> 'clone' OR reference_storage_path IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS private_audio_voices_user_provider_idx
  ON public.private_audio_voices (user_id, provider, created_at DESC);

ALTER TABLE public.private_audio_voices ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_audio_voices TO authenticated;
GRANT ALL ON public.private_audio_voices TO service_role;

DROP POLICY IF EXISTS "Private voices are visible to their owner" ON public.private_audio_voices;
CREATE POLICY "Private voices are visible to their owner"
  ON public.private_audio_voices
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own private voices" ON public.private_audio_voices;
CREATE POLICY "Users can create their own private voices"
  ON public.private_audio_voices
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own private voices" ON public.private_audio_voices;
CREATE POLICY "Users can update their own private voices"
  ON public.private_audio_voices
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own private voices" ON public.private_audio_voices;
CREATE POLICY "Users can delete their own private voices"
  ON public.private_audio_voices
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'private-voices',
  'private-voices',
  false,
  20971520,
  ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/ogg',
    'audio/opus',
    'audio/flac'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can read their private voice recordings" ON storage.objects;
CREATE POLICY "Users can read their private voice recordings"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'private-voices'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Users can upload their private voice recordings" ON storage.objects;
CREATE POLICY "Users can upload their private voice recordings"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'private-voices'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Users can update their private voice recordings" ON storage.objects;
CREATE POLICY "Users can update their private voice recordings"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'private-voices'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'private-voices'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Users can delete their private voice recordings" ON storage.objects;
CREATE POLICY "Users can delete their private voice recordings"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'private-voices'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
