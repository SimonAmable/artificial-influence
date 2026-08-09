-- Credit minting lockdown: ban abusers, lock profiles + credit RPC privileges.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_banned
  ON public.profiles (is_banned)
  WHERE is_banned = true;

-- Prevent client-side writes to billing / identity fields.
CREATE OR REPLACE FUNCTION public.protect_profiles_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'service_role' OR session_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.credits IS DISTINCT FROM OLD.credits
     OR NEW.is_pro IS DISTINCT FROM OLD.is_pro
     OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Cannot update protected profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profiles_sensitive_columns ON public.profiles;
CREATE TRIGGER protect_profiles_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiles_sensitive_columns();

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND credits IS NOT DISTINCT FROM (
      SELECT p.credits FROM public.profiles p WHERE p.id = auth.uid()
    )
    AND is_pro IS NOT DISTINCT FROM (
      SELECT p.is_pro FROM public.profiles p WHERE p.id = auth.uid()
    )
    AND is_banned IS NOT DISTINCT FROM (
      SELECT p.is_banned FROM public.profiles p WHERE p.id = auth.uid()
    )
    AND email IS NOT DISTINCT FROM (
      SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Harden deduct_credits: only service_role or the account owner may deduct.
CREATE OR REPLACE FUNCTION public.deduct_credits(user_id uuid, credits_to_deduct integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_credits INTEGER;
  new_balance INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM user_id THEN
      RAISE EXCEPTION 'Unauthorized credit deduction';
    END IF;
  END IF;

  SELECT COALESCE(credits, 0)
  INTO current_credits
  FROM public.profiles
  WHERE id = user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', user_id;
  END IF;

  IF current_credits < credits_to_deduct THEN
    RETURN -1;
  END IF;

  UPDATE public.profiles
  SET credits = credits - credits_to_deduct,
      updated_at = timezone('utc'::text, now())
  WHERE id = user_id
  RETURNING credits INTO new_balance;

  RETURN new_balance;
END;
$$;

-- Revoke public mint / fulfill; keep deduct for authenticated + service_role.
REVOKE ALL ON FUNCTION public.add_credits(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_credits(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.add_credits(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.fulfill_credit_purchase(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fulfill_credit_purchase(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.fulfill_credit_purchase(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_credit_purchase(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.fulfill_fanvue_credit_purchase(text, uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fulfill_fanvue_credit_purchase(text, uuid, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.fulfill_fanvue_credit_purchase(text, uuid, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_fanvue_credit_purchase(text, uuid, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.grant_monthly_credits_for_yearly_subscriptions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_monthly_credits_for_yearly_subscriptions() FROM anon;
REVOKE ALL ON FUNCTION public.grant_monthly_credits_for_yearly_subscriptions() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.grant_monthly_credits_for_yearly_subscriptions() TO service_role;

REVOKE ALL ON FUNCTION public.deduct_credits(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deduct_credits(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, integer) TO service_role;

-- Ban confirmed abusers and zero fraudulent balances.
DO $$
DECLARE
  banned_ids UUID[] := ARRAY[
    'ed800471-24e9-43cf-9d96-25f47fd90725'::uuid,
    'd9e9ebbf-7af0-44d2-b21d-01e9fd7e919a'::uuid,
    'fb24dcb4-0afa-4de0-957d-63405d5244a6'::uuid,
    '757138b6-eef4-4f0e-bbec-ba3e03c48767'::uuid,
    '03c2cf2f-247c-4484-9dff-d41b182f46a0'::uuid,
    '73203ddc-cd54-412a-b661-8a5e26fa2a92'::uuid,
    '9e3a45bd-0152-4856-bda5-ebd1ccbed069'::uuid
  ];
  preserved_emails TEXT[] := ARRAY[
    'simonamable@gmail.com',
    'notsimonamable@gmail.com',
    'simonamable67@gmail.com',
    'amablesimon@gmail.com',
    'sohan@aibud.ca',
    'pmdeuxaibud@gmail.com',
    'thevibevixens@gmail.com'
  ];
BEGIN
  UPDATE public.profiles
  SET
    is_banned = true,
    credits = 0,
    is_pro = false,
    updated_at = timezone('utc'::text, now())
  WHERE id = ANY (banned_ids);

  UPDATE public.profiles p
  SET
    credits = 10,
    is_pro = false,
    updated_at = timezone('utc'::text, now())
  WHERE p.credits > 10
    AND NOT (p.email = ANY (preserved_emails))
    AND NOT (p.id = ANY (banned_ids))
    AND NOT EXISTS (
      SELECT 1
      FROM public.credit_purchases cp
      WHERE cp.user_id = p.id
        AND cp.status = 'fulfilled'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.subscriptions s
      WHERE s.user_id = p.id
        AND s.status IN ('active', 'trialing')
    );

  UPDATE public.mcp_oauth_tokens
  SET revoked_at = timezone('utc'::text, now())
  WHERE user_id = ANY (banned_ids)
    AND revoked_at IS NULL;
END;
$$;
