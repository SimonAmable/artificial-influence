ALTER TABLE public.social_connections DROP CONSTRAINT IF EXISTS social_connections_provider_check;
ALTER TABLE public.social_connections ADD CONSTRAINT social_connections_provider_check CHECK (
  provider IN ('instagram', 'tiktok', 'fanvue')
);

ALTER TABLE public.autopost_jobs DROP CONSTRAINT IF EXISTS autopost_jobs_provider_check;
ALTER TABLE public.autopost_jobs ADD CONSTRAINT autopost_jobs_provider_check CHECK (
  provider IN ('instagram', 'tiktok', 'fanvue')
);

ALTER TABLE public.autopost_jobs DROP CONSTRAINT IF EXISTS autopost_jobs_media_type_check;
ALTER TABLE public.autopost_jobs ADD CONSTRAINT autopost_jobs_media_type_check CHECK (
  media_type IN (
    'image',
    'feed_video',
    'reel',
    'carousel',
    'story',
    'tiktok_video_upload',
    'tiktok_video_direct',
    'tiktok_photo_upload',
    'tiktok_photo_direct',
    'fanvue_post'
  )
);

CREATE TABLE IF NOT EXISTS public.fanvue_media_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  social_connection_id uuid NOT NULL REFERENCES public.social_connections(id) ON DELETE CASCADE,
  fanvue_media_uuid text NOT NULL,
  name text,
  filename text,
  media_type text,
  status text NOT NULL DEFAULT 'processing',
  thumbnail_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fanvue_media_cache_connection_media_key UNIQUE (social_connection_id, fanvue_media_uuid)
);

CREATE INDEX IF NOT EXISTS idx_fanvue_media_cache_user_id
  ON public.fanvue_media_cache(user_id);

CREATE INDEX IF NOT EXISTS idx_fanvue_media_cache_connection_id
  ON public.fanvue_media_cache(social_connection_id);

ALTER TABLE public.fanvue_media_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their fanvue media cache" ON public.fanvue_media_cache;
CREATE POLICY "Users can view their fanvue media cache"
  ON public.fanvue_media_cache
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their fanvue media cache" ON public.fanvue_media_cache;
CREATE POLICY "Users can create their fanvue media cache"
  ON public.fanvue_media_cache
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their fanvue media cache" ON public.fanvue_media_cache;
CREATE POLICY "Users can update their fanvue media cache"
  ON public.fanvue_media_cache
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their fanvue media cache" ON public.fanvue_media_cache;
CREATE POLICY "Users can delete their fanvue media cache"
  ON public.fanvue_media_cache
  FOR DELETE
  USING (auth.uid() = user_id);
