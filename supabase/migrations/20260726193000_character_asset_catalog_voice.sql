-- Allow character assets to attach either a private voice or a catalog/default voice.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS voice_id text,
  ADD COLUMN IF NOT EXISTS voice_provider text;

CREATE INDEX IF NOT EXISTS assets_voice_provider_idx
  ON public.assets (user_id, voice_provider)
  WHERE voice_id IS NOT NULL;
