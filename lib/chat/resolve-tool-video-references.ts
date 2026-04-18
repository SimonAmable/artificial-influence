import type { SupabaseClient } from "@supabase/supabase-js"
import { parseMediaId } from "@/lib/chat/media-id"
import { resolveMediaRef } from "@/lib/chat/resolve-media-ref"
import type { AvailableChatVideoReference, ChatVideoReference } from "@/lib/chat/tools/generate-video"

const TRANSCRIPT_VIDEO_REF_RE = /^refv_\d+$/

export type ResolveToolVideoReferencesResult = {
  references: ChatVideoReference[]
  warnings: string[]
}

/**
 * Resolve video reference ids: transcript `refv_N`, or `upl_`/`gen_`/raw UUID via DB.
 */
export async function resolveToolVideoReferences({
  supabase,
  userId,
  threadId,
  referenceIds,
  availableReferenceMap,
  allowCrossThread = true,
}: {
  supabase: SupabaseClient
  userId: string
  threadId: string | undefined
  referenceIds?: string[]
  availableReferenceMap: Map<string, AvailableChatVideoReference>
  allowCrossThread?: boolean
}): Promise<ResolveToolVideoReferencesResult> {
  const ids = (referenceIds ?? []).map((id) => id.trim()).filter(Boolean)
  if (ids.length === 0) {
    return { references: [], warnings: [] }
  }

  const references: ChatVideoReference[] = []
  const warnings: string[] = []

  for (const rawId of ids) {
    if (TRANSCRIPT_VIDEO_REF_RE.test(rawId)) {
      const reference = availableReferenceMap.get(rawId)
      if (!reference) {
        throw new Error(
          `Video reference id "${rawId}" is not in this conversation's transcript video refs (refv_1, refv_2, …). Use listThreadMedia for thread media ids, or pass upl_/gen_ prefixed ids.`,
        )
      }
      references.push({
        url: reference.url,
        mediaType: reference.mediaType,
        filename: reference.filename,
      })
      continue
    }

    let parsed: ReturnType<typeof parseMediaId>
    try {
      parsed = parseMediaId(rawId)
    } catch {
      throw new Error(
        `Invalid video reference id "${rawId}". Expected refv_N, upl_<uuid>, gen_<uuid>, or a raw upload/generation UUID.`,
      )
    }

    try {
      const resolved = await resolveMediaRef(supabase, userId, threadId, rawId, {
        allowCrossThread,
      })
      if (!resolved.mimeType.startsWith("video/")) {
        throw new Error(
          `Media ${rawId} is not a video (${resolved.mimeType}). Use listThreadMedia to pick video rows, or refv_N from the transcript manifest.`,
        )
      }
      if (resolved.crossThread) {
        warnings.push(
          `Resolved ${parsed.namespace === "legacy" ? rawId : resolved.id} from another chat thread (same account).`,
        )
      }
      references.push({
        url: resolved.publicUrl,
        mediaType: resolved.mimeType,
        filename: resolved.label ?? undefined,
      })
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      throw new Error(
        `Video reference id "${rawId}" could not be resolved (${detail}). Try listThreadMedia for this thread, or use mediaId (gen_<uuid>) from listRecentGenerations.`,
      )
    }
  }

  return { references, warnings }
}
