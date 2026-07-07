-- Product variants share the same template engine, while allowing each
-- branded product to expose a focused subset of public and user templates.
ALTER TABLE public.templates
ADD COLUMN IF NOT EXISTS product_ids text[] NOT NULL DEFAULT ARRAY['unican']::text[];

UPDATE public.templates
SET product_ids = ARRAY['unican']::text[]
WHERE product_ids IS NULL OR cardinality(product_ids) = 0;

CREATE INDEX IF NOT EXISTS idx_templates_product_ids
ON public.templates USING gin (product_ids);

CREATE INDEX IF NOT EXISTS idx_templates_product_visibility_category
ON public.templates USING gin (product_ids)
WHERE visibility = 'public';
