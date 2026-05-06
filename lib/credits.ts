import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get user's current credit balance
 */
export async function getUserCredits(userId: string, supabaseClient?: SupabaseClient): Promise<number> {
  const supabase = supabaseClient ?? (await createClient());

  const { data, error } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user credits:', error);
    return 0;
  }

  return data?.credits || 0;
}

/**
 * Check if user has sufficient credits
 */
export async function checkUserHasCredits(
  userId: string,
  requiredCredits: number,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const currentCredits = await getUserCredits(userId, supabaseClient);
  return currentCredits >= requiredCredits;
}

/**
 * Deduct credits from user's account
 * Returns the new balance, or -1 if insufficient credits
 */
export async function deductUserCredits(
  userId: string,
  creditsToDeduct: number,
  supabaseClient?: SupabaseClient
): Promise<number> {
  const supabase = supabaseClient ?? (await createClient());

  const { data, error } = await supabase.rpc('deduct_credits', {
    user_id: userId,
    credits_to_deduct: creditsToDeduct,
  });

  if (error) {
    console.error('Error deducting credits:', error);
    return -1;
  }

  return data || -1;
}

/**
 * Deduct up to the requested amount, capping the charge at the user's current balance.
 * Returns the amount that was actually deducted.
 */
export async function deductUserCreditsUpTo(
  userId: string,
  creditsToDeduct: number,
  supabaseClient?: SupabaseClient
): Promise<number> {
  const requested = Math.max(0, Math.floor(creditsToDeduct));
  if (requested <= 0) {
    return 0;
  }

  const currentCredits = await getUserCredits(userId, supabaseClient);
  const firstAttempt = Math.min(currentCredits, requested);
  if (firstAttempt <= 0) {
    return 0;
  }

  const firstBalance = await deductUserCredits(userId, firstAttempt, supabaseClient);
  if (firstBalance !== -1) {
    return firstAttempt;
  }

  const refreshedCredits = await getUserCredits(userId, supabaseClient);
  const retryAttempt = Math.min(refreshedCredits, requested);
  if (retryAttempt <= 0) {
    return 0;
  }

  const retryBalance = await deductUserCredits(userId, retryAttempt, supabaseClient);
  return retryBalance === -1 ? 0 : retryAttempt;
}

/**
 * Get user's credit balance and subscription info
 */
export async function getUserCreditInfo(userId: string) {
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    return { credits: 0, subscription: null };
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return {
    credits: profile?.credits || 0,
    subscription: subscription || null,
  };
}
