-- Add thumbnails to asset categories (run in Supabase SQL editor if assets table already exists)
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_category_check;
ALTER TABLE public.assets
  ADD CONSTRAINT assets_category_check CHECK (category IN (
    'character', 'scene', 'texture', 'thumbnails', 'motion', 'audio', 'shorts', 'product'
  ));
