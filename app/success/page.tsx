import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { stripe } from '@/lib/stripe/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

function toIsoOrNull(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }

  if (typeof value === 'string') {
    // Stripe sometimes returns unix seconds as strings, otherwise keep ISO strings.
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber) && Number.isFinite(asNumber)) {
      return new Date(asNumber * 1000).toISOString();
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

function getSubscriptionPeriodIso(
  subscription: Stripe.Subscription,
  field: 'current_period_start' | 'current_period_end'
): string | null {
  const subscriptionWithOptionalPeriods = subscription as Stripe.Subscription & {
    current_period_start?: unknown;
    current_period_end?: unknown;
    items: {
      data: Array<
        Stripe.SubscriptionItem & {
          current_period_start?: unknown;
          current_period_end?: unknown;
        }
      >;
    };
  };

  // Newer Stripe API versions may expose period bounds on the item, not subscription root.
  const subscriptionValue = subscriptionWithOptionalPeriods[field];
  const itemValue = subscriptionWithOptionalPeriods.items.data[0]?.[field];
  return toIsoOrNull(subscriptionValue) ?? toIsoOrNull(itemValue);
}

async function syncSubscriptionFromCheckoutSession(
  session: Stripe.Checkout.Session
) {
  const userId = session.metadata?.userId;
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;

  if (!userId || !subscriptionId || !customerId) {
    return;
  }

  // Verify the authenticated user matches checkout metadata before sync.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    return;
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const currentPeriodStart = getSubscriptionPeriodIso(
    subscription,
    'current_period_start'
  );
  const currentPeriodEnd = getSubscriptionPeriodIso(
    subscription,
    'current_period_end'
  );
  const allowIncompleteForInitialGrant = true;

  await supabaseAdmin.from('customers').upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      email: session.customer_email || user.email || '',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  await supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      status: subscription.status,
      price_id: priceId,
      quantity: subscription.items.data[0]?.quantity || 1,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' }
  );

  // Fallback credit grant when webhook delivery is delayed/missing in local/dev.
  const { data: storedSubscription, error: storedSubError } = await supabaseAdmin
    .from('subscriptions')
    .select('status, current_period_start, last_credit_grant_date')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (storedSubError || !storedSubscription) {
    return;
  }

  const statusOk =
    storedSubscription.status === 'active' ||
    storedSubscription.status === 'trialing' ||
    (allowIncompleteForInitialGrant && storedSubscription.status === 'incomplete');

  if (!statusOk) {
    return;
  }

  if (storedSubscription.last_credit_grant_date && storedSubscription.current_period_start) {
    const lastGrantDate = new Date(storedSubscription.last_credit_grant_date);
    const periodStart = new Date(storedSubscription.current_period_start);
    if (lastGrantDate >= periodStart) {
      return;
    }
  }

  const { data: monthlyCredits, error: creditsError } = await supabaseAdmin.rpc(
    'get_monthly_credits_for_price_id',
    { price_id: priceId }
  );

  if (creditsError || !monthlyCredits || monthlyCredits === 0) {
    return;
  }

  const { error: addCreditsError } = await supabaseAdmin.rpc('add_credits', {
    user_id: userId,
    credits_to_add: monthlyCredits,
  });

  if (addCreditsError) {
    return;
  }

  await supabaseAdmin
    .from('subscriptions')
    .update({ last_credit_grant_date: new Date().toISOString() })
    .eq('stripe_subscription_id', subscription.id);
}

async function SuccessContent({
  sessionId,
}: {
  sessionId: string;
}) {
  let session;
  let error: Error | null = null;

  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error('Error retrieving session:', err);
    error = err instanceof Error ? err : new Error('Unknown error');
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Invalid Session</h1>
          <p className="text-muted-foreground mb-6">
            We couldn&apos;t find your checkout session. Please contact support if you believe
            this is an error.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  try {
    await syncSubscriptionFromCheckoutSession(session);
  } catch (syncError) {
    // Do not block success page rendering if sync fallback fails.
    console.error('Fallback subscription sync failed:', syncError);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center shadow-lg">
        {/* Success Icon */}
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-10 h-10 text-green-600 dark:text-green-400"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M5 13l4 4L19 7"></path>
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-2">Subscription Successful!</h1>
        <p className="text-muted-foreground mb-6">
          Thank you for subscribing. A confirmation email has been sent to{' '}
          <strong>{session.customer_email}</strong>.
        </p>

        {session.status === 'complete' && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800 dark:text-green-200">
              Your subscription is now active and you have full access to all features.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <a
            href="/dashboard/subscription"
            className="block w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            View Subscription
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="block w-full bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-secondary/80 transition-colors"
          >
            Go to Dashboard
          </a>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          If you have any questions, please contact our support team.
        </p>
      </div>
    </div>
  );
}

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const sessionId = params.session_id;

  if (!sessionId) {
    redirect('/pricing');
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <svg
              className="animate-spin h-12 w-12 mx-auto mb-4 text-primary"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <SuccessContent sessionId={sessionId} />
    </Suspense>
  );
}
