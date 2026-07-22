-- Fanvue App Store billing (Presence Studio)

CREATE TABLE IF NOT EXISTS public.fanvue_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_provider TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS fanvue_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS fanvue_plan_uuid TEXT,
  ADD COLUMN IF NOT EXISTS fanvue_buyer_uuid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_fanvue_subscription_id
  ON public.subscriptions (fanvue_subscription_id)
  WHERE fanvue_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_fanvue_plan_uuid
  ON public.subscriptions (fanvue_plan_uuid)
  WHERE fanvue_plan_uuid IS NOT NULL;

ALTER TABLE public.credit_purchases
  ADD COLUMN IF NOT EXISTS billing_provider TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS fanvue_invoice_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_purchases_fanvue_invoice_id
  ON public.credit_purchases (fanvue_invoice_id)
  WHERE fanvue_invoice_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fulfill_fanvue_credit_purchase(
  p_invoice_id TEXT,
  p_user_id UUID,
  p_credits INTEGER,
  p_amount_cents INTEGER
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
  WHERE fanvue_invoice_id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.credit_purchases (
      user_id,
      credits,
      amount_cents,
      currency,
      status,
      billing_provider,
      fanvue_invoice_id,
      fulfilled_at
    )
    VALUES (
      p_user_id,
      p_credits,
      p_amount_cents,
      'usd',
      'fulfilled',
      'fanvue',
      p_invoice_id,
      timezone('utc'::text, now())
    )
    RETURNING * INTO purchase;
  ELSIF purchase.status = 'fulfilled' THEN
    RETURN QUERY
    SELECT
      purchase.id,
      purchase.user_id,
      purchase.credits,
      COALESCE((SELECT credits FROM public.profiles WHERE id = purchase.user_id), 0),
      TRUE;
    RETURN;
  ELSE
    UPDATE public.credit_purchases
    SET
      status = 'fulfilled',
      fulfilled_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
    WHERE id = purchase.id
    RETURNING * INTO purchase;
  END IF;

  balance := public.add_credits(purchase.user_id, purchase.credits);

  RETURN QUERY
  SELECT purchase.id, purchase.user_id, purchase.credits, balance, FALSE;
END;
$$;
