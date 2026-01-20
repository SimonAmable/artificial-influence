export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'trialing'
  | 'unpaid';

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  status: SubscriptionStatus;
  price_id: string;
  quantity: number;
  cancel_at_period_end: boolean;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get subscription status for display
 */
export function getSubscriptionStatusDisplay(status: SubscriptionStatus): {
  label: string;
  color: string;
  description: string;
} {
  const statusMap = {
    active: {
      label: 'Active',
      color: 'green',
      description: 'Your subscription is active',
    },
    trialing: {
      label: 'Trial',
      color: 'blue',
      description: 'Your trial is active',
    },
    past_due: {
      label: 'Past Due',
      color: 'orange',
      description: 'Payment failed, please update your payment method',
    },
    canceled: {
      label: 'Canceled',
      color: 'red',
      description: 'Your subscription has been canceled',
    },
    incomplete: {
      label: 'Incomplete',
      color: 'yellow',
      description: 'Payment is being processed',
    },
    incomplete_expired: {
      label: 'Expired',
      color: 'red',
      description: 'Subscription setup expired',
    },
    unpaid: {
      label: 'Unpaid',
      color: 'red',
      description: 'Payment failed',
    },
  };

  return statusMap[status] || statusMap.canceled;
}
