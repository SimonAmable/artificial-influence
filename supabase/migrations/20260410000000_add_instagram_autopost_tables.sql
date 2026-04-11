CREATE TABLE IF NOT EXISTS public.instagram_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'instagram_login',
  connection_method text NOT NULL DEFAULT 'instagram_login',
  instagram_user_id text,
  instagram_username text,
  facebook_page_id text,
  facebook_page_name text,
  access_token_encrypted text NOT NULL,
  access_token_last4 text,
  token_expires_at timestamptz,
  status text NOT NULL DEFAULT 'connected',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT instagram_connections_user_id_unique UNIQUE (user_id),
  CONSTRAINT instagram_connections_status_check CHECK (status IN ('connected', 'disconnected', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_instagram_connections_user_id
  ON public.instagram_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_instagram_connections_ig_user_id
  ON public.instagram_connections(instagram_user_id);

CREATE TABLE IF NOT EXISTS public.autopost_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instagram_connection_id uuid REFERENCES public.instagram_connections(id) ON DELETE SET NULL,
  media_type text NOT NULL,
  media_url text NOT NULL,
  media_thumbnail_url text,
  caption text,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  attempts integer NOT NULL DEFAULT 0,
  provider_container_id text,
  provider_publish_id text,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT autopost_jobs_status_check CHECK (
    status IN ('draft', 'queued', 'processing', 'published', 'failed', 'cancelled')
  ),
  CONSTRAINT autopost_jobs_media_type_check CHECK (
    media_type IN ('image', 'reel', 'carousel', 'story')
  )
);

CREATE INDEX IF NOT EXISTS idx_autopost_jobs_user_id
  ON public.autopost_jobs(user_id);

CREATE INDEX IF NOT EXISTS idx_autopost_jobs_status_scheduled_at
  ON public.autopost_jobs(status, scheduled_at);

ALTER TABLE public.instagram_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autopost_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their Instagram connections" ON public.instagram_connections;
CREATE POLICY "Users can view their Instagram connections"
  ON public.instagram_connections
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their Instagram connections" ON public.instagram_connections;
CREATE POLICY "Users can create their Instagram connections"
  ON public.instagram_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their Instagram connections" ON public.instagram_connections;
CREATE POLICY "Users can update their Instagram connections"
  ON public.instagram_connections
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their Instagram connections" ON public.instagram_connections;
CREATE POLICY "Users can delete their Instagram connections"
  ON public.instagram_connections
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their autopost jobs" ON public.autopost_jobs;
CREATE POLICY "Users can view their autopost jobs"
  ON public.autopost_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their autopost jobs" ON public.autopost_jobs;
CREATE POLICY "Users can create their autopost jobs"
  ON public.autopost_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their autopost jobs" ON public.autopost_jobs;
CREATE POLICY "Users can update their autopost jobs"
  ON public.autopost_jobs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their autopost jobs" ON public.autopost_jobs;
CREATE POLICY "Users can delete their autopost jobs"
  ON public.autopost_jobs
  FOR DELETE
  USING (auth.uid() = user_id);
