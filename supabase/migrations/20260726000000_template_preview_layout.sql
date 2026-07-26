ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS preview_layout text NOT NULL DEFAULT 'single'
    CHECK (preview_layout IN ('single', 'before_after')),
  ADD COLUMN IF NOT EXISTS preview_before_url text,
  ADD COLUMN IF NOT EXISTS preview_before_kind text
    CHECK (preview_before_kind IS NULL OR preview_before_kind IN ('image', 'video'));

ALTER TABLE public.template_runs
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
