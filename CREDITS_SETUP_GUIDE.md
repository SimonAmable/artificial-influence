# Credit System Setup Guide

## Manual Steps Required

### Step 1: Run Database Migration

1. Open your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Open the file: `supabase-credits-setup.sql`
4. Copy the **entire contents** of the file
5. Paste into the SQL Editor
6. Click **Run** (or press Ctrl+Enter)
7. Verify success - you should see "Success. No rows returned"

**What this does:**
- Adds `credits` column to `profiles` table
- Adds `last_credit_grant_date` column to `subscriptions` table
- Creates database functions for credit management
- Sets up the cron job automatically (if pg_cron is enabled)

### Step 2: Verify Cron Job Setup

The SQL migration includes cron job setup. To verify:

1. In Supabase Dashboard, go to **Database** → **Cron Jobs**
2. Look for a job named `grant-monthly-credits-yearly`
3. It should be scheduled to run daily at 2 AM UTC

**If cron job wasn't created automatically:**

You may need to enable the `pg_cron` extension first:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

Then manually create the cron job:

```sql
SELECT cron.schedule(
  'grant-monthly-credits-yearly',
  '0 2 * * *',
  $$
  SELECT * FROM public.grant_monthly_credits_for_yearly_subscriptions();
  $$
);
```

### Step 3: Test the Setup

1. **Test initial credit grant:**
   - Create a test subscription via `/pricing-test`
   - Check that user receives credits immediately
   - Verify in Supabase: `SELECT credits FROM profiles WHERE id = 'user_id';`

2. **Test monthly subscription:**
   - Wait for or trigger `invoice.paid` webhook
   - Verify credits are granted via webhook

3. **Test yearly subscription:**
   - Create a yearly subscription
   - Wait 28+ days or manually run cron function:
     ```sql
     SELECT * FROM public.grant_monthly_credits_for_yearly_subscriptions();
     ```
   - Verify credits are granted monthly

## What Was Implemented

### Files Created

1. **`supabase-credits-setup.sql`** - Complete database migration
   - Schema updates (credits column, last_credit_grant_date)
   - Credit management functions
   - Cron function for yearly subscriptions
   - Cron job setup

2. **`lib/credits.ts`** - TypeScript helper functions
   - `getUserCredits()` - Get user's credit balance
   - `checkUserHasCredits()` - Check if user has enough credits
   - `deductUserCredits()` - Deduct credits when user uses features
   - `getUserCreditInfo()` - Get credits and subscription info

### Files Modified

1. **`app/api/webhooks/stripe/route.ts`**
   - Added `grantMonthlyCredits()` function
   - Added `isMonthlySubscription()` helper
   - Updated `handleCheckoutSessionCompleted()` to grant initial credits
   - Updated `handleInvoicePaid()` to grant credits for monthly subscriptions

## Credit Allocation

- **Basic**: 100 credits/month
- **Pro**: 500 credits/month
- **Creator**: 1750 credits/month

Applies to both monthly and yearly subscriptions (yearly gets monthly credits granted monthly).

## How It Works

### Initial Subscription
1. User subscribes → `checkout.session.completed` webhook
2. Webhook grants first month's credits immediately
3. Sets `last_credit_grant_date`

### Monthly Subscriptions
1. Each month → `invoice.paid` webhook fires
2. Webhook grants monthly credits immediately
3. Updates `last_credit_grant_date`

### Yearly Subscriptions
1. Yearly invoice paid → webhook does NOT grant credits
2. Daily cron job checks yearly subscriptions
3. If `last_credit_grant_date` is NULL or >28 days old, grants monthly credits
4. Updates `last_credit_grant_date`
5. Repeats monthly via cron

## Using Credits in Your App

When users consume features, deduct credits:

```typescript
import { deductUserCredits, checkUserHasCredits } from '@/lib/credits';

// Check if user has enough credits
const hasCredits = await checkUserHasCredits(userId, 10);
if (!hasCredits) {
  return { error: 'Insufficient credits' };
}

// Deduct credits
const newBalance = await deductUserCredits(userId, 10);
if (newBalance === -1) {
  return { error: 'Failed to deduct credits' };
}

// Proceed with feature usage
```

## Troubleshooting

### Credits not being granted
- Check webhook events in Stripe Dashboard
- Verify database functions exist: `SELECT * FROM pg_proc WHERE proname = 'add_credits';`
- Check webhook logs for errors

### Cron job not running
- Verify cron job exists: `SELECT * FROM cron.job WHERE jobname = 'grant-monthly-credits-yearly';`
- Check if pg_cron extension is enabled
- Manually test: `SELECT * FROM public.grant_monthly_credits_for_yearly_subscriptions();`

### Database errors
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in environment variables
- Verify RLS policies allow service role access
- Check function permissions are granted

## Next Steps

After running the migration:
1. Test with a real subscription
2. Monitor credit grants in logs
3. Verify cron job runs daily
4. Integrate credit checks into your feature usage
