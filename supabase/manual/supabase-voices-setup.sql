-- Voices catalog setup
-- Generic provider-backed voice table with public read access.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_voice_id TEXT NOT NULL,
  model TEXT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  lang_code TEXT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NULL,
  name TEXT NULL,
  preview_text TEXT NOT NULL DEFAULT '',
  raw_payload JSONB NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT voices_provider_voice_unique UNIQUE (provider, provider_voice_id)
);

ALTER TABLE public.voices
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_voice_id TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lang_code TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS preview_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS preview_audio_url TEXT,
  ADD COLUMN IF NOT EXISTS preview_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'voices_provider_voice_unique'
  ) THEN
    ALTER TABLE public.voices
      ADD CONSTRAINT voices_provider_voice_unique
      UNIQUE (provider, provider_voice_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_voices_provider_active
  ON public.voices (provider, is_active);

CREATE INDEX IF NOT EXISTS idx_voices_provider_lang
  ON public.voices (provider, lang_code);

CREATE INDEX IF NOT EXISTS idx_voices_provider_source
  ON public.voices (provider, source);

CREATE INDEX IF NOT EXISTS idx_voices_display_name_lower
  ON public.voices ((lower(display_name)));

CREATE INDEX IF NOT EXISTS idx_voices_tags_gin
  ON public.voices USING GIN (tags);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.handle_updated_at()
    RETURNS TRIGGER AS $f$
    BEGIN
      NEW.updated_at = timezone('utc'::text, now());
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS on_voice_updated ON public.voices;
CREATE TRIGGER on_voice_updated
  BEFORE UPDATE ON public.voices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.voices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voices_public_read" ON public.voices;
CREATE POLICY "voices_public_read"
  ON public.voices
  FOR SELECT
  TO anon, authenticated
  USING (true);
