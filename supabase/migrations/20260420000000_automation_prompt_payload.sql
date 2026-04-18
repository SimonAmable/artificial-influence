-- Rich automation prompts: @ references, file attachments, slash templates (stored as JSON).

ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS prompt_payload jsonb;

UPDATE public.automations
SET prompt_payload = jsonb_build_object(
  'text', prompt,
  'refs', '[]'::jsonb,
  'attachments', '[]'::jsonb
)
WHERE prompt_payload IS NULL;

ALTER TABLE public.automations
  ALTER COLUMN prompt_payload SET NOT NULL,
  ALTER COLUMN prompt_payload SET DEFAULT '{"text":"","refs":[],"attachments":[]}'::jsonb;

ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_prompt_payload_text_nonempty;

ALTER TABLE public.automations
  ADD CONSTRAINT automations_prompt_payload_text_nonempty
  CHECK (length(trim(coalesce(prompt_payload->>'text', ''))) > 0);
