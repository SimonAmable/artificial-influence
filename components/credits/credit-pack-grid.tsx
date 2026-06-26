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
import { cn } from '@/lib/utils';
import { CreditPackCheckout } from '@/components/credits/credit-pack-checkout';

type CreditPackGridProps = {
  className?: string;
  redirectPath?: string;
};

const PACK_AMOUNTS = [10, 25, 50, 100] as const;

function toCredits(amountDollars: number) {
  return (amountDollars * 100) / CREDIT_PACK_CENTS_PER_CREDIT;
}

export function CreditPackGrid({ className, redirectPath = '/pricing' }: CreditPackGridProps) {
  const [activeCredits, setActiveCredits] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const fixedPacks = PACK_AMOUNTS.map((amountDollars) => {
    const credits = toCredits(amountDollars);
    return {
      amountDollars,
      credits,
      imageEstimate: credits / 2,
    };
  });

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {fixedPacks.map((pack) => (
          <article
            key={pack.amountDollars}
            className={cn(
              'flex min-h-[250px] flex-col justify-between rounded-[22px] border border-border/70 bg-card/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-lg'
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

        <article
          className={cn(
            'flex min-h-[250px] flex-col justify-between rounded-[22px] border border-border/70 bg-card/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-lg'
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
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

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

          <CreditPackCheckout
            redirectPath={redirectPath}
            className="!mx-0 !w-full !max-w-none !border-0 !bg-transparent !p-0 !shadow-none"
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}
