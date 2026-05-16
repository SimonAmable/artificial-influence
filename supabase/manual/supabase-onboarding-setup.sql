-- Onboarding completion on profiles (mandatory gate after signup)
-- Run once on your Supabase project (SQL editor or CLI).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.profiles.onboarding_completed_at IS
  'When set, user has finished mandatory onboarding. NULL = must complete /onboarding.';

-- Existing users before this migration: treat as already onboarded so they are not blocked.
UPDATE public.profiles
SET onboarding_completed_at = COALESCE(onboarding_completed_at, timezone('utc'::text, now()))
WHERE onboarding_completed_at IS NULL;

-- Optional: speed up middleware / server checks (user id is PK; cheap either way)
-- CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed_at
--   ON public.profiles (onboarding_completed_at)
--   WHERE onboarding_completed_at IS NULL;
