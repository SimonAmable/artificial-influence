-- Fix: Recreate all credit-related functions
-- Run this if functions are missing or have type issues

-- Step 1: Drop all functions if they exist (to recreate them)
DROP FUNCTION IF EXISTS public.get_monthly_credits_for_price_id(TEXT);
DROP FUNCTION IF EXISTS public.is_yearly_subscription(TEXT);
DROP FUNCTION IF EXISTS public.add_credits(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.deduct_credits(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.grant_monthly_credits_for_yearly_subscriptions();

-- Step 2: Recreate get_monthly_credits_for_price_id function
CREATE OR REPLACE FUNCTION public.get_monthly_credits_for_price_id(price_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  credits_map JSONB := '{
    "price_1SrXYkK2MiVk67BiHuwPn21M": 100,
    "price_1SrXZ0K2MiVk67BiQY0XpX7z": 500,
    "price_1SrXZDK2MiVk67Bi0Y57icpS": 1750,
    "price_1SrWkoGYRyfMJZ0CCuVwjLKc": 100,
    "price_1SrWl8GYRyfMJZ0CeXU9f7LE": 500,
    "price_1SrWlMGYRyfMJZ0CTNcrZ1gS": 1750,
    "price_1SrWlzGYRyfMJZ0CICD6aj5j": 100,
    "price_1SrWmVGYRyfMJZ0CyKUeZ5T9": 500,
    "price_1SrWmtGYRyfMJZ0CzG1ac2Ra": 1750
  }'::JSONB;
BEGIN
  RETURN COALESCE((credits_map->>price_id)::INTEGER, 0);
END;
$$;

-- Step 3: Recreate is_yearly_subscription function
CREATE OR REPLACE FUNCTION public.is_yearly_subscription(price_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  yearly_price_ids TEXT[] := ARRAY[
    'price_1SrWlzGYRyfMJZ0CICD6aj5j',
    'price_1SrWmVGYRyfMJZ0CyKUeZ5T9',
    'price_1SrWmtGYRyfMJZ0CzG1ac2Ra'
  ];
BEGIN
  RETURN price_id = ANY(yearly_price_ids);
END;
$$;

-- Step 4: Recreate add_credits function
CREATE OR REPLACE FUNCTION public.add_credits(
  user_id UUID,
  credits_to_add INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance INTEGER;
BEGIN
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

-- Step 5: Recreate deduct_credits function
CREATE OR REPLACE FUNCTION public.deduct_credits(
  user_id UUID,
  credits_to_deduct INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_credits INTEGER;
  new_balance INTEGER;
BEGIN
  SELECT COALESCE(credits, 0) INTO current_credits
  FROM public.profiles
  WHERE id = user_id;

  IF current_credits IS NULL THEN
    RAISE EXCEPTION 'User not found: %', user_id;
  END IF;

  IF current_credits < credits_to_deduct THEN
    RETURN -1; -- Insufficient credits
  END IF;

  UPDATE public.profiles
  SET credits = credits - credits_to_deduct
  WHERE id = user_id
  RETURNING credits INTO new_balance;
  
  RETURN new_balance;
END;
$$;

-- Step 6: Recreate grant_monthly_credits_for_yearly_subscriptions function
CREATE OR REPLACE FUNCTION public.grant_monthly_credits_for_yearly_subscriptions()
RETURNS TABLE (
  user_id UUID,
  credits_granted INTEGER,
  subscription_id TEXT,
  price_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_record RECORD;
  monthly_credits INTEGER;
BEGIN
  -- Find active yearly subscriptions that need monthly credits
  FOR sub_record IN
    SELECT 
      s.user_id,
      s.stripe_subscription_id,
      s.price_id,
      s.last_credit_grant_date,
      s.status
    FROM public.subscriptions s
    WHERE s.status = 'active'
      AND public.is_yearly_subscription(s.price_id) = true
      AND (
        s.last_credit_grant_date IS NULL
        OR s.last_credit_grant_date < NOW() - INTERVAL '28 days'
      )
  LOOP
    -- Get monthly credits for this price_id
    monthly_credits := public.get_monthly_credits_for_price_id(sub_record.price_id);
    
    IF monthly_credits > 0 THEN
      -- Add credits to user
      PERFORM public.add_credits(sub_record.user_id, monthly_credits);
      
      -- Update last grant date
      UPDATE public.subscriptions
      SET last_credit_grant_date = NOW()
      WHERE stripe_subscription_id = sub_record.stripe_subscription_id;
      
      -- Return result
      user_id := sub_record.user_id;
      credits_granted := monthly_credits;
      subscription_id := sub_record.stripe_subscription_id;
      price_id := sub_record.price_id;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

-- Step 7: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.add_credits(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_monthly_credits_for_price_id(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_yearly_subscription(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_monthly_credits_for_yearly_subscriptions() TO service_role;

-- Step 8: Verify all functions were created
SELECT 
  proname as function_name,
  pg_get_function_identity_arguments(oid) as arguments,
  prorettype::regtype as return_type
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'add_credits',
    'deduct_credits',
    'get_monthly_credits_for_price_id',
    'is_yearly_subscription',
    'grant_monthly_credits_for_yearly_subscriptions'
  )
ORDER BY proname;

-- Step 9: Test the functions
-- Test get_monthly_credits_for_price_id
SELECT public.get_monthly_credits_for_price_id('price_1SrWmtGYRyfMJZ0CzG1ac2Ra'::TEXT) as creator_credits;
SELECT public.get_monthly_credits_for_price_id('price_1SrWkoGYRyfMJZ0CCuVwjLKc'::TEXT) as basic_credits;

-- Test is_yearly_subscription
SELECT public.is_yearly_subscription('price_1SrWmtGYRyfMJZ0CzG1ac2Ra'::TEXT) as is_yearly;
SELECT public.is_yearly_subscription('price_1SrWkoGYRyfMJZ0CCuVwjLKc'::TEXT) as is_monthly;
