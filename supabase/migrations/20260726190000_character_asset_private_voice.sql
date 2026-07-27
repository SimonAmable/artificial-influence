-- Link character library assets to a user-owned private voice profile.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS private_voice_id uuid
    REFERENCES public.private_audio_voices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS assets_private_voice_id_idx
  ON public.assets (private_voice_id)
  WHERE private_voice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS assets_user_character_voice_idx
  ON public.assets (user_id, category, private_voice_id)
  WHERE category = 'character';
