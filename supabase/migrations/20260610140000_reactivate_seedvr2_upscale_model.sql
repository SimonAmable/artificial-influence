-- Re-enable SeedVR2 as an optional upscale model alongside P-Image Upscale
UPDATE public.models
SET
  is_active = true,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'zsxkib/seedvr2';
