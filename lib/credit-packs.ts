export const CREDIT_PACK_CURRENCY = 'usd';
export const CREDIT_PACK_CURRENCY_LABEL = 'USD';
export const CREDIT_PACK_CENTS_PER_CREDIT = 5;
export const MIN_CREDIT_PURCHASE_CENTS = 500;
export const CREDIT_PACK_STEP = 50;
export const MAX_CREDIT_PACK_CREDITS = 10000;
export const MIN_CREDIT_PACK_CREDITS =
  Math.ceil(MIN_CREDIT_PURCHASE_CENTS / CREDIT_PACK_CENTS_PER_CREDIT / CREDIT_PACK_STEP) *
  CREDIT_PACK_STEP;

export const CREDIT_PACK_PRESETS = [100, 500, 1000, 3000] as const;

export type CreditPackValidationResult =
  | {
      ok: true;
      credits: number;
      amountCents: number;
    }
  | {
      ok: false;
      error: string;
    };

export function calculateCreditPackAmountCents(credits: number): number {
  return credits * CREDIT_PACK_CENTS_PER_CREDIT;
}

export function formatCreditPackAmount(amountCents: number): string {
  return `$${(amountCents / 100).toFixed(2)}`;
}

export function validateCreditPackCredits(value: unknown): CreditPackValidationResult {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { ok: false, error: 'Credits must be a whole number.' };
  }

  if (value < MIN_CREDIT_PACK_CREDITS) {
    return {
      ok: false,
      error: `Credit packs start at ${MIN_CREDIT_PACK_CREDITS} credits.`,
    };
  }

  if (value > MAX_CREDIT_PACK_CREDITS) {
    return {
      ok: false,
      error: `Credit packs are limited to ${MAX_CREDIT_PACK_CREDITS} credits per checkout.`,
    };
  }

  if (value % CREDIT_PACK_STEP !== 0) {
    return {
      ok: false,
      error: `Credits must be purchased in ${CREDIT_PACK_STEP}-credit increments.`,
    };
  }

  const amountCents = calculateCreditPackAmountCents(value);
  if (amountCents < MIN_CREDIT_PURCHASE_CENTS) {
    return {
      ok: false,
      error: `Credit pack purchases must be at least ${formatCreditPackAmount(
        MIN_CREDIT_PURCHASE_CENTS
      )}.`,
    };
  }

  return {
    ok: true,
    credits: value,
    amountCents,
  };
}
