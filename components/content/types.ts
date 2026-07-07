import type { AutopostJobMetadata } from "@/lib/autopost/types"

export type ContentJobRow = {
  id: string
  provider?: string | null
  media_url: string
  caption: string | null
  media_type: string
  metadata?: AutopostJobMetadata | null
  status: string
  scheduled_at: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  last_error: string | null
  provider_publish_id: string | null
  social_connection_id?: string | null
  social_display_name?: string | null
  social_username?: string | null
  instagram_connection_id: string | null
  instagram_username: string | null
}

export type FanvueConnectionItem = {
  id: string
  provider: "fanvue"
  providerAccountId: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  status: string
  scopes: string[]
  updatedAt: string
}

export type FanvueMediaItem = {
  uuid: string
  name?: string | null
  filename?: string | null
  mediaType?: string | null
  status?: string | null
  thumbnailUrl?: string | null
  createdAt?: string | null
}

export type FanvueVaultFolder = {
  name: string
  mediaCount?: number | null
}
