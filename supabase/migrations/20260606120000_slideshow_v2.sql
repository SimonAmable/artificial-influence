BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.slideshow_projects') IS NOT NULL
    AND to_regclass('public.legacy_slideshow_projects') IS NULL THEN
    ALTER TABLE public.slideshow_projects RENAME TO legacy_slideshow_projects;
  END IF;
END
$$;

ALTER TABLE public.slideshow_collection_images
  DROP CONSTRAINT IF EXISTS slideshow_collection_images_source_kind_check;

ALTER TABLE public.slideshow_collection_images
  ADD CONSTRAINT slideshow_collection_images_source_kind_check
  CHECK (source_kind IN ('upload', 'asset', 'pinterest', 'generated'));

ALTER TABLE public.slideshow_collection_images
  ADD COLUMN IF NOT EXISTS ai_description text,
  ADD COLUMN IF NOT EXISTS generation_id uuid REFERENCES public.generations(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.slideshow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  thumbnail_url text,
  is_public boolean NOT NULL DEFAULT false,
  origin text NOT NULL DEFAULT 'generated' CHECK (origin IN ('generated', 'saved', 'starter', 'cloned')),
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.slideshow_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.slideshow_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.slideshow_templates(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  aspect_ratio text NOT NULL DEFAULT '9:16' CHECK (aspect_ratio IN ('9:16', '4:5', '1:1')),
  blueprint jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (template_id, version)
);

ALTER TABLE public.slideshow_template_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.slideshow_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.slideshow_templates(id) ON DELETE RESTRICT,
  template_version_id uuid NOT NULL REFERENCES public.slideshow_template_versions(id) ON DELETE RESTRICT,
  brand_kit_id uuid REFERENCES public.brand_kits(id) ON DELETE SET NULL,
  name text NOT NULL,
  brief text NOT NULL,
  aspect_ratio text NOT NULL DEFAULT '9:16' CHECK (aspect_ratio IN ('9:16', '4:5', '1:1')),
  status text NOT NULL DEFAULT 'planning' CHECK (
    status IN ('planning', 'resolving', 'ready', 'rendering', 'rendered', 'failed')
  ),
  slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  rendered_slide_urls text[] NOT NULL DEFAULT '{}'::text[],
  error_message text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.slideshow_projects ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.slideshow_render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.slideshow_projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'rendering', 'completed', 'failed')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  project_snapshot jsonb NOT NULL,
  output_urls text[] NOT NULL DEFAULT '{}'::text[],
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.slideshow_render_jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_slideshow_templates_user_updated
  ON public.slideshow_templates (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_slideshow_templates_public
  ON public.slideshow_templates (is_public, updated_at DESC) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_slideshow_projects_user_updated
  ON public.slideshow_projects (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_slideshow_render_jobs_project
  ON public.slideshow_render_jobs (project_id, created_at DESC);

DROP TRIGGER IF EXISTS on_slideshow_templates_updated ON public.slideshow_templates;
CREATE TRIGGER on_slideshow_templates_updated
  BEFORE UPDATE ON public.slideshow_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_slideshow_projects_updated ON public.slideshow_projects;
CREATE TRIGGER on_slideshow_projects_updated
  BEFORE UPDATE ON public.slideshow_projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS slideshow_templates_select ON public.slideshow_templates;
CREATE POLICY slideshow_templates_select ON public.slideshow_templates
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_public = true);
DROP POLICY IF EXISTS slideshow_templates_insert ON public.slideshow_templates;
CREATE POLICY slideshow_templates_insert ON public.slideshow_templates
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS slideshow_templates_update ON public.slideshow_templates;
CREATE POLICY slideshow_templates_update ON public.slideshow_templates
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS slideshow_templates_delete ON public.slideshow_templates;
CREATE POLICY slideshow_templates_delete ON public.slideshow_templates
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS slideshow_template_versions_select ON public.slideshow_template_versions;
CREATE POLICY slideshow_template_versions_select ON public.slideshow_template_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.slideshow_templates t
      WHERE t.id = slideshow_template_versions.template_id
        AND (t.user_id = auth.uid() OR t.is_public = true)
    )
  );
DROP POLICY IF EXISTS slideshow_template_versions_insert ON public.slideshow_template_versions;
CREATE POLICY slideshow_template_versions_insert ON public.slideshow_template_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.slideshow_templates t
      WHERE t.id = slideshow_template_versions.template_id AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS slideshow_projects_all ON public.slideshow_projects;
CREATE POLICY slideshow_projects_all ON public.slideshow_projects
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS slideshow_render_jobs_all ON public.slideshow_render_jobs;
CREATE POLICY slideshow_render_jobs_all ON public.slideshow_render_jobs
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

COMMIT;
