-- ============================================
-- Credit System Setup for Stripe Subscriptions
-- ============================================
-- This migration adds credit allocation functionality
-- Run this in Supabase SQL Editor

-- Step 1: Add credits column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0 NOT NULL;

-- Step 2: Add last_credit_grant_date to subscriptions table
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS last_credit_grant_date TIMESTAMP WITH TIME ZONE;

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_credits ON public.profiles(credits);
CREATE INDEX IF NOT EXISTS idx_subscriptions_last_credit_grant 
ON public.subscriptions(last_credit_grant_date) 
WHERE status = 'active';

-- Step 4: Function to get monthly credits for a Price ID
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

-- Step 5: Function to check if subscription is yearly
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

-- Step 6: Function to add credits to a user
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

-- Step 7: Function to deduct credits from a user
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

-- Step 8: Function to grant monthly credits for yearly subscriptions (for cron)
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
  -- Either never granted, or last grant was >28 days ago
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

-- Step 9: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.add_credits(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_monthly_credits_for_price_id(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_yearly_subscription(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_monthly_credits_for_yearly_subscriptions() TO service_role;

-- Step 10: Set up Supabase Cron Job
-- Note: If pg_cron extension is not enabled, enable it first:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron job to run daily at 2 AM UTC
-- This grants monthly credits for yearly subscriptions
SELECT cron.schedule(
  'grant-monthly-credits-yearly',
  '0 2 * * *', -- Daily at 2 AM UTC
  $$
  SELECT * FROM public.grant_monthly_credits_for_yearly_subscriptions();
  $$
);

-- To verify cron job was created:
-- SELECT * FROM cron.job WHERE jobname = 'grant-monthly-credits-yearly';

-- To manually test the cron function:
-- SELECT * FROM public.grant_monthly_credits_for_yearly_subscriptions();

-- To remove cron job (if needed):
-- SELECT cron.unschedule('grant-monthly-credits-yearly');
