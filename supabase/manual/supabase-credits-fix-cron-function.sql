-- Fix: Recreate the grant_monthly_credits_for_yearly_subscriptions function
-- Run this if you get "function does not exist" error

-- First, check if the function exists
SELECT 
  proname as function_name,
  pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'grant_monthly_credits_for_yearly_subscriptions';

-- Drop the function if it exists (to recreate it)
DROP FUNCTION IF EXISTS public.grant_monthly_credits_for_yearly_subscriptions();

-- Recreate the function
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.grant_monthly_credits_for_yearly_subscriptions() TO service_role;

-- Verify the function was created
SELECT 
  proname as function_name,
  pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'grant_monthly_credits_for_yearly_subscriptions';

-- Test the function (optional - comment out if you don't want to run it)
-- SELECT * FROM public.grant_monthly_credits_for_yearly_subscriptions();
