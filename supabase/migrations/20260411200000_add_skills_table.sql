-- Agent Skills storage (SKILL.md text + metadata). See https://agentskills.io/specification
-- Standard/curation later: insert rows with is_public = true (typically owned by a dedicated platform user via service role).

CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text,
  skill_document text NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skills_slug_format_check CHECK (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND length(slug) BETWEEN 1 AND 64
  ),
  CONSTRAINT skills_user_slug_unique UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_skills_user_id ON public.skills(user_id);

CREATE INDEX IF NOT EXISTS idx_skills_public ON public.skills(is_public)
  WHERE is_public = true;

COMMENT ON TABLE public.skills IS 'User and platform Agent Skills; skill_document is full SKILL.md (YAML frontmatter + body).';
COMMENT ON COLUMN public.skills.slug IS 'Machine name per Agent Skills spec; must match name in frontmatter.';
COMMENT ON COLUMN public.skills.title IS 'Optional human-readable label for UI; distinct from slug.';
COMMENT ON COLUMN public.skills.skill_document IS 'Full SKILL.md contents including YAML frontmatter.';
COMMENT ON COLUMN public.skills.is_public IS 'When true, visible to all authenticated users (e.g. curated standard skills).';

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view skills they own or that are public" ON public.skills;
CREATE POLICY "Users can view skills they own or that are public"
  ON public.skills
  FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS "Users can create their own skills" ON public.skills;
CREATE POLICY "Users can create their own skills"
  ON public.skills
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own skills" ON public.skills;
CREATE POLICY "Users can update their own skills"
  ON public.skills
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own skills" ON public.skills;
CREATE POLICY "Users can delete their own skills"
  ON public.skills
  FOR DELETE
  USING (auth.uid() = user_id);
