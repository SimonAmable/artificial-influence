-- Allow in-feed video (distinct from Reels) in autopost_jobs.

ALTER TABLE public.autopost_jobs DROP CONSTRAINT IF EXISTS autopost_jobs_media_type_check;

ALTER TABLE public.autopost_jobs ADD CONSTRAINT autopost_jobs_media_type_check CHECK (
  media_type IN ('image', 'reel', 'feed_video', 'carousel', 'story')
);
