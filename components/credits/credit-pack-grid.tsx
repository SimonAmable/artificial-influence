'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { CREDIT_PACK_CENTS_PER_CREDIT } from '@/lib/credit-packs';
import { FANVUE_CREDIT_PACK_PRICES_USD } from '@/lib/fanvue/billing-config';
import {
  mapCreditsToFanvueItem,
  type FanvueCreditItemKey,
} from '@/lib/fanvue/app-store';
import { fetchFanvueBillingUrl } from '@/lib/fanvue/open-billing-client';
import { isPresenceProduct } from '@/lib/product/require-presence';
import { cn } from '@/lib/utils';
import { CreditPackCheckout } from '@/components/credits/credit-pack-checkout';

type CreditPackGridProps = {
  className?: string;
  redirectPath?: string;
};

const STRIPE_PACK_AMOUNTS = [10, 25, 50, 100] as const;

const PRESENCE_PACKS: Array<{ credits: FanvueCreditItemKey; price: number }> = [
  { credits: '200', price: FANVUE_CREDIT_PACK_PRICES_USD['200'] },
  { credits: '500', price: FANVUE_CREDIT_PACK_PRICES_USD['500'] },
  { credits: '1000', price: FANVUE_CREDIT_PACK_PRICES_USD['1000'] },
  { credits: '2000', price: FANVUE_CREDIT_PACK_PRICES_USD['2000'] },
];

function toStripeCredits(amountDollars: number) {
  return (amountDollars * 100) / CREDIT_PACK_CENTS_PER_CREDIT;
}

function formatPackPrice(price: number) {
  return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`;
}

export function CreditPackGrid({ className, redirectPath = '/pricing' }: CreditPackGridProps) {
  const isPresence = isPresenceProduct();
  const [activeCredits, setActiveCredits] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const stripePacks = STRIPE_PACK_AMOUNTS.map((amountDollars) => {
    const credits = toStripeCredits(amountDollars);
    return {
      amountDollars,
      credits,
      imageEstimate: credits / 2,
    };
  });

  const presencePacks = PRESENCE_PACKS.map((pack) => ({
    credits: Number(pack.credits),
    price: pack.price,
    imageEstimate: Number(pack.credits) / 2,
    itemKey: pack.credits,
  }));

  const startCheckout = async (credits: number) => {
    setError(null);
    setActiveCredits(credits);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
        return;
      }

      if (isPresence) {
        const itemKey = mapCreditsToFanvueItem(credits);
        const checkoutUrl = itemKey
          ? await fetchFanvueBillingUrl({ kind: 'item', item: itemKey })
          : await fetchFanvueBillingUrl({ kind: 'listing' });
        window.location.href = checkoutUrl;
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
      setActiveCredits(null);
    }
  };

  return (
    <section className={cn('mx-auto w-full max-w-7xl', className)}>
      <div
        className={cn(
          'grid grid-cols-1 gap-4 sm:grid-cols-2',
          isPresence ? 'xl:grid-cols-4' : 'xl:grid-cols-5'
        )}
      >
        {isPresence
          ? presencePacks.map((pack) => (
              <article
                key={pack.credits}
                className={cn(
                  'flex min-h-[250px] flex-col justify-between rounded-[22px] border border-border/70 bg-card/90 p-5 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-lg'
                )}
              >
                <div>
                  <p className="text-4xl font-semibold tracking-tight">
                    {formatPackPrice(pack.price)}
                  </p>
                  <p className="mt-7 text-lg font-medium text-foreground">
                    {pack.credits.toLocaleString()} credits
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    ~ {pack.imageEstimate.toLocaleString()} Nano Banana images
                  </p>
                </div>

                <div className="mt-8">
                  <Button
                    type="button"
                    className="h-12 w-full rounded-2xl bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    onClick={() => void startCheckout(pack.credits)}
                    disabled={activeCredits != null}
                  >
                    {activeCredits === pack.credits
                      ? 'Opening checkout...'
                      : `Buy ${pack.credits.toLocaleString()} credits`}
                  </Button>
                </div>
              </article>
            ))
          : stripePacks.map((pack) => (
              <article
                key={pack.amountDollars}
                className={cn(
                  'flex min-h-[250px] flex-col justify-between rounded-[22px] border border-border/70 bg-card/90 p-5 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-lg'
                )}
              >
                <div>
                  <p className="text-4xl font-semibold tracking-tight">${pack.amountDollars}</p>
                  <p className="mt-7 text-lg font-medium text-foreground">
                    {pack.credits.toLocaleString()} credits
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    ~ {pack.imageEstimate.toLocaleString()} Nano Banana images
                  </p>
                </div>

                <div className="mt-8">
                  <Button
                    type="button"
                    className="h-12 w-full rounded-2xl bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    onClick={() => void startCheckout(pack.credits)}
                    disabled={activeCredits != null}
                  >
                    {activeCredits === pack.credits
                      ? 'Opening checkout...'
                      : `Buy ${pack.credits.toLocaleString()} credits`}
                  </Button>
                </div>
              </article>
            ))}

        {!isPresence ? (
          <article
            className={cn(
              'flex min-h-[250px] flex-col justify-between rounded-[22px] border border-border/70 bg-card/90 p-5 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-lg'
            )}
          >
            <div>
              <p className="text-4xl font-semibold tracking-tight">Custom</p>
              <p className="mt-7 text-lg font-medium text-foreground">Any amount</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose the exact credit total you want before checkout.
              </p>
            </div>

            <div className="mt-8">
              <Button
                type="button"
                className="h-12 w-full rounded-2xl bg-secondary text-secondary-foreground hover:bg-secondary/80"
                onClick={() => setCustomOpen(true)}
                disabled={activeCredits != null}
              >
                Choose amount
              </Button>
            </div>
          </article>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      {!isPresence ? (
        <Dialog open={customOpen} onOpenChange={setCustomOpen}>
          <DialogContent className="!max-w-none max-h-[90vh] w-[min(100vw-1.5rem,72rem)] overflow-y-auto rounded-[28px] border-border/70 bg-background/95 p-4 shadow-2xl sm:p-6">
            <DialogHeader className="px-1 pt-1">
              <DialogTitle className="text-2xl font-semibold tracking-tight">
                Custom credit pack
              </DialogTitle>
              <DialogDescription>
                Use the slider to choose the amount that fits your run.
              </DialogDescription>
            </DialogHeader>

            <CreditPackCheckout redirectPath={redirectPath} />
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
