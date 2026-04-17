-- Affiliate program: custom codes, referrals, recurring commissions (tracked in app; payouts manual).

CREATE TABLE IF NOT EXISTS public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  agreed_to_terms_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliates_user_id_unique UNIQUE (user_id),
  CONSTRAINT affiliates_code_unique UNIQUE (code),
  CONSTRAINT affiliates_code_format CHECK (
    code ~ '^[a-z0-9]{4,20}$'
  )
);

CREATE INDEX IF NOT EXISTS idx_affiliates_code ON public.affiliates (code);

CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_converted_at timestamptz NOT NULL DEFAULT now(),
  commission_eligible_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_referrals_referred_user_unique UNIQUE (referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate_id ON public.affiliate_referrals (affiliate_id);

CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referral_id uuid NOT NULL REFERENCES public.affiliate_referrals(id) ON DELETE CASCADE,
  stripe_invoice_id text NOT NULL,
  invoice_amount_cents integer NOT NULL,
  commission_rate numeric(6, 5) NOT NULL DEFAULT 0.2,
  commission_amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'voided')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_commissions_stripe_invoice_unique UNIQUE (stripe_invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON public.affiliate_commissions (affiliate_id);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own affiliate row" ON public.affiliates;
CREATE POLICY "Users can view own affiliate row"
  ON public.affiliates
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own affiliate row" ON public.affiliates;
CREATE POLICY "Users can insert own affiliate row"
  ON public.affiliates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Affiliates can view own referrals" ON public.affiliate_referrals;
CREATE POLICY "Affiliates can view own referrals"
  ON public.affiliate_referrals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = affiliate_referrals.affiliate_id AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Affiliates can view own commissions" ON public.affiliate_commissions;
CREATE POLICY "Affiliates can view own commissions"
  ON public.affiliate_commissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = affiliate_commissions.affiliate_id AND a.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.affiliates IS 'Affiliate program members; code is lowercase alphanumeric 4-20.';
COMMENT ON TABLE public.affiliate_referrals IS 'First paid conversion attribution per referred user.';
COMMENT ON TABLE public.affiliate_commissions IS 'Per-invoice commission accruals; stripe_invoice_id is idempotency key.';
