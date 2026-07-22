import "server-only"

import { createServiceRoleClient } from "@/lib/supabase/service-role"

function sanitizeConnection(row: Record<string, unknown> | null) {
  if (!row) return null
  const {
    access_token_encrypted: _access,
    refresh_token_encrypted: _refresh,
    ...rest
  } = row
  return rest
}

async function selectAll(
  table: string,
  column: string,
  userId: string
): Promise<unknown[]> {
  const supabase = createServiceRoleClient()
  if (!supabase) {
    throw new Error("Service role client is not configured.")
  }

  const { data, error } = await supabase.from(table).select("*").eq(column, userId)
  if (error) {
    console.warn(`[export-user-data] ${table} query failed:`, error.message)
    return []
  }
  return data ?? []
}

export async function exportUserData(userId: string) {
  const supabase = createServiceRoleClient()
  if (!supabase) {
    throw new Error("Service role client is not configured.")
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle()

  if (profileError) {
    throw new Error(profileError.message)
  }

  const [
    generations,
    uploads,
    assets,
    chatThreads,
    canvases,
    workflows,
    brandKits,
    editorProjects,
    automations,
    templates,
    savedExamples,
    skills,
    subscriptions,
    customers,
    creditPurchases,
    feedback,
    affiliates,
    affiliateReferrals,
    slideshowProjects,
    slideshowTemplates,
    slideshowCollections,
    autopostJobs,
    fanvueMediaCache,
    socialConnections,
    instagramConnections,
  ] = await Promise.all([
    selectAll("generations", "user_id", userId),
    selectAll("uploads", "user_id", userId),
    selectAll("assets", "user_id", userId),
    selectAll("chat_threads", "user_id", userId),
    selectAll("canvases", "user_id", userId),
    selectAll("workflows", "user_id", userId),
    selectAll("brand_kits", "user_id", userId),
    selectAll("editor_projects", "user_id", userId),
    selectAll("automations", "user_id", userId),
    selectAll("templates", "creator_id", userId),
    selectAll("saved_examples", "creator_id", userId),
    selectAll("skills", "user_id", userId),
    selectAll("subscriptions", "user_id", userId),
    selectAll("customers", "user_id", userId),
    selectAll("credit_purchases", "user_id", userId),
    selectAll("feedback", "user_id", userId),
    selectAll("affiliates", "user_id", userId),
    selectAll("affiliate_referrals", "referred_user_id", userId),
    selectAll("slideshow_projects", "user_id", userId),
    selectAll("slideshow_templates", "user_id", userId),
    selectAll("slideshow_collections", "user_id", userId),
    selectAll("autopost_jobs", "user_id", userId),
    selectAll("fanvue_media_cache", "user_id", userId),
    selectAll("social_connections", "user_id", userId),
    selectAll("instagram_connections", "user_id", userId),
  ])

  const threadIds = (chatThreads as Array<{ id?: string }>)
    .map((thread) => thread.id)
    .filter((id): id is string => typeof id === "string")

  let chatMessages: unknown[] = []
  if (threadIds.length > 0) {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .in("thread_id", threadIds)
    if (error) {
      console.warn("[export-user-data] chat_messages query failed:", error.message)
    } else {
      chatMessages = data ?? []
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    userId,
    profile,
    generations,
    uploads,
    assets,
    chatThreads,
    chatMessages,
    canvases,
    workflows,
    brandKits,
    editorProjects,
    automations,
    templates,
    savedExamples,
    skills,
    subscriptions,
    customers,
    creditPurchases,
    feedback,
    affiliates,
    affiliateReferrals,
    slideshowProjects,
    slideshowTemplates,
    slideshowCollections,
    autopostJobs,
    fanvueMediaCache,
    socialConnections: (socialConnections as Array<Record<string, unknown>>).map(sanitizeConnection),
    instagramConnections: (instagramConnections as Array<Record<string, unknown>>).map(sanitizeConnection),
  }
}
