import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCheckoutSession, createCustomer } from '@/lib/stripe/server';

export async function POST(request: NextRequest) {
  try {
    const { priceId } = await request.json();

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user profile for email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single();

    // Check if customer already exists in our database
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = existingCustomer?.stripe_customer_id;

    const ensureCustomer = async (): Promise<string> => {
      if (!customerId) {
        const customer = await createCustomer({
          email: profile?.email || user.email || '',
          userId: user.id,
          name: profile?.full_name || undefined,
        });
        customerId = customer.id;
        await supabase.from('customers').insert({
          user_id: user.id,
          stripe_customer_id: customerId,
          email: profile?.email || user.email || '',
        });
        return customerId;
      }
      return customerId;
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    let session: Awaited<ReturnType<typeof createCheckoutSession>>;
    try {
      await ensureCustomer();
      session = await createCheckoutSession({
        priceId,
        customerId: customerId!,
        userId: user.id,
        successUrl: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${appUrl}/pricing`,
      });
    } catch (checkoutError: unknown) {
      // Stored customer ID may be from test mode or deleted in Stripe — recreate and retry once
      const isMissingCustomer =
        checkoutError &&
        typeof checkoutError === 'object' &&
        'code' in checkoutError &&
        (checkoutError as { code?: string }).code === 'resource_missing' &&
        (checkoutError as { param?: string }).param === 'customer';

      if (!isMissingCustomer || !existingCustomer?.stripe_customer_id) {
        throw checkoutError;
      }

      await supabase
        .from('customers')
        .delete()
        .eq('user_id', user.id);

      customerId = undefined;
      await ensureCustomer();
      session = await createCheckoutSession({
        priceId,
        customerId: customerId!,
        userId: user.id,
        successUrl: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${appUrl}/pricing`,
      });
    }

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
