-- Brand kits: one row per kit (Business DNA form + Creative Agent).

-- Run once in the Supabase SQL editor. Requires `public.handle_updated_at` (Supabase default).



CREATE TABLE IF NOT EXISTS public.brand_kits (

  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL DEFAULT 'My brand',

  is_default BOOLEAN NOT NULL DEFAULT false,



  website_url TEXT NULL,

  font_family TEXT NULL,



  reference_images TEXT[] NOT NULL DEFAULT '{}'::text[],

  reference_videos TEXT[] NOT NULL DEFAULT '{}'::text[],



  logo_url TEXT NULL,

  logo_dark_url TEXT NULL,

  icon_url TEXT NULL,

  icon_dark_url TEXT NULL,



  -- [{ "hex": "#112233", "role": "primary|…|other", "label": "..." }]

  colors JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- { "headingFont", "bodyFont", "monoFont", "notes" }

  typography JSONB NOT NULL DEFAULT '{}'::jsonb,



  tagline TEXT NULL,

  brand_values TEXT[] NOT NULL DEFAULT '{}'::text[],

  aesthetic_tags TEXT[] NOT NULL DEFAULT '{}'::text[],

  tone_tags TEXT[] NOT NULL DEFAULT '{}'::text[],



  notes TEXT NULL,



  avoid_words TEXT[] NOT NULL DEFAULT '{}'::text[],

  layout_notes TEXT NULL,

  audience TEXT NULL,



  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())

);



CREATE INDEX IF NOT EXISTS idx_brand_kits_user_updated

  ON public.brand_kits (user_id, updated_at DESC);



CREATE UNIQUE INDEX IF NOT EXISTS brand_kits_one_default_per_user

  ON public.brand_kits (user_id)

  WHERE (is_default);



ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;



CREATE POLICY "Users select own brand kits"

  ON public.brand_kits FOR SELECT

  USING (auth.uid() = user_id);



CREATE POLICY "Users insert own brand kits"

  ON public.brand_kits FOR INSERT

  WITH CHECK (auth.uid() = user_id);



CREATE POLICY "Users update own brand kits"

  ON public.brand_kits FOR UPDATE

  USING (auth.uid() = user_id);



CREATE POLICY "Users delete own brand kits"

  ON public.brand_kits FOR DELETE

  USING (auth.uid() = user_id);



DROP TRIGGER IF EXISTS on_brand_kit_updated ON public.brand_kits;

CREATE TRIGGER on_brand_kit_updated

  BEFORE UPDATE ON public.brand_kits

  FOR EACH ROW

  EXECUTE FUNCTION public.handle_updated_at();


