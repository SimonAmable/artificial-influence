import { NextRequest, NextResponse } from 'next/server';
import { validateCreditPackCredits, CREDIT_PACK_CURRENCY } from '@/lib/credit-packs';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  createCreditPackCheckoutSession,
  createCustomer,
} from '@/lib/stripe/server';

function isMissingStripeCustomer(error: unknown) {
  return (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'resource_missing' &&
    (error as { param?: string }).param === 'customer'
  );
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    }

    const bodyRecord = body as Record<string, unknown>;
    const bodyKeys = Object.keys(bodyRecord);
    if (bodyKeys.length !== 1 || !bodyKeys.includes('credits')) {
      return NextResponse.json(
        { error: 'Request body must contain only credits' },
        { status: 400 }
      );
    }

    const validation = validateCreditPackCredits(bodyRecord.credits);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createServiceRoleClient();
    if (!admin) {
      return NextResponse.json(
        { error: 'Credit checkout is not configured' },
        { status: 500 }
      );
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single();

    const { data: existingCustomer } = await admin
      .from('customers')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = existingCustomer?.stripe_customer_id;

    const ensureCustomer = async (): Promise<string> => {
      if (customerId) {
        return customerId;
      }

      const customer = await createCustomer({
        email: profile?.email || user.email || '',
        userId: user.id,
        name: profile?.full_name || undefined,
      });

      customerId = customer.id;
      const { error: customerError } = await admin.from('customers').upsert(
        {
          user_id: user.id,
          stripe_customer_id: customerId,
          email: profile?.email || user.email || '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      if (customerError) {
        throw customerError;
      }

      return customerId;
    };

    const { data: purchase, error: purchaseError } = await admin
      .from('credit_purchases')
      .insert({
        user_id: user.id,
        credits: validation.credits,
        amount_cents: validation.amountCents,
        currency: CREDIT_PACK_CURRENCY,
        status: 'pending',
      })
      .select('id')
      .single();

    if (purchaseError || !purchase) {
      console.error('Error creating credit purchase:', purchaseError);
      return NextResponse.json(
        { error: 'Failed to prepare credit checkout' },
        { status: 500 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    let session: Awaited<ReturnType<typeof createCreditPackCheckoutSession>>;
    try {
      await ensureCustomer();
      session = await createCreditPackCheckoutSession({
        customerId: customerId!,
        userId: user.id,
        creditPurchaseId: purchase.id,
        credits: validation.credits,
        amountCents: validation.amountCents,
        currency: CREDIT_PACK_CURRENCY,
        successUrl: `${appUrl}/credits/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${appUrl}/pricing`,
      });
    } catch (checkoutError: unknown) {
      if (isMissingStripeCustomer(checkoutError) && existingCustomer?.stripe_customer_id) {
        await admin.from('customers').delete().eq('user_id', user.id);
        customerId = undefined;
        await ensureCustomer();
        session = await createCreditPackCheckoutSession({
          customerId: customerId!,
          userId: user.id,
          creditPurchaseId: purchase.id,
          credits: validation.credits,
          amountCents: validation.amountCents,
          currency: CREDIT_PACK_CURRENCY,
          successUrl: `${appUrl}/credits/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${appUrl}/pricing`,
        });
      } else {
        await admin
          .from('credit_purchases')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', purchase.id);
        throw checkoutError;
      }
    }

    const { error: updateError } = await admin
      .from('credit_purchases')
      .update({
        stripe_checkout_session_id: session.id,
        status: 'checkout_created',
        updated_at: new Date().toISOString(),
      })
      .eq('id', purchase.id);

    if (updateError) {
      console.error('Error saving Stripe Checkout Session for credit purchase:', updateError);
      return NextResponse.json(
        { error: 'Failed to save credit checkout' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating credit checkout session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
