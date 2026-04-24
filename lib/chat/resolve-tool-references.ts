import type { SupabaseClient } from "@supabase/supabase-js"
import { parseMediaId } from "@/lib/chat/media-id"
import { resolveMediaRef } from "@/lib/chat/resolve-media-ref"
import type {
  AvailableChatImageReference,
  ChatImageReference,
} from "@/lib/chat/tools/image-reference-types"

const TRANSCRIPT_REF_RE = /^ref_\d+$/

function mergeIdLists(primary: string[] | undefined, secondary: string[] | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of [...(primary ?? []), ...(secondary ?? [])]) {
    const t = id.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

export type ResolveToolImageReferencesResult = {
  references: ChatImageReference[]
  warnings: string[]
}

/**
 * Resolve image reference ids for generation tools: transcript `ref_N`, `upl_`/`gen_`/raw UUID via DB.
 */
export async function resolveToolImageReferences({
  supabase,
  userId,
  threadId,
  referenceIds,
  mediaIds,
  availableReferenceMap,
  allowCrossThread = true,
}: {
  supabase: SupabaseClient
  userId: string
  threadId: string | undefined
  mediaIds?: string[]
  referenceIds?: string[]
  availableReferenceMap: Map<string, AvailableChatImageReference>
  allowCrossThread?: boolean
}): Promise<ResolveToolImageReferencesResult> {
  const ids = mergeIdLists(referenceIds, mediaIds)
  if (ids.length === 0) {
    return { references: [], warnings: [] }
  }

  const references: ChatImageReference[] = []
  const warnings: string[] = []

  for (const rawId of ids) {
    if (TRANSCRIPT_REF_RE.test(rawId)) {
      const reference = availableReferenceMap.get(rawId)
      if (!reference) {
        throw new Error(
          `Reference id "${rawId}" is not in this conversation's transcript refs (ref_1, ref_2, …). Use listThreadMedia for thread media ids, or pass upl_/gen_ prefixed ids or raw UUIDs from listRecentGenerations (mediaId).`,
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
        `Invalid reference id "${rawId}". Expected ref_N, upl_<uuid>, gen_<uuid>, or a raw upload/generation UUID.`,
      )
    }

    try {
      const resolved = await resolveMediaRef(supabase, userId, threadId, rawId, {
        allowCrossThread,
      })
      if (!resolved.mimeType.startsWith("image/")) {
        throw new Error(
          `Media ${rawId} is not an image (${resolved.mimeType}). Use listThreadMedia to pick image rows.`,
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
        `Reference id "${rawId}" could not be resolved (${detail}). Try listThreadMedia for this thread, or use mediaId (gen_<uuid>) from listRecentGenerations.`,
      )
    }
  }

  return { references, warnings }
}
