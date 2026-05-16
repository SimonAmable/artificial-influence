# Stripe Billing Integration

## Quick Start

1. Run SQL migration ? Supabase Dashboard ? SQL Editor ? run `supabase/manual/supabase-subscriptions-setup.sql`
2. Create products in [Stripe Dashboard](https://dashboard.stripe.com/products) ? copy Price IDs
3. Update `app/pricing/page.tsx` with your real Price IDs
4. Test: visit `/pricing` ? subscribe with test card `4242 4242 4242 4242`

---

## Environment Variables

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

> `SUPABASE_SERVICE_ROLE_KEY` is also required for webhook operations.

---

## Key Files

| File | Purpose |
|------|---------|
| `app/pricing/page.tsx` | Pricing plans display — update Price IDs here |
| `app/api/checkout/route.ts` | Creates Stripe Checkout sessions |
| `app/api/webhooks/stripe/route.ts` | Processes Stripe webhook events |
| `app/api/customer-portal/route.ts` | Creates Customer Portal sessions |
| `lib/stripe/server.ts` | Server-side Stripe operations |
| `lib/subscription.ts` | Subscription helpers and feature gating |
| `components/RequireSubscription.tsx` | Client-side access control wrapper |

---

## Test Cards

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Decline |
| `4000 0025 0000 3155` | 3D Secure |
| `4000 0000 0000 9995` | Insufficient funds |

Use any future date, any 3-digit CVC, any postal code.

---

## Protecting Routes

**Client component:**
```tsx
import RequireSubscription from '@/components/RequireSubscription';
export default function PremiumPage() {
  return <RequireSubscription>{/* content */}</RequireSubscription>;
}
```

**Server component:**
```tsx
import { hasActiveSubscription } from '@/lib/subscription';
const hasAccess = await hasActiveSubscription(user.id);
if (!hasAccess) redirect('/pricing');
```

---

## Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create customer & subscription records |
| `invoice.paid` | Activate subscription |
| `invoice.payment_failed` | Mark `past_due` |
| `customer.subscription.updated` | Sync subscription changes |
| `customer.subscription.deleted` | Mark canceled |

---

## Local Webhook Testing

```bash
# Install Stripe CLI, then:
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
```

---

## Database Schema

**`customers`**: `user_id`, `stripe_customer_id`, `email`  
**`subscriptions`**: `user_id`, `stripe_subscription_id`, `status`, `price_id`, `current_period_end`

---

## Common Customizations

```typescript
// 14-day trial (in checkout route)
subscription_data: { trial_period_days: 14 }

// Coupon
discounts: [{ coupon: 'CODE' }]

// Auto tax
automatic_tax: { enabled: true }
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Webhook signature failed | Check `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard |
| "No customer found" | User must complete checkout first |
| Subscription not updating | Check webhook delivery in Stripe Events |
| Database errors | Verify RLS policies; ensure service role key is set |
| Changes not reflecting | Restart dev server after changing env vars |

---

## Pre-Launch Checklist

- [ ] Database migration run in production Supabase
- [ ] Live Stripe keys configured
- [ ] Price IDs updated with live prices
- [ ] Webhook endpoint set to production URL
- [ ] `NEXT_PUBLIC_APP_URL` set to production domain
- [ ] Tested with real card
- [ ] Customer Portal activated in Stripe Dashboard
- [ ] Smart Retries enabled in Stripe Billing Settings
