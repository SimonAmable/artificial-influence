import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Server-only Supabase client with the service role key (bypasses RLS).
 * Never import this from client components.
 */
export function createServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return null
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
