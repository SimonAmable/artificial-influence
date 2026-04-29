ALTER TABLE public.autopost_jobs
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'instagram';

ALTER TABLE public.autopost_jobs
  ADD COLUMN IF NOT EXISTS social_connection_id uuid REFERENCES public.social_connections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_autopost_jobs_provider_status
  ON public.autopost_jobs(provider, status);

CREATE INDEX IF NOT EXISTS idx_autopost_jobs_social_connection_id
  ON public.autopost_jobs(social_connection_id);

UPDATE public.autopost_jobs
SET provider = 'instagram'
WHERE provider IS NULL OR provider = '';

ALTER TABLE public.autopost_jobs DROP CONSTRAINT IF EXISTS autopost_jobs_provider_check;
ALTER TABLE public.autopost_jobs ADD CONSTRAINT autopost_jobs_provider_check CHECK (
  provider IN ('instagram', 'tiktok')
);

ALTER TABLE public.autopost_jobs DROP CONSTRAINT IF EXISTS autopost_jobs_status_check;
ALTER TABLE public.autopost_jobs ADD CONSTRAINT autopost_jobs_status_check CHECK (
  status IN (
    'draft',
    'queued',
    'processing',
    'inbox_delivered',
    'published',
    'failed',
    'cancelled'
  )
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
    'tiktok_video_direct'
  )
);
