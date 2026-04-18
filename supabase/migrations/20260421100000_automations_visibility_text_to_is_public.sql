-- One-time upgrade if an older migration added `visibility` text instead of `is_public` boolean.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'automations'
      AND column_name = 'visibility'
  ) THEN
    ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
    UPDATE public.automations SET is_public = (visibility = 'public');
    DROP INDEX IF EXISTS idx_automations_public;
    ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_visibility_check;
    ALTER TABLE public.automations DROP COLUMN IF EXISTS visibility;
    CREATE INDEX IF NOT EXISTS idx_automations_public
      ON public.automations(is_public, updated_at DESC)
      WHERE is_public = true;
    DROP POLICY IF EXISTS "Users can view their automations" ON public.automations;
    CREATE POLICY "Users can view their automations"
      ON public.automations
      FOR SELECT
      USING (auth.uid() = user_id OR is_public = true);
  END IF;
END $$;
