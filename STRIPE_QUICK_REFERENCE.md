# Stripe Subscription - Quick Reference

## 🚀 Quick Start (4 Steps)

1. **Run SQL Migration** → Supabase Dashboard → SQL Editor → Run `supabase-subscriptions-setup.sql`
2. **Create Products** → Stripe Dashboard → Products → Create → Copy Price IDs
3. **Update Price IDs** → Edit `app/pricing/page.tsx` → Replace placeholder IDs
4. **Test** → Visit `/pricing` → Subscribe with test card `4242 4242 4242 4242`

---

## 📁 Key Files Reference

| File | Purpose | When to Edit |
|------|---------|--------------|
| `app/pricing/page.tsx` | Pricing plans display | Update price IDs and plan details |
| `app/api/webhooks/stripe/route.ts` | Webhook event handler | Add custom webhook logic |
| `lib/subscription.ts` | Subscription utilities | Add feature gating logic |
| `components/RequireSubscription.tsx` | Access control wrapper | Customize paywall UI |
| `supabase-subscriptions-setup.sql` | Database schema | Add custom subscription fields |

---

## 🔑 Environment Variables

```env
# Stripe (Required)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # ⚠️ Required for webhooks!

# App (Required)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## 🧪 Test Cards

| Card | Purpose |
|------|---------|
| `4242 4242 4242 4242` | ✅ Success |
| `4000 0000 0000 0002` | ❌ Decline |
| `4000 0025 0000 3155` | 🔐 3D Secure |
| `4000 0000 0000 9995` | 💳 Insufficient funds |

---

## 🛡️ Protect a Page

### Client Component
```tsx
'use client';
import RequireSubscription from '@/components/RequireSubscription';

export default function PremiumPage() {
  return (
    <RequireSubscription>
      {/* Premium content */}
    </RequireSubscription>
  );
}
```

### Server Component
```tsx
import { hasActiveSubscription } from '@/lib/subscription';

export default async function Page() {
  const user = // ... get user
  const hasAccess = await hasActiveSubscription(user.id);
  
  if (!hasAccess) redirect('/pricing');
  
  return <>Premium content</>;
}
```

---

## 🔗 Important URLs

### Pages
- `/pricing` - Subscription plans
- `/dashboard/subscription` - Manage subscription
- `/success` - Post-checkout confirmation
- `/premium` - Example premium page

### API Routes
- `POST /api/checkout` - Create checkout session
- `POST /api/webhooks/stripe` - Stripe webhook handler
- `POST /api/customer-portal` - Customer portal session

### Stripe Dashboard
- [Products](https://dashboard.stripe.com/products)
- [Webhooks](https://dashboard.stripe.com/webhooks)
- [Events](https://dashboard.stripe.com/events)
- [Subscriptions](https://dashboard.stripe.com/subscriptions)
- [Customer Portal](https://dashboard.stripe.com/settings/billing/portal)

---

## 📊 Database Tables

### `customers`
```sql
user_id → profiles.id (unique)
stripe_customer_id (unique)
email
```

### `subscriptions`
```sql
user_id → profiles.id
stripe_subscription_id (unique)
status (active, canceled, past_due, etc.)
price_id
current_period_end
```

---

## 🎯 Common Tasks

### Get User Subscription
```typescript
import { getUserSubscription } from '@/lib/subscription';

const subscription = await getUserSubscription(userId);
if (subscription?.status === 'active') {
  // User has access
}
```

### Check Feature Access
```typescript
import { canAccessFeature } from '@/lib/subscription';

const canAccess = await canAccessFeature(userId, 'premium_feature');
```

### Create Checkout Session
```typescript
const response = await fetch('/api/checkout', {
  method: 'POST',
  body: JSON.stringify({ priceId: 'price_...' }),
});
const { url } = await response.json();
window.location.href = url;
```

### Open Customer Portal
```typescript
const response = await fetch('/api/customer-portal', {
  method: 'POST',
  body: JSON.stringify({ returnUrl: window.location.href }),
});
const { url } = await response.json();
window.location.href = url;
```

---

## 📮 Webhook Events

| Event | Fired When | Your Action |
|-------|-----------|-------------|
| `checkout.session.completed` | Checkout finishes | Create customer/subscription |
| `invoice.paid` | Payment succeeds | Activate subscription |
| `invoice.payment_failed` | Payment fails | Mark past_due |
| `customer.subscription.updated` | Plan changes | Update subscription |
| `customer.subscription.deleted` | Cancellation | Mark canceled |

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Webhook signature failed | Check `STRIPE_WEBHOOK_SECRET` |
| "No customer found" | User needs to checkout first |
| Subscription not updating | Check webhook delivery in Stripe |
| Changes not reflecting | Restart dev server |
| Database errors | Verify RLS policies |

---

## ⚡ Quick Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Test webhooks locally (requires Stripe CLI)
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
```

---

## 🎨 Customization Examples

### Add 14-day trial
```typescript
// In app/api/checkout/route.ts
subscription_data: {
  trial_period_days: 14,
}
```

### Add coupon support
```typescript
// In app/api/checkout/route.ts
discounts: [
  { coupon: 'SUMMER2024' }
]
```

### Collect tax automatically
```typescript
// In app/api/checkout/route.ts
automatic_tax: {
  enabled: true,
}
```

---

## 📖 Documentation Links

- [Full Setup Guide](./STRIPE_SETUP_GUIDE.md)
- [Implementation Summary](./STRIPE_IMPLEMENTATION_SUMMARY.md)
- [Stripe Docs](https://stripe.com/docs)
- [Stripe API](https://stripe.com/docs/api)
- [Supabase Docs](https://supabase.com/docs)

---

## ✅ Pre-Launch Checklist

- [ ] Database migration run in production
- [ ] Live Stripe keys configured
- [ ] Price IDs updated with live prices
- [ ] Webhook endpoint set to production URL
- [ ] Production URL in `NEXT_PUBLIC_APP_URL`
- [ ] Test with real card
- [ ] Customer Portal activated
- [ ] Webhook events monitored

---

**Need more help?** See `STRIPE_SETUP_GUIDE.md` for detailed instructions.
