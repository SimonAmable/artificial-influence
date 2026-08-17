-- Studio: project-based infinite canvas for image generation

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.studio_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled Studio',
  thumbnail_url text,
  viewport jsonb NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_studio_projects_user_updated_at
  ON public.studio_projects (user_id, updated_at DESC);

ALTER TABLE public.studio_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own studio projects" ON public.studio_projects;
CREATE POLICY "Users can view own studio projects"
  ON public.studio_projects
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own studio projects" ON public.studio_projects;
CREATE POLICY "Users can create own studio projects"
  ON public.studio_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own studio projects" ON public.studio_projects;
CREATE POLICY "Users can update own studio projects"
  ON public.studio_projects
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own studio projects" ON public.studio_projects;
CREATE POLICY "Users can delete own studio projects"
  ON public.studio_projects
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS on_studio_projects_updated ON public.studio_projects;
CREATE TRIGGER on_studio_projects_updated
  BEFORE UPDATE ON public.studio_projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS studio_project_id uuid REFERENCES public.studio_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS studio_x double precision,
  ADD COLUMN IF NOT EXISTS studio_y double precision,
  ADD COLUMN IF NOT EXISTS studio_width double precision,
  ADD COLUMN IF NOT EXISTS studio_height double precision;

CREATE INDEX IF NOT EXISTS idx_generations_studio_project_created
  ON public.generations (studio_project_id, created_at DESC)
  WHERE studio_project_id IS NOT NULL;

COMMENT ON COLUMN public.generations.studio_project_id IS
  'Optional Studio project this generation belongs to (infinite canvas board).';
COMMENT ON COLUMN public.generations.studio_x IS
  'Board X position in Studio canvas world units.';
COMMENT ON COLUMN public.generations.studio_y IS
  'Board Y position in Studio canvas world units.';
COMMENT ON COLUMN public.generations.studio_width IS
  'Board tile width in Studio canvas world units.';
COMMENT ON COLUMN public.generations.studio_height IS
  'Board tile height in Studio canvas world units.';
