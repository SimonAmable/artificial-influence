import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserSubscription } from '@/lib/subscription-server';
import { isFanvueBillingProduct } from '@/lib/billing/require-stripe-billing';
import { getFanvueBillingSummaryForUser } from '@/lib/fanvue/billing-service';
import type { Subscription } from '@/lib/subscription';
import SubscriptionManager from '@/components/SubscriptionManager';

export default async function SubscriptionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  if (isFanvueBillingProduct()) {
    const summary = await getFanvueBillingSummaryForUser(user.id);
    let subscription: Subscription | null = null;

    if (summary.hasSubscription) {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('billing_provider', 'fanvue')
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      subscription = (data as Subscription | null) ?? null;
    }

    return (
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Subscription Management</h1>
            <p className="text-muted-foreground">
              Manage your subscription through the Fanvue App Store
            </p>
          </div>

          <SubscriptionManager
            subscription={subscription}
            billingProvider="fanvue"
            planName={summary.planName}
          />
        </div>
      </div>
    );
  }

  const subscription = await getUserSubscription(user.id);

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Subscription Management</h1>
          <p className="text-muted-foreground">
            Manage your subscription and billing details
          </p>
        </div>

        <SubscriptionManager subscription={subscription} />
      </div>
    </div>
  );
}
