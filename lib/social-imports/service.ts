import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { enrichManifestWithDurations } from "./inspect-enrich"
import { inspectSocialUrl, resolveSocialImportAdapter } from "./registry"
import type { SocialImportManifest } from "./types"
import { SOCIAL_MEDIA_IMPORTS_TABLE } from "./types"

export function manifestIsExpired(manifest: SocialImportManifest): boolean {
  return Date.parse(manifest.expiresAt) <= Date.now()
}

export async function createViralInspectImport(input: {
  supabase: SupabaseClient
  userId: string
  sourceUrl: string
}): Promise<{ importId: string; manifest: SocialImportManifest }> {
  const { adapter } = resolveSocialImportAdapter(input.sourceUrl)
  const manifest = await enrichManifestWithDurations(await inspectSocialUrl(input.sourceUrl))

  const { data, error } = await input.supabase
    .from(SOCIAL_MEDIA_IMPORTS_TABLE)
    .insert({
      user_id: input.userId,
      status: "inspected",
      source_url: input.sourceUrl,
      source_platform: adapter.platform,
      import_purpose: "viral_inspect",
      manifest,
      expires_at: manifest.expiresAt,
      source_snapshot: null,
    })
    .select("id")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save inspection.")
  }

  return { importId: data.id, manifest }
}

export async function getOwnedImportManifest(input: {
  supabase: SupabaseClient
  userId: string
  importId: string
}): Promise<{ manifest: SocialImportManifest; row: Record<string, unknown> }> {
  const { data, error } = await input.supabase
    .from(SOCIAL_MEDIA_IMPORTS_TABLE)
    .select("*")
    .eq("id", input.importId)
    .eq("user_id", input.userId)
    .maybeSingle()

  if (error || !data) {
    throw new Error("Import not found.")
  }

  const manifest = data.manifest as SocialImportManifest | null
  if (!manifest?.media?.length) {
    throw new Error("This inspection expired or has no media. Inspect again.")
  }
  if (manifestIsExpired(manifest)) {
    throw new Error("This inspection expired. Paste the URL again.")
  }

  return { manifest, row: data as Record<string, unknown> }
}

export async function markImportDownloading(serviceSupabase: SupabaseClient, importId: string) {
  await serviceSupabase
    .from(SOCIAL_MEDIA_IMPORTS_TABLE)
    .update({ status: "downloading", started_at: new Date().toISOString() })
    .eq("id", importId)
}

export async function markImportReady(
  serviceSupabase: SupabaseClient,
  importId: string,
  patch: Record<string, unknown>,
) {
  await serviceSupabase
    .from(SOCIAL_MEDIA_IMPORTS_TABLE)
    .update({
      ...patch,
      status: "ready",
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", importId)
}

export async function markImportFailed(serviceSupabase: SupabaseClient, importId: string, message: string) {
  await serviceSupabase
    .from(SOCIAL_MEDIA_IMPORTS_TABLE)
    .update({
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString(),
    })
    .eq("id", importId)
}