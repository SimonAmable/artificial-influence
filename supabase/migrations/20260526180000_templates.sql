-- AI-driven templates: data objects with prompts + typed inputs that hand off to chat.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  tips text,
  thumbnail_url text,
  thumbnail_kind text NOT NULL DEFAULT 'image' CHECK (thumbnail_kind IN ('image', 'video')),
  category text NOT NULL DEFAULT 'photo' CHECK (
    category IN ('photo', 'video', 'slideshow')
  ),
  prompt text NOT NULL,
  output_kind text NOT NULL DEFAULT 'image' CHECK (
    output_kind IN ('image', 'video', 'audio', 'slideshow', 'mixed')
  ),
  inputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  credits_cost integer NOT NULL DEFAULT 5 CHECK (credits_cost >= 0),
  credits_cost_locked boolean NOT NULL DEFAULT false,
  last_run_credits integer,
  run_count integer NOT NULL DEFAULT 0,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT templates_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_templates_gallery
  ON public.templates (visibility, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_templates_creator
  ON public.templates (creator_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.template_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.chat_threads(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_context jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'failed')),
  credits_estimated integer NOT NULL DEFAULT 0 CHECK (credits_estimated >= 0),
  credits_actual integer CHECK (credits_actual IS NULL OR credits_actual >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_runs_thread_id
  ON public.template_runs (thread_id)
  WHERE thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_template_runs_template
  ON public.template_runs (template_id, started_at DESC);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_runs ENABLE ROW LEVEL SECURITY;

-- templates: public rows OR own rows
DROP POLICY IF EXISTS templates_select ON public.templates;
CREATE POLICY templates_select ON public.templates
  FOR SELECT
  USING (visibility = 'public' OR auth.uid() = creator_id);

DROP POLICY IF EXISTS templates_insert ON public.templates;
CREATE POLICY templates_insert ON public.templates
  FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS templates_update ON public.templates;
CREATE POLICY templates_update ON public.templates
  FOR UPDATE
  USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS templates_delete ON public.templates;
CREATE POLICY templates_delete ON public.templates
  FOR DELETE
  USING (auth.uid() = creator_id);

-- template_runs: runner sees own; creator sees runs of their templates
DROP POLICY IF EXISTS template_runs_select ON public.template_runs;
CREATE POLICY template_runs_select ON public.template_runs
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.templates t
      WHERE t.id = template_runs.template_id
        AND t.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS template_runs_insert ON public.template_runs;
CREATE POLICY template_runs_insert ON public.template_runs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS template_runs_update ON public.template_runs;
CREATE POLICY template_runs_update ON public.template_runs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Seed example template (public demo) — only if no row with this slug exists
INSERT INTO public.templates (
  creator_id,
  slug,
  title,
  description,
  tips,
  thumbnail_url,
  thumbnail_kind,
  category,
  prompt,
  output_kind,
  inputs,
  credits_cost,
  visibility
)
SELECT
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  'coconut-water',
  'Who is dancing?',
  'Put yourself in Plaque Boy Max viral coconut water dance. Upload your photo and we will drop you in.',
  'Upload a clear photo of your face.',
  NULL,
  'image',
  'video',
  'Drop the person from the reference photo into the Plaque Boy Max coconut water dance clip. Use {{format}} aspect ratio. Create a short viral-style video.',
  'video',
  '[
    {"kind":"image","id":"photo","label":"Your Photo","required":true,"helpText":"Upload a clear photo of your face"},
    {"kind":"aspect_ratio","id":"format","label":"Video format","required":true,"default":"9:16"}
  ]'::jsonb,
  70,
  'public'
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.templates WHERE slug = 'coconut-water');
