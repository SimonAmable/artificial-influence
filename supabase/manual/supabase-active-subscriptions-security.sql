-- Add explicit security function for active_subscriptions view
-- This provides an additional security layer with explicit auth.uid() checks

-- Create a security-definer function for explicit access control
-- This function ensures users can only query their own active subscriptions
CREATE OR REPLACE FUNCTION public.get_active_subscriptions()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT,
  price_id TEXT,
  quantity INTEGER,
  cancel_at_period_end BOOLEAN,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.stripe_subscription_id,
    s.stripe_customer_id,
    s.status,
    s.price_id,
    s.quantity,
    s.cancel_at_period_end,
    s.current_period_start,
    s.current_period_end,
    s.created_at,
    s.updated_at,
    c.email
  FROM public.subscriptions s
  JOIN public.customers c ON s.user_id = c.user_id
  WHERE s.status IN ('active', 'trialing')
    AND s.user_id = auth.uid(); -- Explicit security check
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_active_subscriptions() TO authenticated;
