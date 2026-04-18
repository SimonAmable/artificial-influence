import type { SupabaseClient } from "@supabase/supabase-js"
import { parseMediaId } from "@/lib/chat/media-id"
import { resolveMediaRef } from "@/lib/chat/resolve-media-ref"
import type { AvailableChatAudioReference, ChatAudioReference } from "@/lib/chat/tools/generate-video"

const TRANSCRIPT_AUDIO_REF_RE = /^refa_\d+$/

export type ResolveToolAudioReferencesResult = {
  references: ChatAudioReference[]
  warnings: string[]
}

/**
 * Resolve audio reference ids: transcript `refa_N`, or `upl_`/`gen_`/raw UUID via DB.
 */
export async function resolveToolAudioReferences({
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
  availableReferenceMap: Map<string, AvailableChatAudioReference>
  allowCrossThread?: boolean
}): Promise<ResolveToolAudioReferencesResult> {
  const ids = (referenceIds ?? []).map((id) => id.trim()).filter(Boolean)
  if (ids.length === 0) {
    return { references: [], warnings: [] }
  }

  const references: ChatAudioReference[] = []
  const warnings: string[] = []

  for (const rawId of ids) {
    if (TRANSCRIPT_AUDIO_REF_RE.test(rawId)) {
      const reference = availableReferenceMap.get(rawId)
      if (!reference) {
        throw new Error(
          `Audio reference id "${rawId}" is not in this conversation's transcript audio refs (refa_1, refa_2, …). Use listThreadMedia for thread media ids, or pass upl_/gen_ prefixed ids.`,
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
        `Invalid audio reference id "${rawId}". Expected refa_N, upl_<uuid>, gen_<uuid>, or a raw upload/generation UUID.`,
      )
    }

    try {
      const resolved = await resolveMediaRef(supabase, userId, threadId, rawId, {
        allowCrossThread,
      })
      if (!resolved.mimeType.startsWith("audio/")) {
        throw new Error(
          `Media ${rawId} is not audio (${resolved.mimeType}). Use listThreadMedia to pick audio rows, or refa_N from the transcript manifest.`,
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
        `Audio reference id "${rawId}" could not be resolved (${detail}). Try listThreadMedia for this thread, or use mediaId (gen_<uuid>) from listRecentGenerations.`,
      )
    }
  }

  return { references, warnings }
}
