-- Imported media on Studio boards (uploads, library assets, history, paste).
-- Generated tiles stay on public.generations; these rows are board-only.

CREATE TABLE IF NOT EXISTS public.studio_board_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_project_id uuid NOT NULL REFERENCES public.studio_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image', 'video')),
  url text NOT NULL,
  source text NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'asset', 'history', 'paste')),
  source_id text,
  prompt text,
  x double precision NOT NULL DEFAULT 0,
  y double precision NOT NULL DEFAULT 0,
  width double precision NOT NULL DEFAULT 280,
  height double precision NOT NULL DEFAULT 280,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_studio_board_items_project_created
  ON public.studio_board_items (studio_project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_studio_board_items_user
  ON public.studio_board_items (user_id, created_at DESC);

ALTER TABLE public.studio_board_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own studio board items" ON public.studio_board_items;
CREATE POLICY "Users can view own studio board items"
  ON public.studio_board_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own studio board items" ON public.studio_board_items;
CREATE POLICY "Users can create own studio board items"
  ON public.studio_board_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own studio board items" ON public.studio_board_items;
CREATE POLICY "Users can update own studio board items"
  ON public.studio_board_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own studio board items" ON public.studio_board_items;
CREATE POLICY "Users can delete own studio board items"
  ON public.studio_board_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS on_studio_board_items_updated ON public.studio_board_items;
CREATE TRIGGER on_studio_board_items_updated
  BEFORE UPDATE ON public.studio_board_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
