-- Persist generated TTS preview samples for private voices.

ALTER TABLE public.private_audio_voices
  ADD COLUMN IF NOT EXISTS preview_storage_path text;

COMMENT ON COLUMN public.private_audio_voices.preview_storage_path IS
  'Storage path in private-voices bucket for a generated TTS preview sample.';
