'use client';

import RequireSubscription from '@/components/RequireSubscription';

/**
 * Example of a premium page that requires an active subscription
 * 
 * To use this pattern in your pages:
 * 1. Import the RequireSubscription component
 * 2. Wrap your page content with it
 * 3. Optionally provide a custom fallback
 */
export default function PremiumPage() {
  return (
    <RequireSubscription>
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/20 rounded-lg p-8 mb-8">
            <h1 className="text-4xl font-bold mb-4">Premium Content</h1>
            <p className="text-lg text-muted-foreground">
              This is a premium feature that requires an active subscription. 
              Since you&apos;re seeing this, your subscription is active! 🎉
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-3">Exclusive Feature 1</h2>
              <p className="text-muted-foreground mb-4">
                Access to advanced analytics and insights about your usage patterns
                and performance metrics.
              </p>
              <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                Explore Analytics
              </button>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-3">Exclusive Feature 2</h2>
              <p className="text-muted-foreground mb-4">
                Advanced AI-powered tools and capabilities not available in the free tier.
              </p>
              <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                Try AI Tools
              </button>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-3">Priority Support</h2>
              <p className="text-muted-foreground mb-4">
                Get faster response times and dedicated support from our team.
              </p>
              <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                Contact Support
              </button>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-3">Custom Integrations</h2>
              <p className="text-muted-foreground mb-4">
                Connect with third-party services and automate your workflows.
              </p>
              <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                View Integrations
              </button>
            </div>
          </div>

          <div className="mt-8 bg-card border border-border rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-3">Subscription Status</h3>
            <p className="text-muted-foreground">
              You have access to all premium features. Manage your subscription or
              update your payment method in your{' '}
              <a
                href="/dashboard/subscription"
                className="text-primary hover:underline"
              >
                subscription dashboard
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </RequireSubscription>
  );
}
