import Link from 'next/link';
import { redirect } from 'next/navigation';
import { stripe } from '@/lib/stripe/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { formatCreditPackAmount } from '@/lib/credit-packs';

type CreditPurchaseRow = {
  id: string;
  user_id: string;
  credits: number;
  amount_cents: number;
  currency: string;
  status: string;
  fulfilled_at: string | null;
};

function StatusPanel({
  title,
  description,
  tone = 'default',
}: {
  title: string;
  description: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'success'
      ? 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100'
      : tone === 'warning'
      ? 'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-100'
      : 'border-border bg-card text-card-foreground';

  return (
    <div className={`rounded-lg border p-4 text-sm ${toneClass}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 opacity-80">{description}</p>
    </div>
  );
}

export default async function CreditSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const sessionId = params.session_id;

  if (!sessionId) {
    redirect('/pricing');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/credits/success?session_id=${encodeURIComponent(sessionId)}`);
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-lg border border-border bg-card p-8 text-center shadow-lg">
          <h1 className="text-2xl font-bold mb-2">Credit checkout unavailable</h1>
          <p className="text-muted-foreground">
            We could not verify your credit purchase because billing is not configured.
          </p>
        </div>
      </div>
    );
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    console.error('Error retrieving credit Checkout Session:', error);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-lg border border-border bg-card p-8 text-center shadow-lg">
          <h1 className="text-2xl font-bold mb-2">Invalid checkout session</h1>
          <p className="text-muted-foreground mb-6">
            We could not find this credit purchase. Please contact support if you were charged.
          </p>
          <Link
            href="/pricing"
            className="inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to pricing
          </Link>
        </div>
      </div>
    );
  }

  if (session.mode !== 'payment' || session.metadata?.type !== 'credit_pack') {
    redirect('/pricing');
  }

  const { data: initialPurchase } = await admin
    .from('credit_purchases')
    .select('id, user_id, credits, amount_cents, currency, status, fulfilled_at')
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle<CreditPurchaseRow>();

  if (!initialPurchase || initialPurchase.user_id !== user.id) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-lg border border-border bg-card p-8 text-center shadow-lg">
          <h1 className="text-2xl font-bold mb-2">Purchase not found</h1>
          <p className="text-muted-foreground mb-6">
            This checkout session is not linked to your account.
          </p>
          <Link
            href="/pricing"
            className="inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to pricing
          </Link>
        </div>
      </div>
    );
  }

  let purchase = initialPurchase;
  let fulfillmentError = false;

  if (session.payment_status === 'paid' && !purchase.fulfilled_at) {
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    const { error } = await admin.rpc('fulfill_credit_purchase', {
      p_checkout_session_id: session.id,
      p_payment_intent_id: paymentIntentId,
    });

    if (error) {
      console.error('Fallback credit purchase fulfillment failed:', error);
      fulfillmentError = true;
    } else {
      const { data: refreshedPurchase } = await admin
        .from('credit_purchases')
        .select('id, user_id, credits, amount_cents, currency, status, fulfilled_at')
        .eq('id', purchase.id)
        .single<CreditPurchaseRow>();

      if (refreshedPurchase) {
        purchase = refreshedPurchase;
      }
    }
  }

  const fulfilled = Boolean(purchase.fulfilled_at);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full rounded-lg border border-border bg-card p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <span className="text-3xl font-bold">+</span>
        </div>

        <h1 className="text-2xl font-bold mb-2">
          {fulfilled ? 'Credits added' : 'Credit purchase received'}
        </h1>
        <p className="text-muted-foreground mb-6">
          {purchase.credits.toLocaleString()} credits for{' '}
          {formatCreditPackAmount(purchase.amount_cents)}
        </p>

        {fulfilled ? (
          <StatusPanel
            tone="success"
            title="Ready to create"
            description="Your credits are available on your account."
          />
        ) : session.payment_status === 'paid' && fulfillmentError ? (
          <StatusPanel
            tone="warning"
            title="Payment confirmed"
            description="Stripe confirmed the payment, but credit fulfillment is still pending. This is safe to retry."
          />
        ) : (
          <StatusPanel
            title="Payment processing"
            description="Your payment is still processing. Credits will appear after Stripe confirms the payment."
          />
        )}

        <div className="mt-6 space-y-3">
          <Link
            href="/dashboard"
            className="block w-full rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to dashboard
          </Link>
          <Link
            href="/pricing"
            className="block w-full rounded-lg bg-secondary px-6 py-3 font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            Buy more credits
          </Link>
        </div>
      </div>
    </div>
  );
}
