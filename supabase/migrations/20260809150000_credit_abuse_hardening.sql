-- Credit-abuse hardening:
-- 1. Make subscription and credit tables server-write-only.
-- 2. Add an append-only ledger and atomic credit reservations.
-- 3. Make all privileged credit RPCs service-role-only and idempotent.

BEGIN;

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS credit_reservation_key TEXT;

CREATE INDEX IF NOT EXISTS idx_generations_credit_reservation_key
  ON public.generations (credit_reservation_key)
  WHERE credit_reservation_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'grant',
    'generation_reservation',
    'generation_release',
    'adjustment',
    'refund_reversal'
  )),
  idempotency_key TEXT NOT NULL UNIQUE,
  reference_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created
  ON public.credit_ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.credit_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  reference_id TEXT,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'captured', 'released')),
  balance_after INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_user_status
  ON public.credit_reservations (user_id, status, created_at DESC);

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_reservations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.credit_ledger FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.credit_reservations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.credit_ledger TO service_role;
GRANT ALL ON TABLE public.credit_reservations TO service_role;

-- Billing state must never be client-writable. Users retain read-only access to their own rows.
REVOKE ALL ON TABLE public.subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;

REVOKE ALL ON TABLE public.credit_purchases FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.credit_purchases TO authenticated;
GRANT ALL ON TABLE public.credit_purchases TO service_role;

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

DROP POLICY IF EXISTS "Service role can insert subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can update subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Service role can insert subscriptions"
  ON public.subscriptions FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY "Service role can update subscriptions"
  ON public.subscriptions FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Service role can delete subscriptions"
  ON public.subscriptions FOR DELETE TO service_role
  USING (true);
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- These RPCs are not public APIs. Application code must use the server-role client.
REVOKE ALL ON FUNCTION public.add_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.deduct_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fulfill_credit_purchase(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fulfill_fanvue_credit_purchase(text, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_monthly_credits_for_yearly_subscriptions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_active_subscriptions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.grant_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_idempotency_key TEXT,
  p_entry_type TEXT DEFAULT 'grant',
  p_reference_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(balance_after INTEGER, already_granted BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inserted_id UUID;
  new_balance INTEGER;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Unauthorized credit grant';
  END IF;
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Credit grants must be positive';
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'A non-empty idempotency key is required';
  END IF;
  IF p_entry_type NOT IN ('grant', 'adjustment', 'refund_reversal') THEN
    RAISE EXCEPTION 'Invalid credit grant type';
  END IF;

  INSERT INTO public.credit_ledger (
    user_id, amount, entry_type, idempotency_key, reference_id, metadata
  ) VALUES (
    p_user_id, p_amount, p_entry_type, p_idempotency_key, p_reference_id, COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT COALESCE(p.credits, 0) INTO new_balance
    FROM public.profiles p WHERE p.id = p_user_id;
    RETURN QUERY SELECT COALESCE(new_balance, 0), true;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET credits = COALESCE(credits, 0) + p_amount,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id
  RETURNING credits INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  RETURN QUERY SELECT new_balance, false;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_idempotency_key TEXT,
  p_reference_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(reservation_id UUID, balance_after INTEGER, reservation_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing public.credit_reservations%ROWTYPE;
  inserted public.credit_reservations%ROWTYPE;
  new_balance INTEGER;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Unauthorized credit reservation';
  END IF;
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Credit reservations must be positive';
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'A non-empty idempotency key is required';
  END IF;

  SELECT * INTO existing
  FROM public.credit_reservations
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF existing.user_id <> p_user_id OR existing.amount <> p_amount THEN
      RAISE EXCEPTION 'Reservation idempotency key reuse with different request';
    END IF;
    RETURN QUERY SELECT existing.id, existing.balance_after, existing.status;
    RETURN;
  END IF;

  INSERT INTO public.credit_reservations (
    user_id, amount, idempotency_key, reference_id, metadata
  ) VALUES (
    p_user_id, p_amount, p_idempotency_key, p_reference_id, COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING * INTO inserted;

  IF inserted.id IS NULL THEN
    SELECT * INTO existing
    FROM public.credit_reservations
    WHERE idempotency_key = p_idempotency_key
    FOR UPDATE;
    RETURN QUERY SELECT existing.id, existing.balance_after, existing.status;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET credits = credits - p_amount,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id
    AND COALESCE(credits, 0) >= p_amount
  RETURNING credits INTO new_balance;

  IF new_balance IS NULL THEN
    DELETE FROM public.credit_reservations WHERE id = inserted.id;
    RETURN QUERY SELECT NULL::UUID, NULL::INTEGER, 'insufficient'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.credit_ledger (
    user_id, amount, entry_type, idempotency_key, reference_id, metadata
  ) VALUES (
    p_user_id,
    -p_amount,
    'generation_reservation',
    'reservation:' || p_idempotency_key,
    p_reference_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  UPDATE public.credit_reservations
  SET balance_after = new_balance
  WHERE id = inserted.id;

  RETURN QUERY SELECT inserted.id, new_balance, 'reserved'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_credit_reservation(p_idempotency_key TEXT)
RETURNS TABLE(reservation_id UUID, balance_after INTEGER, reservation_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  reservation public.credit_reservations%ROWTYPE;
  current_balance INTEGER;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Unauthorized credit capture';
  END IF;
  SELECT * INTO reservation
  FROM public.credit_reservations
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit reservation not found: %', p_idempotency_key;
  END IF;

  IF reservation.status = 'reserved' THEN
    UPDATE public.credit_reservations
    SET status = 'captured', settled_at = timezone('utc'::text, now())
    WHERE id = reservation.id;
  END IF;

  SELECT COALESCE(credits, 0) INTO current_balance
  FROM public.profiles WHERE id = reservation.user_id;
  RETURN QUERY SELECT reservation.id, current_balance, 'captured'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_credit_reservation(p_idempotency_key TEXT)
RETURNS TABLE(reservation_id UUID, balance_after INTEGER, reservation_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  reservation public.credit_reservations%ROWTYPE;
  current_balance INTEGER;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Unauthorized credit release';
  END IF;
  SELECT * INTO reservation
  FROM public.credit_reservations
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit reservation not found: %', p_idempotency_key;
  END IF;

  IF reservation.status = 'reserved' THEN
    UPDATE public.profiles
    SET credits = COALESCE(credits, 0) + reservation.amount,
        updated_at = timezone('utc'::text, now())
    WHERE id = reservation.user_id
    RETURNING credits INTO current_balance;

    UPDATE public.credit_reservations
    SET status = 'released', settled_at = timezone('utc'::text, now())
    WHERE id = reservation.id;

    INSERT INTO public.credit_ledger (
      user_id, amount, entry_type, idempotency_key, reference_id, metadata
    ) VALUES (
      reservation.user_id,
      reservation.amount,
      'generation_release',
      'release:' || reservation.idempotency_key,
      reservation.reference_id,
      reservation.metadata
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  ELSE
    SELECT COALESCE(credits, 0) INTO current_balance
    FROM public.profiles WHERE id = reservation.user_id;
  END IF;

  RETURN QUERY SELECT reservation.id, current_balance, reservation.status;
END;
$$;

-- Keep the old RPC name for server-side compatibility, but route it through the ledger.
CREATE OR REPLACE FUNCTION public.add_credits(user_id UUID, credits_to_add INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result_balance INTEGER;
BEGIN
  SELECT g.balance_after INTO result_balance
  FROM public.grant_credits(
    user_id,
    credits_to_add,
    'legacy-add:' || user_id::text || ':' || txid_current()::text,
    'grant',
    NULL,
    '{}'::jsonb
  ) AS g;
  RETURN result_balance;
END;
$$;

-- Keep old callers safe: this is now an exact, server-only reservation and capture.
CREATE OR REPLACE FUNCTION public.deduct_credits(user_id UUID, credits_to_deduct INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result_balance INTEGER;
  result_status TEXT;
  legacy_key TEXT := 'legacy-deduct:' || user_id::text || ':' || txid_current()::text;
BEGIN
  SELECT r.balance_after, r.reservation_status INTO result_balance, result_status
  FROM public.reserve_credits(user_id, credits_to_deduct, legacy_key, NULL, '{}'::jsonb) AS r;
  IF result_status = 'insufficient' THEN
    RETURN -1;
  END IF;
  PERFORM public.capture_credit_reservation(legacy_key);
  RETURN result_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_credits(uuid, integer, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.capture_credit_reservation(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_credit_reservation(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, integer) TO service_role;

COMMIT;
