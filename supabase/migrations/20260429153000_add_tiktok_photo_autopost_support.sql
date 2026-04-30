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
    'tiktok_photo_direct'
  )
);
