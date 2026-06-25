DO $$
BEGIN
  IF to_regclass('public.assets') IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.assets
  SET
    user_id = '34e26aab-d98a-425e-af89-9726776a3827'::uuid,
    visibility = 'private',
    updated_at = timezone('utc'::text, now())
  WHERE visibility = 'public';

  ALTER TABLE public.assets
    DROP CONSTRAINT IF EXISTS assets_visibility_private_only;

  ALTER TABLE public.assets
    ADD CONSTRAINT assets_visibility_private_only
    CHECK (visibility = 'private');

  DROP POLICY IF EXISTS "assets_select_own_or_public" ON public.assets;
  DROP POLICY IF EXISTS "assets_select_own" ON public.assets;
  CREATE POLICY "assets_select_own"
    ON public.assets
    FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);

  DROP POLICY IF EXISTS "assets_insert_own" ON public.assets;
  CREATE POLICY "assets_insert_own"
    ON public.assets
    FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id AND visibility = 'private');

  DROP POLICY IF EXISTS "assets_update_own" ON public.assets;
  CREATE POLICY "assets_update_own"
    ON public.assets
    FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id AND visibility = 'private');

  DROP POLICY IF EXISTS "assets_delete_own" ON public.assets;
  CREATE POLICY "assets_delete_own"
    ON public.assets
    FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);
END $$;
