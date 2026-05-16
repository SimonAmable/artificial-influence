-- Remotion Video Editor setup
-- Run this whole file in the Supabase SQL editor.
--
-- What this sets up:
-- 1. `public.editor_projects` for saved timeline projects
-- 2. `public.uploads` for imported editor assets
-- 3. `public.editor_render_jobs` for async MP4 exports
-- 4. `public-bucket` storage config and policies for:
--    - {user_id}/user-uploads/*
--    - {user_id}/editor-renders/*
--
-- Notes:
-- - This file is idempotent and safe to rerun.
-- - It intentionally uses `auth.users(id)` so it works even if your `profiles`
--   table is missing or was not recreated yet.

BEGIN;

-- Shared updated_at trigger helper
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- Saved editor projects
CREATE TABLE IF NOT EXISTS public.editor_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Project',
  state_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_editor_projects_user_updated_at
  ON public.editor_projects (user_id, updated_at DESC);

ALTER TABLE public.editor_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own editor projects" ON public.editor_projects;
CREATE POLICY "Users can view own editor projects"
  ON public.editor_projects
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own editor projects" ON public.editor_projects;
CREATE POLICY "Users can insert own editor projects"
  ON public.editor_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own editor projects" ON public.editor_projects;
CREATE POLICY "Users can update own editor projects"
  ON public.editor_projects
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own editor projects" ON public.editor_projects;
CREATE POLICY "Users can delete own editor projects"
  ON public.editor_projects
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS on_editor_projects_updated ON public.editor_projects;
CREATE TRIGGER on_editor_projects_updated
  BEFORE UPDATE ON public.editor_projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Generic uploads table needed by editor asset imports
CREATE TABLE IF NOT EXISTS public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  bucket TEXT NOT NULL DEFAULT 'public-bucket',
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  label TEXT,
  size_bytes BIGINT,
  width INT,
  height INT,
  duration_seconds NUMERIC,
  content_hash TEXT,
  original_filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_uploads_user_created
  ON public.uploads (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uploads_user_storage_path
  ON public.uploads (user_id, storage_path);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uploads_user_bucket_content_hash
  ON public.uploads (user_id, bucket, content_hash)
  WHERE content_hash IS NOT NULL;

ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own uploads" ON public.uploads;
CREATE POLICY "Users read own uploads"
  ON public.uploads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own uploads" ON public.uploads;
CREATE POLICY "Users insert own uploads"
  ON public.uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own uploads" ON public.uploads;
CREATE POLICY "Users update own uploads"
  ON public.uploads
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own uploads" ON public.uploads;
CREATE POLICY "Users delete own uploads"
  ON public.uploads
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Async editor render jobs
CREATE TABLE IF NOT EXISTS public.editor_render_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.editor_projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'rendering', 'completed', 'failed')
  ),
  progress NUMERIC(5,2),
  output_storage_path TEXT,
  output_url TEXT,
  error_message TEXT,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  project_snapshot JSONB NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_editor_render_jobs_user_id_created_at
  ON public.editor_render_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_editor_render_jobs_project_id
  ON public.editor_render_jobs (project_id);

CREATE INDEX IF NOT EXISTS idx_editor_render_jobs_status
  ON public.editor_render_jobs (status);

ALTER TABLE public.editor_render_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own editor render jobs" ON public.editor_render_jobs;
CREATE POLICY "Users can view own editor render jobs"
  ON public.editor_render_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own editor render jobs" ON public.editor_render_jobs;
CREATE POLICY "Users can insert own editor render jobs"
  ON public.editor_render_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage editor render jobs" ON public.editor_render_jobs;
CREATE POLICY "Service role can manage editor render jobs"
  ON public.editor_render_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS on_editor_render_jobs_updated ON public.editor_render_jobs;
CREATE TRIGGER on_editor_render_jobs_updated
  BEFORE UPDATE ON public.editor_render_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Ensure the public bucket exists and is public for getPublicUrl() usage
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-bucket', 'public-bucket', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

-- Storage policies for editor imports and exported MP4s
DROP POLICY IF EXISTS "Users can upload editor files to public bucket" ON storage.objects;
CREATE POLICY "Users can upload editor files to public bucket"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'public-bucket'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (
      name LIKE auth.uid()::text || '/user-uploads/%'
      OR name LIKE auth.uid()::text || '/editor-renders/%'
    )
  );

DROP POLICY IF EXISTS "Users can update editor files in public bucket" ON storage.objects;
CREATE POLICY "Users can update editor files in public bucket"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'public-bucket'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (
      name LIKE auth.uid()::text || '/user-uploads/%'
      OR name LIKE auth.uid()::text || '/editor-renders/%'
    )
  );

DROP POLICY IF EXISTS "Users can delete editor files in public bucket" ON storage.objects;
CREATE POLICY "Users can delete editor files in public bucket"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'public-bucket'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (
      name LIKE auth.uid()::text || '/user-uploads/%'
      OR name LIKE auth.uid()::text || '/editor-renders/%'
    )
  );

DROP POLICY IF EXISTS "Anyone can view editor files in public bucket" ON storage.objects;
CREATE POLICY "Anyone can view editor files in public bucket"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'public-bucket'
    AND (
      name LIKE '%/user-uploads/%'
      OR name LIKE '%/editor-renders/%'
    )
  );

COMMIT;
