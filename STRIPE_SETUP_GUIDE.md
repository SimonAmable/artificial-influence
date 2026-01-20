# Stripe Subscription Integration - Setup & Testing Guide

## Prerequisites

✅ You've completed:
- Added Stripe webhook endpoint to production URL
- Added environment variables for Stripe keys
- Configured webhook events in Stripe Dashboard

## Step 1: Run Database Migrations

Execute the SQL migration to create subscription tables in Supabase:

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Open and run `supabase-subscriptions-setup.sql`
4. Verify tables are created: `customers` and `subscriptions`

## Step 2: Configure Stripe Dashboard

### Create Products and Prices

1. Go to [Stripe Products](https://dashboard.stripe.com/products)
2. Create your subscription products (e.g., Basic, Pro, Enterprise)
3. For each product:
   - Click "Create product"
   - Set product name and description
   - Choose "Recurring" pricing
   - Set price and billing interval (monthly/yearly)
   - Click "Save product"
4. **Copy the Price IDs** (format: `price_xxxxxxxxxxxxx`)

### Update Pricing Page

Edit `app/pricing/page.tsx` and replace the placeholder price IDs:

```typescript
const pricingPlans = [
  {
    // ...
    priceId: 'price_YOUR_ACTUAL_BASIC_PRICE_ID', // Replace this
  },
  {
    // ...
    priceId: 'price_YOUR_ACTUAL_PRO_PRICE_ID', // Replace this
  },
  // ... etc
];
```

### Enable Customer Portal

1. Go to [Customer Portal Settings](https://dashboard.stripe.com/settings/billing/portal)
2. Click "Activate test link" (for test mode)
3. Configure features you want customers to access:
   - Update payment method
   - Cancel subscription
   - View invoice history
4. Click "Save changes"

## Step 3: Environment Variables

Verify your `.env.local` has all required variables:

```env
# Stripe Keys (Production)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# App URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

⚠️ **Important**: You need `SUPABASE_SERVICE_ROLE_KEY` for webhook operations!

## Step 4: Test the Integration

### Test Mode Testing (Recommended First)

Before testing with production keys, test with Stripe test mode:

1. Switch to test mode in Stripe Dashboard (toggle in top-right)
2. Create test products with test price IDs
3. Update environment variables with test keys (`pk_test_...` and `sk_test_...`)
4. Use test webhook endpoint or Stripe CLI

### Using Test Cards

#### Successful Payment
- Card: `4242 4242 4242 4242`
- Date: Any future date
- CVC: Any 3 digits
- ZIP: Any valid postal code

#### Declined Payment
- Card: `4000 0000 0000 0002`

#### Requires Authentication (3D Secure)
- Card: `4000 0025 0000 3155`

#### Insufficient Funds
- Card: `4000 0000 0000 9995`

### Test Flow

1. **Sign up / Login** to your app
2. **Navigate to pricing page**: `/pricing`
3. **Click "Subscribe"** on any plan
4. **Complete Stripe Checkout** with test card
5. **Check webhook delivery**: 
   - Go to [Stripe Events](https://dashboard.stripe.com/events)
   - Verify `checkout.session.completed` was sent
6. **Verify database**: Check Supabase tables for new records
7. **Navigate to subscription page**: `/dashboard/subscription`
8. **Test Customer Portal**: Click "Manage Subscription"

## Step 5: Local Webhook Testing with Stripe CLI

If testing locally before production:

### Install Stripe CLI
```bash
# Install from https://stripe.com/docs/stripe-cli
stripe login
```

### Forward Webhooks to Local Server
```bash
# This will give you a webhook signing secret
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Copy the signing secret (whsec_...) to your .env.local
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Trigger Test Events
```bash
# Test subscription creation
stripe trigger checkout.session.completed

# Test successful payment
stripe trigger invoice.paid

# Test failed payment
stripe trigger invoice.payment_failed
```

## Step 6: Production Deployment

### Before Going Live

1. **Activate Stripe Account**
   - Complete business verification in Stripe Dashboard
   - Add bank account for payouts
   - Enable two-factor authentication

2. **Switch to Live Mode**
   - Update environment variables with live keys (`pk_live_...`, `sk_live_...`)
   - Recreate products in live mode or copy from test mode
   - Update price IDs in `app/pricing/page.tsx`

3. **Verify Production Webhook**
   - Ensure webhook endpoint is set to your production URL
   - Webhook secret should be from production webhook
   - Test webhook delivery after deployment

4. **Test with Real Card**
   - Make a small test purchase with a real card
   - Verify complete flow: checkout → webhook → database → access

## Common Issues & Solutions

### Issue: Webhook signature verification failed
**Solution**: Ensure `STRIPE_WEBHOOK_SECRET` matches the webhook in Stripe Dashboard

### Issue: "No customer found" error
**Solution**: User needs to complete checkout at least once to create customer record

### Issue: Subscription not showing in dashboard
**Solution**: Check webhook events in Stripe Dashboard - webhook might have failed

### Issue: Changes not reflecting
**Solution**: Restart Next.js dev server after changing environment variables

### Issue: Database permission errors
**Solution**: Ensure RLS policies are set up correctly and `SUPABASE_SERVICE_ROLE_KEY` is configured

## Monitoring & Maintenance

### Monitor Webhooks
- Check [Stripe Events](https://dashboard.stripe.com/events) regularly
- Set up alerts for failed webhooks
- Review webhook logs in your application

### Handle Failed Payments
- Enable Smart Retries in [Billing Settings](https://dashboard.stripe.com/settings/billing/automatic)
- Configure email notifications for payment failures
- Monitor subscriptions with `past_due` status

### Revenue Recovery
- Set up [Billing Automations](https://dashboard.stripe.com/billing/automations)
- Enable automatic collection of past-due payments
- Configure retry schedule for failed payments

## Security Checklist

- [ ] Never expose `STRIPE_SECRET_KEY` on client-side
- [ ] Always verify webhook signatures
- [ ] Use HTTPS in production
- [ ] Enable RLS on Supabase tables
- [ ] Use service role key only in secure server contexts
- [ ] Validate user authentication before creating checkouts
- [ ] Sanitize and validate all user inputs

## Testing Checklist

- [ ] New subscription creation
- [ ] Successful payment processing
- [ ] Failed payment handling
- [ ] Subscription updates (upgrade/downgrade)
- [ ] Subscription cancellation
- [ ] Customer portal access
- [ ] Trial period expiration (if using trials)
- [ ] Proration handling (if applicable)
- [ ] Webhook signature verification
- [ ] Database record creation/updates
- [ ] Access control enforcement

## Support Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Dashboard](https://dashboard.stripe.com)
- [Stripe Support](https://support.stripe.com)
- [Supabase Documentation](https://supabase.com/docs)

## Next Steps

After basic setup is complete, consider implementing:

1. **Trial Periods** - Add free trial support to subscriptions
2. **Multiple Plans** - Allow users to upgrade/downgrade between plans
3. **Metered Billing** - Implement usage-based pricing
4. **Coupons & Promotions** - Add discount code support
5. **Tax Collection** - Enable Stripe Tax for automatic tax calculation
6. **Email Notifications** - Send custom emails for subscription events
7. **Analytics** - Track subscription metrics and revenue
8. **Invoice Customization** - Customize invoice appearance
9. **Multi-currency** - Support international customers
10. **Team/Organization Subscriptions** - Allow group subscriptions
