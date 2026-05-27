-- Normalize existing template categories to the new gallery set.

UPDATE public.templates
SET category = CASE
  WHEN category IN ('photo', 'video', 'slideshow') THEN category
  WHEN output_kind = 'video' THEN 'video'
  WHEN output_kind = 'slideshow' THEN 'slideshow'
  ELSE 'photo'
END
WHERE category NOT IN ('photo', 'video', 'slideshow');

ALTER TABLE public.templates
  DROP CONSTRAINT IF EXISTS templates_category_check;

ALTER TABLE public.templates
  ADD CONSTRAINT templates_category_check
  CHECK (category IN ('photo', 'video', 'slideshow'));
