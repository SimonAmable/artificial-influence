-- Block negative deduct_credits calls (which would mint credits).

CREATE OR REPLACE FUNCTION public.add_credits(user_id uuid, credits_to_add integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  IF credits_to_add IS NULL OR credits_to_add <= 0 THEN
    RAISE EXCEPTION 'Invalid credits_to_add: must be positive';
  END IF;

  UPDATE public.profiles
  SET credits = COALESCE(credits, 0) + credits_to_add
  WHERE id = user_id
  RETURNING credits INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'User not found: %', user_id;
  END IF;

  RETURN new_balance;
END;
$$;

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
  IF credits_to_deduct IS NULL OR credits_to_deduct <= 0 THEN
    RAISE EXCEPTION 'Invalid credits_to_deduct: must be positive';
  END IF;

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
