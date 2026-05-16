-- Add shorts + product to asset categories (existing projects that already ran supabase-assets-setup.sql)
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_category_check;
ALTER TABLE public.assets
  ADD CONSTRAINT assets_category_check CHECK (category IN (
    'character', 'scene', 'texture', 'motion', 'audio', 'shorts', 'product'
  ));
