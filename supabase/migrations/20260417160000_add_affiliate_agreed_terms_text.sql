-- Snapshot of the exact agreement text the affiliate accepted at signup (audit / disputes).

ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS agreed_terms_text text;

UPDATE public.affiliates
SET agreed_terms_text = ''
WHERE agreed_terms_text IS NULL;

ALTER TABLE public.affiliates
  ALTER COLUMN agreed_terms_text SET NOT NULL,
  ALTER COLUMN agreed_terms_text SET DEFAULT '';

COMMENT ON COLUMN public.affiliates.agreed_terms_text IS 'Exact affiliate program agreement copy stored at registration time.';
