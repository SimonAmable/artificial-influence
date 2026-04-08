-- Onboarding answers as a single JSON document (run after supabase-onboarding-setup.sql)
-- Theme in JSON is for product metrics only — app appearance is controlled by next-themes / user toggles, not this column.

ALTER TABLE public.profiles DROP COLUMN IF EXISTS onboarding_theme;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS onboarding_team_size;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS onboarding_role;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_json_data JSONB NULL;

COMMENT ON COLUMN public.profiles.onboarding_json_data IS
  'Structured onboarding answers (v1: theme, fullName, teamSize, role). Theme is analytics-only; do not hydrate ThemeProvider from this field.';
