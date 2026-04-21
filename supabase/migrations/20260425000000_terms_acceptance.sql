ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS terms_version TEXT NULL,
  ADD COLUMN IF NOT EXISTS terms_text_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS terms_acceptance_source TEXT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_terms_acceptance_source_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_terms_acceptance_source_check
  CHECK (
    terms_acceptance_source IS NULL OR
    terms_acceptance_source IN ('onboarding', 'blocking_modal')
  );

COMMENT ON COLUMN public.profiles.terms_accepted_at IS
  'When the user accepted the currently-recorded Terms of Use.';

COMMENT ON COLUMN public.profiles.terms_version IS
  'Machine-readable version of the Terms of Use the user last accepted.';

COMMENT ON COLUMN public.profiles.terms_text_snapshot IS
  'Exact Terms of Use markdown content accepted by the user at that time.';

COMMENT ON COLUMN public.profiles.terms_acceptance_source IS
  'Where the user accepted the current Terms of Use: onboarding or blocking_modal.';
