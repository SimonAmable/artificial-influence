import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for webhook operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Disable body parsing for webhook signature verification
export const runtime = 'nodejs';

async function buffer(readable: ReadableStream) {
  const chunks = [];
  const reader = readable.getReader();
  let done, value;
  
  while (!done) {
    ({ done, value } = await reader.read());
    if (value) {
      chunks.push(value);
    }
  }
  
  return Buffer.concat(chunks);
}

export async function POST(request: NextRequest) {
  const body = await buffer(request.body!);
  const signature = (await headers()).get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature found' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  console.log('Received webhook event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(subscription);
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Trial will end for subscription:', subscription.id);
        // Add logic to notify user about trial ending
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const userId = session.metadata?.userId;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId || !subscriptionId) {
    console.error('Missing userId or subscriptionId in session metadata');
    return;
  }

  // Retrieve the subscription from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Upsert customer record
  await supabaseAdmin.from('customers').upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      email: session.customer_email || '',
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id',
    }
  );

  // Insert or update subscription record
  await upsertSubscription(subscription, userId);

  // Grant initial month's credits (for both monthly and yearly subscriptions)
  const priceId = subscription.items.data[0]?.price.id;
  if (priceId) {
    await grantMonthlyCredits(userId, subscriptionId, priceId);
  }

  console.log('Checkout session completed for user:', userId);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoiceSubscription = (invoice as any).subscription;
  const subscriptionId = invoiceSubscription 
    ? (typeof invoiceSubscription === 'string' 
        ? invoiceSubscription 
        : invoiceSubscription?.id)
    : null;

  if (!subscriptionId) {
    console.log('No subscription associated with invoice');
    return;
  }

  // Retrieve the subscription
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('No userId in subscription metadata');
    return;
  }

  // Update subscription status
  await upsertSubscription(subscription, userId);

  // Grant monthly credits for monthly subscriptions only
  // Yearly subscriptions are handled by cron job
  const priceId = subscription.items.data[0]?.price.id;
  if (priceId) {
    const isMonthly = await isMonthlySubscription(priceId);
    if (isMonthly) {
      await grantMonthlyCredits(userId, subscriptionId, priceId);
    } else {
      console.log(
        `Yearly subscription ${subscriptionId} - credits will be granted by cron job`
      );
    }
  }

  console.log('Invoice paid for subscription:', subscriptionId);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoiceSubscription = (invoice as any).subscription;
  const subscriptionId = invoiceSubscription 
    ? (typeof invoiceSubscription === 'string' 
        ? invoiceSubscription 
        : invoiceSubscription?.id)
    : null;

  if (!subscriptionId) {
    return;
  }

  // Retrieve the subscription
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;

  if (!userId) {
    return;
  }

  // Update subscription status to past_due
  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  console.log('Payment failed for subscription:', subscriptionId);
  // Add logic to notify user about payment failure
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('No userId in subscription metadata');
    return;
  }

  await upsertSubscription(subscription, userId);

  console.log('Subscription updated:', subscription.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('No userId in subscription metadata');
    return;
  }

  // Update subscription status to canceled
  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  console.log('Subscription deleted:', subscription.id);
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('No userId in subscription metadata');
    return;
  }

  await upsertSubscription(subscription, userId);

  console.log('Subscription created:', subscription.id);
}

/**
 * Grant monthly credits to a user based on their subscription price_id
 * Includes idempotency check to prevent duplicate grants
 */
async function grantMonthlyCredits(
  userId: string,
  subscriptionId: string,
  priceId: string
) {
  try {
    // CRITICAL: Check if credits were already granted for this billing period
    // This prevents duplicate grants if webhook is retried
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('last_credit_grant_date, current_period_start, status')
      .eq('stripe_subscription_id', subscriptionId)
      .single();

    if (subError) {
      console.error('Error fetching subscription:', subError);
      return;
    }

    // Only grant credits if subscription is active or trialing
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      console.log(
        `Skipping credit grant - subscription ${subscriptionId} is not active (status: ${subscription.status})`
      );
      return;
    }

    // Check if credits were already granted for the current billing period
    if (subscription.last_credit_grant_date && subscription.current_period_start) {
      const lastGrantDate = new Date(subscription.last_credit_grant_date);
      const periodStart = new Date(subscription.current_period_start);

      // If credits were granted after or at the start of current period, skip
      if (lastGrantDate >= periodStart) {
        console.log(
          `Credits already granted for subscription ${subscriptionId} in current billing period. ` +
          `Last grant: ${lastGrantDate.toISOString()}, Period start: ${periodStart.toISOString()}`
        );
        return;
      }
    }

    // Get monthly credits amount from database function
    const { data: monthlyCredits, error: creditsError } = await supabaseAdmin.rpc(
      'get_monthly_credits_for_price_id',
      { price_id: priceId }
    );

    if (creditsError) {
      console.error('Error getting monthly credits:', creditsError);
      return;
    }

    if (!monthlyCredits || monthlyCredits === 0) {
      console.warn(`No credit allocation found for price ID: ${priceId}`);
      return;
    }

    // Add credits to user
    const { error: addError } = await supabaseAdmin.rpc('add_credits', {
      user_id: userId,
      credits_to_add: monthlyCredits,
    });

    if (addError) {
      console.error('Error granting credits:', addError);
      return;
    }

    // Update last_credit_grant_date atomically with credit grant
    // Use current timestamp to mark when credits were granted
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        last_credit_grant_date: now,
      })
      .eq('stripe_subscription_id', subscriptionId);

    if (updateError) {
      console.error('Error updating last_credit_grant_date:', updateError);
      // Credits were already granted, so log warning but don't fail
      console.warn(
        `Credits granted but failed to update last_credit_grant_date for subscription ${subscriptionId}`
      );
    }

    console.log(
      `Granted ${monthlyCredits} credits to user ${userId} for subscription ${subscriptionId} ` +
      `(billing period: ${subscription.current_period_start})`
    );
  } catch (error) {
    console.error('Error in grantMonthlyCredits:', error);
  }
}

/**
 * Check if subscription is monthly (not yearly)
 */
async function isMonthlySubscription(priceId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('is_yearly_subscription', {
    price_id: priceId,
  });

  if (error) {
    console.error('Error checking subscription type:', error);
    return true; // Default to monthly if check fails
  }

  return !data; // Returns false if yearly, true if monthly
}

async function upsertSubscription(
  subscription: Stripe.Subscription,
  userId: string
) {
  const priceId = subscription.items.data[0]?.price.id;

  const subscriptionData = {
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    status: subscription.status,
    price_id: priceId,
    quantity: subscription.items.data[0]?.quantity || 1,
    cancel_at_period_end: subscription.cancel_at_period_end,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    current_period_start: new Date(((subscription as any).current_period_start as number) * 1000).toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    current_period_end: new Date(((subscription as any).current_period_end as number) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  await supabaseAdmin.from('subscriptions').upsert(subscriptionData, {
    onConflict: 'stripe_subscription_id',
  });
}
