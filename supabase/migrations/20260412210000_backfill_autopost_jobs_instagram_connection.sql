-- Backfill instagram_connection_id for rows created before account was required per draft,
-- or after the FK was set NULL (e.g. disconnect). Uses each user's most recently updated
-- connected Instagram connection.

UPDATE public.autopost_jobs j
SET instagram_connection_id = (
  SELECT c.id
  FROM public.instagram_connections c
  WHERE c.user_id = j.user_id
    AND c.status = 'connected'
  ORDER BY c.updated_at DESC NULLS LAST
  LIMIT 1
)
WHERE j.instagram_connection_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.instagram_connections c2
    WHERE c2.user_id = j.user_id
      AND c2.status = 'connected'
  );
