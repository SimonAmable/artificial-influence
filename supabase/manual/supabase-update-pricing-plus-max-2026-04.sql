-- ============================================
-- Pricing Update: Starter 400 credits, Plus tier, new Max prices
-- ============================================
-- Run this in the Supabase SQL Editor for the live production database.

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
    "price_1SrXZDK2MiVk67Bi0Y57icpS": 6000,
    "price_1SrWkoGYRyfMJZ0CCuVwjLKc": 100,
    "price_1SrWl8GYRyfMJZ0CeXU9f7LE": 400,
    "price_1SrWlMGYRyfMJZ0CTNcrZ1gS": 6000,
    "price_1TIyQeGYRyfMJZ0Cg7gwAPJE": 6000,
    "price_1TIySoGYRyfMJZ0CKCD93aWh": 6000,
    "price_1SrWlzGYRyfMJZ0CICD6aj5j": 100,
    "price_1SrWmVGYRyfMJZ0CyKUeZ5T9": 400,
    "price_1SrWmtGYRyfMJZ0CzG1ac2Ra": 6000,
    "price_1TQK3qGYRyfMJZ0CFGGqUXJ8": 400,
    "price_1TQK4BGYRyfMJZ0CdR1RMtUm": 400,
    "price_1TQIqwGYRyfMJZ0CivzObR67": 1000,
    "price_1TQIrfGYRyfMJZ0C7s5GmQSw": 1000,
    "price_1TQIsxGYRyfMJZ0CzYtrgkNP": 6000,
    "price_1TQIvNGYRyfMJZ0CBCQJiJ6T": 6000,
    "price_1TQKZwGYRyfMJZ0CcVI6e5wM": 6000
  }'::JSONB;
BEGIN
  RETURN COALESCE((credits_map->>price_id)::INTEGER, 0);
END;
$$;

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
    'price_1SrWmtGYRyfMJZ0CzG1ac2Ra',
    'price_1TIySoGYRyfMJZ0CKCD93aWh',
    'price_1TQK4BGYRyfMJZ0CdR1RMtUm',
    'price_1TQIrfGYRyfMJZ0C7s5GmQSw',
    'price_1TQIvNGYRyfMJZ0CBCQJiJ6T',
    'price_1TQKZwGYRyfMJZ0CcVI6e5wM'
  ];
BEGIN
  RETURN price_id = ANY(yearly_price_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_credits_for_price_id(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_yearly_subscription(TEXT) TO authenticated, service_role;

-- Verification:
SELECT public.get_monthly_credits_for_price_id('price_1SrWl8GYRyfMJZ0CeXU9f7LE'::TEXT) AS pro_monthly_credits;
SELECT public.get_monthly_credits_for_price_id('price_1SrWmVGYRyfMJZ0CyKUeZ5T9'::TEXT) AS pro_yearly_monthly_credits;
SELECT public.get_monthly_credits_for_price_id('price_1TQK3qGYRyfMJZ0CFGGqUXJ8'::TEXT) AS starter_monthly_credits;
SELECT public.get_monthly_credits_for_price_id('price_1TQK4BGYRyfMJZ0CdR1RMtUm'::TEXT) AS starter_yearly_monthly_credits;
SELECT public.get_monthly_credits_for_price_id('price_1TQIqwGYRyfMJZ0CivzObR67'::TEXT) AS plus_monthly_credits;
SELECT public.get_monthly_credits_for_price_id('price_1TQIrfGYRyfMJZ0C7s5GmQSw'::TEXT) AS plus_yearly_monthly_credits;
SELECT public.get_monthly_credits_for_price_id('price_1TQIsxGYRyfMJZ0CzYtrgkNP'::TEXT) AS max_monthly_credits;
SELECT public.get_monthly_credits_for_price_id('price_1TQIvNGYRyfMJZ0CBCQJiJ6T'::TEXT) AS max_yearly_monthly_credits;
SELECT public.get_monthly_credits_for_price_id('price_1TQKZwGYRyfMJZ0CcVI6e5wM'::TEXT) AS newest_max_yearly_monthly_credits;
SELECT public.is_yearly_subscription('price_1TQK4BGYRyfMJZ0CdR1RMtUm'::TEXT) AS starter_yearly;
SELECT public.is_yearly_subscription('price_1TQIrfGYRyfMJZ0C7s5GmQSw'::TEXT) AS plus_yearly;
SELECT public.is_yearly_subscription('price_1TQIvNGYRyfMJZ0CBCQJiJ6T'::TEXT) AS max_yearly;
SELECT public.is_yearly_subscription('price_1TQKZwGYRyfMJZ0CcVI6e5wM'::TEXT) AS newest_max_yearly;
