ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.generations.metadata IS
  'Tool-specific payload (e.g. carousel_shots contact sheet, panel URLs, upscale state).';
