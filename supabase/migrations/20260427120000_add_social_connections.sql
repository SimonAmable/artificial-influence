CREATE TABLE IF NOT EXISTS public.social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  username text,
  display_name text,
  avatar_url text,
  access_token_encrypted text NOT NULL,
  access_token_last4 text,
  refresh_token_encrypted text,
  refresh_token_last4 text,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'connected',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_connections_provider_check CHECK (provider IN ('instagram', 'tiktok')),
  CONSTRAINT social_connections_status_check CHECK (status IN ('connected', 'disconnected', 'error', 'expired')),
  CONSTRAINT social_connections_user_provider_account_key UNIQUE (user_id, provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_connections_user_id
  ON public.social_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_social_connections_provider_status
  ON public.social_connections(provider, status);

CREATE INDEX IF NOT EXISTS idx_social_connections_user_provider_status
  ON public.social_connections(user_id, provider, status);

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their social connections" ON public.social_connections;
CREATE POLICY "Users can view their social connections"
  ON public.social_connections
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their social connections" ON public.social_connections;
CREATE POLICY "Users can create their social connections"
  ON public.social_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their social connections" ON public.social_connections;
CREATE POLICY "Users can update their social connections"
  ON public.social_connections
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their social connections" ON public.social_connections;
CREATE POLICY "Users can delete their social connections"
  ON public.social_connections
  FOR DELETE
  USING (auth.uid() = user_id);

INSERT INTO public.social_connections (
  user_id,
  provider,
  provider_account_id,
  username,
  display_name,
  avatar_url,
  access_token_encrypted,
  access_token_last4,
  token_expires_at,
  scopes,
  status,
  metadata,
  created_at,
  updated_at
)
SELECT
  ic.user_id,
  'instagram',
  ic.instagram_user_id,
  ic.instagram_username,
  COALESCE(NULLIF(ic.metadata #>> '{profile,name}', ''), ic.instagram_username),
  NULLIF(ic.metadata #>> '{profile,profile_picture_url}', ''),
  ic.access_token_encrypted,
  ic.access_token_last4,
  ic.token_expires_at,
  '{}'::text[],
  CASE
    WHEN ic.status IN ('connected', 'disconnected', 'error') THEN ic.status
    ELSE 'error'
  END,
  ic.metadata || jsonb_build_object('instagram_connection_id', ic.id),
  ic.created_at,
  ic.updated_at
FROM public.instagram_connections ic
WHERE ic.instagram_user_id IS NOT NULL
  AND trim(ic.instagram_user_id) <> ''
  AND ic.access_token_encrypted IS NOT NULL
ON CONFLICT (user_id, provider, provider_account_id) DO UPDATE SET
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  avatar_url = EXCLUDED.avatar_url,
  access_token_encrypted = EXCLUDED.access_token_encrypted,
  access_token_last4 = EXCLUDED.access_token_last4,
  token_expires_at = EXCLUDED.token_expires_at,
  status = EXCLUDED.status,
  metadata = public.social_connections.metadata || EXCLUDED.metadata,
  updated_at = EXCLUDED.updated_at;
