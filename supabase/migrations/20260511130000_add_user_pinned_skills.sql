CREATE TABLE IF NOT EXISTS public.user_pinned_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_pinned_skills_skill_slug_format_check CHECK (
    skill_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND length(skill_slug) BETWEEN 1 AND 64
  ),
  CONSTRAINT user_pinned_skills_user_slug_unique UNIQUE (user_id, skill_slug)
);

CREATE INDEX IF NOT EXISTS idx_user_pinned_skills_user_id
  ON public.user_pinned_skills(user_id);

ALTER TABLE public.user_pinned_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their pinned skills" ON public.user_pinned_skills;
CREATE POLICY "Users can view their pinned skills"
  ON public.user_pinned_skills
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their pinned skills" ON public.user_pinned_skills;
CREATE POLICY "Users can create their pinned skills"
  ON public.user_pinned_skills
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their pinned skills" ON public.user_pinned_skills;
CREATE POLICY "Users can delete their pinned skills"
  ON public.user_pinned_skills
  FOR DELETE
  USING (auth.uid() = user_id);
