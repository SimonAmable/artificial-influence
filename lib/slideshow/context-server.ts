import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { brandKitFromRow } from "@/lib/brand-kit/database-server"
import type { BrandKit } from "@/lib/brand-kit/types"
import { parseSocialMetadata, readStringMetadata } from "@/lib/social-connections"
import type { SlideshowProvider } from "@/lib/slideshow/types"

export type SlideshowSocialConnectionContext = {
  id: string
  provider: SlideshowProvider
  username: string | null
  displayName: string | null
  metadata: unknown
  instagramConnectionId: string | null
}

export async function loadOwnedSlideshowSocialConnection(
  supabase: SupabaseClient,
  userId: string,
  socialConnectionId: string,
): Promise<SlideshowSocialConnectionContext> {
  const { data, error } = await supabase
    .from("social_connections")
    .select("id, provider, username, display_name, metadata")
    .eq("id", socialConnectionId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load social connection: ${error.message}`)
  }

  if (!data?.id || (data.provider !== "instagram" && data.provider !== "tiktok")) {
    throw new Error("Social connection not found.")
  }

  const metadata = parseSocialMetadata(data.metadata)

  return {
    id: String(data.id),
    provider: data.provider,
    username: typeof data.username === "string" ? data.username : null,
    displayName: typeof data.display_name === "string" ? data.display_name : null,
    metadata,
    instagramConnectionId: readStringMetadata(metadata, "instagram_connection_id"),
  }
}

export async function loadOwnedSlideshowBrandKit(
  supabase: SupabaseClient,
  userId: string,
  brandKitId: string,
): Promise<BrandKit> {
  const { data, error } = await supabase
    .from("brand_kits")
    .select("*")
    .eq("id", brandKitId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load brand kit: ${error.message}`)
  }

  if (!data) {
    throw new Error("Brand kit not found.")
  }

  return brandKitFromRow(data as Record<string, unknown>)
}
