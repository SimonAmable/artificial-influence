import { createClient } from '@/lib/supabase/server';

/**
 * Get user's current credit balance
 */
export async function getUserCredits(userId: string): Promise<number> {
  const supabase = await createClient();

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
  requiredCredits: number
): Promise<boolean> {
  const currentCredits = await getUserCredits(userId);
  return currentCredits >= requiredCredits;
}

/**
 * Deduct credits from user's account
 * Returns the new balance, or -1 if insufficient credits
 */
export async function deductUserCredits(
  userId: string,
  creditsToDeduct: number
): Promise<number> {
  const supabase = await createClient();

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
