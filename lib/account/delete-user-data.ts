import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { cancelSubscription } from "@/lib/stripe/server"

const STORAGE_BUCKETS = ["public-bucket", "private-bucket"] as const

async function listStoragePaths(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const paths: string[] = []
  const queue = [prefix]

  while (queue.length > 0) {
    const current = queue.shift()!
    let offset = 0
    const limit = 100

    while (true) {
      const { data, error } = await supabase.storage.from(bucket).list(current, {
        limit,
        offset,
      })

      if (error) {
        console.warn(`[delete-user-data] storage list failed for ${bucket}/${current}:`, error.message)
        break
      }

      if (!data?.length) {
        break
      }

      for (const entry of data) {
        const entryPath = current ? `${current}/${entry.name}` : entry.name
        if (entry.id) {
          paths.push(entryPath)
        } else {
          queue.push(entryPath)
        }
      }

      if (data.length < limit) {
        break
      }
      offset += limit
    }
  }

  return paths
}

async function deleteUserStorage(supabase: SupabaseClient, userId: string): Promise<void> {
  const prefix = `${userId}`

  for (const bucket of STORAGE_BUCKETS) {
    const paths = await listStoragePaths(supabase, bucket, prefix)
    if (paths.length === 0) continue

    const chunkSize = 100
    for (let i = 0; i < paths.length; i += chunkSize) {
      const chunk = paths.slice(i, i + chunkSize)
      const { error } = await supabase.storage.from(bucket).remove(chunk)
      if (error) {
        console.warn(`[delete-user-data] storage remove failed for ${bucket}:`, error.message)
      }
    }
  }
}

async function cancelStripeSubscriptionIfAny(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", userId)
    .maybeSingle()

  const subscriptionId = subscription?.stripe_subscription_id
  if (!subscriptionId) return
  if (subscription.status === "canceled") return

  try {
    await cancelSubscription(subscriptionId)
  } catch (error) {
    console.warn("[delete-user-data] Stripe subscription cancel failed:", error)
  }
}

export async function deleteAllUserData(userId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  if (!supabase) {
    throw new Error("Service role client is not configured.")
  }

  await cancelStripeSubscriptionIfAny(supabase, userId)
  await deleteUserStorage(supabase, userId)

  const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId)
  if (deleteUserError) {
    throw new Error(deleteUserError.message)
  }
}
