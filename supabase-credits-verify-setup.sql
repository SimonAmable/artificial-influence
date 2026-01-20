-- Verification Script: Check if all credit system components exist
-- Run this to diagnose issues

-- 1. Check if credits column exists
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles' 
  AND column_name = 'credits';

-- 2. Check if last_credit_grant_date column exists
SELECT 
  column_name, 
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'subscriptions' 
  AND column_name = 'last_credit_grant_date';

-- 3. Check if all required functions exist
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

-- 4. Check if cron job exists
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job 
WHERE jobname = 'grant-monthly-credits-yearly';

-- 5. Test helper functions (if they exist)
-- Uncomment to test:
-- SELECT public.get_monthly_credits_for_price_id('price_1SrWmtGYRyfMJZ0CzG1ac2Ra');
-- SELECT public.is_yearly_subscription('price_1SrWmtGYRyfMJZ0CzG1ac2Ra');
