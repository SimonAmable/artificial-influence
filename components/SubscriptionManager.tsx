'use client';

import { useState } from 'react';
import { Subscription, getSubscriptionStatusDisplay } from '@/lib/subscription';

interface SubscriptionManagerProps {
  subscription: Subscription | null;
}

export default function SubscriptionManager({
  subscription,
}: SubscriptionManagerProps) {
  const [loading, setLoading] = useState(false);

  const handleManageSubscription = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create portal session');
      }

      // Redirect to Stripe Customer Portal
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to open billing portal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!subscription) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <div className="max-w-md mx-auto">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-muted-foreground"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M20 12H4M12 4v16"></path>
          </svg>
          <h2 className="text-2xl font-bold mb-2">No Active Subscription</h2>
          <p className="text-muted-foreground mb-6">
            You don&apos;t have an active subscription. Choose a plan to get started.
          </p>
          <a
            href="/pricing"
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            View Pricing Plans
          </a>
        </div>
      </div>
    );
  }

  const statusInfo = getSubscriptionStatusDisplay(subscription.status);
  const currentPeriodEnd = new Date(subscription.current_period_end);
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';

  return (
    <div className="space-y-6">
      {/* Subscription Status Card */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">Current Subscription</h2>
            <p className="text-sm text-muted-foreground">{statusInfo.description}</p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
              statusInfo.color === 'green'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                : statusInfo.color === 'blue'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                : statusInfo.color === 'orange'
                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100'
                : statusInfo.color === 'yellow'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
            }`}
          >
            {statusInfo.label}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Price ID</p>
            <p className="font-mono text-sm">{subscription.price_id}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Quantity</p>
            <p className="font-semibold">{subscription.quantity}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              {isActive ? 'Next Billing Date' : 'Period End'}
            </p>
            <p className="font-semibold">{currentPeriodEnd.toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Cancel at Period End</p>
            <p className="font-semibold">
              {subscription.cancel_at_period_end ? 'Yes' : 'No'}
            </p>
          </div>
        </div>

        {subscription.cancel_at_period_end && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Your subscription will be canceled on{' '}
              <strong>{currentPeriodEnd.toLocaleDateString()}</strong>. You can
              reactivate it anytime before then.
            </p>
          </div>
        )}

        <button
          onClick={handleManageSubscription}
          disabled={loading}
          className="w-full md:w-auto bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
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
              Loading...
            </span>
          ) : (
            'Manage Subscription'
          )}
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-semibold mb-2">Billing Portal</h3>
          <p className="text-sm text-muted-foreground">
            Use the Stripe Customer Portal to update your payment method, view invoices,
            and manage your subscription.
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-semibold mb-2">Need Help?</h3>
          <p className="text-sm text-muted-foreground">
            Contact our support team if you have any questions about your subscription
            or billing.
          </p>
        </div>
      </div>
    </div>
  );
}
