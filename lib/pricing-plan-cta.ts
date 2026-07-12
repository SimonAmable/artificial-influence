export type PaidPlanName = 'Starter' | 'Plus';

export type PlanCtaKind = 'signup' | 'checkout' | 'current' | 'portal' | 'inactive';

export type PlanCtaState = {
  kind: PlanCtaKind;
  label: string;
};

const PLAN_TIER: Record<string, number> = {
  Free: 0,
  Starter: 1,
  Plus: 2,
};

export const PRICING_PLAN_BY_PRICE_ID: Record<
  string,
  { name: PaidPlanName; interval: 'month' | 'year' }
> = {
  price_1TQK3qGYRyfMJZ0CFGGqUXJ8: { name: 'Starter', interval: 'month' },
  price_1TQIqwGYRyfMJZ0CivzObR67: { name: 'Plus', interval: 'month' },
  price_1TQK4BGYRyfMJZ0CdR1RMtUm: { name: 'Starter', interval: 'year' },
  price_1TQIrfGYRyfMJZ0C7s5GmQSw: { name: 'Plus', interval: 'year' },
};

export function resolvePaidPlanFromPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;
  return PRICING_PLAN_BY_PRICE_ID[priceId] ?? null;
}

export function getPlanCtaState({
  planName,
  planInterval,
  planPriceId,
  activePriceId,
  isLoggedIn,
}: {
  planName: string;
  planInterval: 'month' | 'year';
  planPriceId?: string;
  activePriceId: string | null;
  isLoggedIn: boolean;
}): PlanCtaState {
  if (planName === 'Free') {
    if (!isLoggedIn) {
      return { kind: 'signup', label: 'Start free' };
    }
    if (!activePriceId) {
      return { kind: 'current', label: 'Current plan' };
    }
    return { kind: 'inactive', label: 'Paid plan active' };
  }

  if (!isLoggedIn) {
    return { kind: 'checkout', label: `Get ${planName}` };
  }

  if (!activePriceId) {
    return { kind: 'checkout', label: `Get ${planName}` };
  }

  if (planPriceId && planPriceId === activePriceId) {
    return { kind: 'current', label: 'Current plan' };
  }

  const currentPlan = resolvePaidPlanFromPriceId(activePriceId);
  if (!currentPlan) {
    return { kind: 'checkout', label: `Get ${planName}` };
  }

  const targetTier = PLAN_TIER[planName] ?? 0;
  const currentTier = PLAN_TIER[currentPlan.name] ?? 0;

  if (targetTier > currentTier) {
    return { kind: 'portal', label: `Upgrade to ${planName}` };
  }

  if (targetTier < currentTier) {
    return { kind: 'portal', label: 'Manage billing' };
  }

  if (planName === currentPlan.name && planInterval !== currentPlan.interval) {
    return {
      kind: 'portal',
      label: planInterval === 'year' ? 'Switch to yearly' : 'Switch to monthly',
    };
  }

  return { kind: 'checkout', label: `Get ${planName}` };
}
