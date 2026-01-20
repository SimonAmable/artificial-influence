import { createClient } from '@/lib/supabase/server';
import type { Subscription, Customer } from './subscription';

/**
 * Get user's active subscription
 */
export async function getUserSubscription(
  userId: string
): Promise<Subscription | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }

  return data;
}

/**
 * Check if user has an active subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  return subscription !== null;
}

/**
 * Get user's Stripe customer record
 */
export async function getUserCustomer(
  userId: string
): Promise<Customer | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching customer:', error);
    return null;
  }

  return data;
}

/**
 * Get all subscriptions for a user (including inactive)
 */
export async function getAllUserSubscriptions(
  userId: string
): Promise<Subscription[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching subscriptions:', error);
    return [];
  }

  return data || [];
}

/**
 * Check if user can access a specific feature based on their subscription
 */
export async function canAccessFeature(
  userId: string,
  feature: string
): Promise<boolean> {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    return false;
  }

  // Add your feature-based logic here
  // For example, you could map price_ids to feature sets
  const featureMap: Record<string, string[]> = {
    // Example: 'price_basic': ['feature1', 'feature2'],
    // 'price_pro': ['feature1', 'feature2', 'feature3'],
  };

  const allowedFeatures = featureMap[subscription.price_id] || [];
  return allowedFeatures.includes(feature);
}
