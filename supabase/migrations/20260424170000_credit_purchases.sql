CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 500),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency = lower(currency)),
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'checkout_created', 'fulfilled', 'failed', 'expired')
  ),
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_user_id
  ON public.credit_purchases(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_status
  ON public.credit_purchases(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_purchases_checkout_session_id
  ON public.credit_purchases(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_purchases_payment_intent_id
  ON public.credit_purchases(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credit purchases"
  ON public.credit_purchases;
CREATE POLICY "Users can view own credit purchases"
  ON public.credit_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage credit purchases"
  ON public.credit_purchases;
CREATE POLICY "Service role can manage credit purchases"
  ON public.credit_purchases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS on_credit_purchases_updated ON public.credit_purchases;
CREATE TRIGGER on_credit_purchases_updated
  BEFORE UPDATE ON public.credit_purchases
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.fulfill_credit_purchase(
  p_checkout_session_id TEXT,
  p_payment_intent_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  purchase_id UUID,
  purchase_user_id UUID,
  purchase_credits INTEGER,
  new_balance INTEGER,
  already_fulfilled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purchase public.credit_purchases%ROWTYPE;
  balance INTEGER;
BEGIN
  SELECT *
  INTO purchase
  FROM public.credit_purchases
  WHERE stripe_checkout_session_id = p_checkout_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit purchase not found for Checkout Session: %', p_checkout_session_id;
  END IF;

  IF purchase.fulfilled_at IS NOT NULL THEN
    SELECT COALESCE(credits, 0)
    INTO balance
    FROM public.profiles
    WHERE id = purchase.user_id;

    purchase_id := purchase.id;
    purchase_user_id := purchase.user_id;
    purchase_credits := purchase.credits;
    new_balance := COALESCE(balance, 0);
    already_fulfilled := true;
    RETURN NEXT;
    RETURN;
  END IF;

  balance := public.add_credits(purchase.user_id, purchase.credits);

  UPDATE public.credit_purchases
  SET
    status = 'fulfilled',
    fulfilled_at = NOW(),
    stripe_payment_intent_id = COALESCE(p_payment_intent_id, stripe_payment_intent_id),
    updated_at = NOW()
  WHERE id = purchase.id;

  purchase_id := purchase.id;
  purchase_user_id := purchase.user_id;
  purchase_credits := purchase.credits;
  new_balance := balance;
  already_fulfilled := false;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fulfill_credit_purchase(TEXT, TEXT) TO service_role;
