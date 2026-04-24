'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { createClient } from '@/lib/supabase/client';
import {
  calculateCreditPackAmountCents,
  CREDIT_PACK_CENTS_PER_CREDIT,
  CREDIT_PACK_CURRENCY_LABEL,
  CREDIT_PACK_PRESETS,
  CREDIT_PACK_STEP,
  formatCreditPackAmount,
  MAX_CREDIT_PACK_CREDITS,
  MIN_CREDIT_PACK_CREDITS,
} from '@/lib/credit-packs';
import { cn } from '@/lib/utils';

type CreditPackCheckoutProps = {
  className?: string;
  redirectPath?: string;
};

export function CreditPackCheckout({
  className,
  redirectPath = '/pricing',
}: CreditPackCheckoutProps) {
  const [credits, setCredits] = useState<number>(500);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const amountCents = calculateCreditPackAmountCents(credits);
  const effectivePrice = (CREDIT_PACK_CENTS_PER_CREDIT / 100).toFixed(2);

  useEffect(() => {
    let mounted = true;

    async function loadBalance() {
      setLoadingBalance(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        setCurrentBalance(null);
        setLoadingBalance(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single();

      if (!mounted) return;

      if (profileError) {
        console.error('Failed to load credit balance:', profileError);
        setCurrentBalance(null);
      } else {
        setCurrentBalance(Number(data?.credits ?? 0));
      }
      setLoadingBalance(false);
    }

    void loadBalance();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const handleCheckout = async () => {
    setError(null);
    setCheckoutLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
        return;
      }

      const response = await fetch('/api/checkout/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credits }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create credit checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (checkoutError) {
      console.error('Credit checkout failed:', checkoutError);
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Failed to start credit checkout.'
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <section className={cn('mx-auto max-w-4xl rounded-lg border border-border bg-card p-6 shadow-lg sm:p-8', className)}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <div className="mb-3 flex items-center gap-2">
            <Sparkle className="size-5 text-primary" weight="fill" />
            <h2 className="text-2xl font-bold">Buy credits</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Add one-time credits whenever you need extra generations. Credit packs start at
            {' '}
            {formatCreditPackAmount(calculateCreditPackAmountCents(MIN_CREDIT_PACK_CREDITS))}
            {' '}
            and do not change your subscription.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-background/60 px-4 py-3 text-sm">
          <p className="text-muted-foreground">Current balance</p>
          <p className="text-2xl font-semibold">
            {loadingBalance
              ? '...'
              : currentBalance == null
              ? 'Sign in'
              : currentBalance.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_260px]">
        <div>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Credits</p>
              <p className="text-4xl font-bold tracking-tight">{credits.toLocaleString()}</p>
            </div>
            <p className="text-right text-sm text-muted-foreground">
              {formatCreditPackAmount(amountCents)} {CREDIT_PACK_CURRENCY_LABEL}
              <br />
              ${effectivePrice} per credit
            </p>
          </div>

          <Slider
            value={[credits]}
            min={MIN_CREDIT_PACK_CREDITS}
            max={MAX_CREDIT_PACK_CREDITS}
            step={CREDIT_PACK_STEP}
            onValueChange={(value) => {
              setCredits(value[0] ?? MIN_CREDIT_PACK_CREDITS);
              setError(null);
            }}
            aria-label="Credit amount"
          />

          <div className="mt-3 flex justify-between text-xs text-muted-foreground">
            <span>{MIN_CREDIT_PACK_CREDITS.toLocaleString()}</span>
            <span>{MAX_CREDIT_PACK_CREDITS.toLocaleString()}</span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {CREDIT_PACK_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant={preset === credits ? 'default' : 'outline'}
                size="sm"
                className="rounded-full"
                onClick={() => {
                  setCredits(preset);
                  setError(null);
                }}
              >
                {preset.toLocaleString()}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background/60 p-4">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-3xl font-bold">{formatCreditPackAmount(amountCents)}</p>
          </div>
          <Button
            type="button"
            className="w-full"
            onClick={handleCheckout}
            disabled={checkoutLoading}
          >
            {checkoutLoading ? 'Opening checkout...' : 'Buy credits'}
          </Button>
          {error ? (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Secure checkout is handled by Stripe.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
