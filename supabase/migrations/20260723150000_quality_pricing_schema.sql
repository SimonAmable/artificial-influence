-- Quality-based pricing: tier rules on models and audit snapshot on generations.

ALTER TABLE public.models
  ADD COLUMN IF NOT EXISTS pricing_config jsonb;

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb;

COMMENT ON COLUMN public.models.pricing_config IS
  'Tiered credit pricing rules keyed by parameter values (flat_per_output, tiered_per_output, or per_second).';

COMMENT ON COLUMN public.generations.pricing_snapshot IS
  'Pricing quote metadata captured at request time (strategy, matched tier, parameters).';
