ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS prompt_attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
