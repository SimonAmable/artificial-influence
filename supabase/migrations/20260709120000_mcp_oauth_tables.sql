CREATE TABLE IF NOT EXISTS public.mcp_oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL UNIQUE,
  client_secret_hash TEXT NULL,
  client_name TEXT NULL,
  redirect_uris TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  grant_types TEXT[] NOT NULL DEFAULT ARRAY['authorization_code', 'refresh_token'],
  response_types TEXT[] NOT NULL DEFAULT ARRAY['code'],
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.mcp_oauth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  code_challenge TEXT NULL,
  code_challenge_method TEXT NULL,
  resource TEXT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.mcp_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT NULL UNIQUE,
  client_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scopes TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  last_used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.mcp_tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NULL,
  token_id UUID NULL REFERENCES public.mcp_oauth_tokens(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT NULL,
  generation_id UUID NULL REFERENCES public.generations(id) ON DELETE SET NULL,
  request JSONB NOT NULL DEFAULT '{}'::jsonb,
  response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_clients_client_id
  ON public.mcp_oauth_clients(client_id);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_client_user
  ON public.mcp_oauth_codes(client_id, user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_user_client
  ON public.mcp_oauth_tokens(user_id, client_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_user_created_at
  ON public.mcp_tool_calls(user_id, created_at DESC);

ALTER TABLE public.mcp_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_tool_calls ENABLE ROW LEVEL SECURITY;
