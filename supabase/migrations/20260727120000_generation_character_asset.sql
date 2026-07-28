-- Track the primary saved character represented by any generated media row.
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS character_asset_id uuid
    REFERENCES public.assets(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.generations.character_asset_id IS
  'Primary user-owned character asset associated with this image, video, or audio generation.';

CREATE INDEX IF NOT EXISTS generations_user_character_created_idx
  ON public.generations (user_id, character_asset_id, created_at DESC)
  WHERE character_asset_id IS NOT NULL;

-- Recover historical links only when a reference storage path identifies exactly
-- one character owned by the same user. Ambiguous matches remain unlinked.
WITH exact_matches AS (
  SELECT
    g.id AS generation_id,
    min(a.id::text)::uuid AS character_asset_id
  FROM public.generations g
  JOIN public.assets a
    ON a.user_id = g.user_id
   AND a.category = 'character'
   AND a.supabase_storage_path = ANY(g.reference_images_supabase_storage_path)
  WHERE g.character_asset_id IS NULL
    AND g.reference_images_supabase_storage_path IS NOT NULL
    AND a.supabase_storage_path IS NOT NULL
  GROUP BY g.id
  HAVING count(DISTINCT a.id) = 1
)
UPDATE public.generations g
SET character_asset_id = exact_matches.character_asset_id
FROM exact_matches
WHERE g.id = exact_matches.generation_id;
