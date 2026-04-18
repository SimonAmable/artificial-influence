-- Optional human-readable description for automations (shown in UI / community).

ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.automations.description IS 'Optional short description; distinct from the agent prompt.';
