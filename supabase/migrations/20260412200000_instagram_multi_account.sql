-- Allow multiple Instagram accounts per app user (unique on user + IG user id).

DELETE FROM public.instagram_connections
WHERE instagram_user_id IS NULL OR trim(instagram_user_id) = '';

ALTER TABLE public.instagram_connections DROP CONSTRAINT IF EXISTS instagram_connections_user_id_unique;

ALTER TABLE public.instagram_connections
  ALTER COLUMN instagram_user_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS instagram_connections_user_id_instagram_user_id_key
  ON public.instagram_connections (user_id, instagram_user_id);
