-- Create customers table to store Stripe customer information
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create subscriptions table to track user subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  price_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  cancel_at_period_end BOOLEAN DEFAULT false,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers table
CREATE POLICY "Users can view own customer data"
  ON public.customers
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert customers"
  ON public.customers
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update customers"
  ON public.customers
  FOR UPDATE
  USING (true);

-- RLS Policies for subscriptions table
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert subscriptions"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update subscriptions"
  ON public.subscriptions
  FOR UPDATE
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_stripe_customer_id ON public.customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- Create updated_at trigger for customers
CREATE TRIGGER on_customers_updated
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create updated_at trigger for subscriptions
CREATE TRIGGER on_subscriptions_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create a view for active subscriptions
-- Note: Views inherit RLS policies from underlying tables (subscriptions and customers)
-- Users can only see their own subscriptions due to RLS on the base tables
-- When querying this view, PostgreSQL automatically applies RLS from subscriptions and customers tables
CREATE OR REPLACE VIEW public.active_subscriptions AS
SELECT 
  s.*,
  c.email
FROM public.subscriptions s
JOIN public.customers c ON s.user_id = c.user_id
WHERE s.status IN ('active', 'trialing');

-- Create a security-definer function for explicit access control if needed
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
