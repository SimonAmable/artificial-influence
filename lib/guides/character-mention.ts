import type { AttachedRef } from "@/lib/commands/types"
import { makeMentionToken } from "@/lib/commands/mention-token"

export type DashboardCharacterItem = {
  /** AI influencer generation id (stable for strip selection). */
  id: string
  url: string
  prompt: string | null
  displayName?: string | null
  /** Library character asset id when one is linked. */
  assetId?: string | null
}

export function getCharacterDisplayName(item: DashboardCharacterItem): string {
  const explicitName = item.displayName?.trim()
  if (explicitName) return explicitName

  const prompt = item.prompt?.trim()
  if (!prompt) return "Saved Character"

  try {
    const parsed = JSON.parse(prompt) as Record<string, unknown>
    for (const key of [
      "displayName",
      "displayname",
      "character_name",
      "title",
      "name",
      "subject",
      "main_subject",
    ]) {
      const value = parsed[key]
      if (typeof value === "string" && value.trim()) return value.trim()
    }
  } catch {
    // Fall through to prompt heuristics.
  }

  const namedMatch = prompt.match(/named\s+([^.,]+?)(?:\.|,|$)/i)
  if (namedMatch?.[1]) return namedMatch[1].trim()

  if (prompt.length <= 24) return prompt

  return prompt.split(".")[0]?.trim() || "Saved Character"
}

export function characterReferenceId(item: DashboardCharacterItem): string {
  if (item.assetId?.trim()) return `asset:${item.assetId.trim()}`
  return `generation:${item.id}`
}

function newChipId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Fetch the same character set the dashboard Characters strip uses. */
export async function fetchDashboardCharacters(): Promise<DashboardCharacterItem[]> {
  const [generationsResponse, assetsResponse] = await Promise.all([
    fetch(`/api/generations?tool=ai_influencer&limit=30`),
    fetch(`/api/assets?category=character&limit=100`),
  ])
  if (!generationsResponse.ok) throw new Error("Failed to fetch characters")
  if (!assetsResponse.ok) throw new Error("Failed to fetch character assets")

  const [generationData, assetData] = await Promise.all([
    generationsResponse.json(),
    assetsResponse.json(),
  ])

  const characterAssets = Array.isArray(assetData.assets)
    ? (assetData.assets as Array<{
        id?: string
        title?: string
        sourceGenerationId?: string | null
        url?: string
      }>)
    : []

  const assetByGenerationId = new Map<
    string,
    { id: string; title: string | null }
  >()
  const assetByUrl = new Map<string, { id: string; title: string | null }>()

  for (const asset of characterAssets) {
    const assetId = typeof asset.id === "string" ? asset.id : null
    if (!assetId) continue
    const title = typeof asset.title === "string" ? asset.title : null
    const meta = { id: assetId, title }
    if (
      typeof asset.sourceGenerationId === "string" &&
      asset.sourceGenerationId.trim().length > 0
    ) {
      assetByGenerationId.set(asset.sourceGenerationId, meta)
    }
    if (typeof asset.url === "string" && asset.url.trim().length > 0) {
      assetByUrl.set(asset.url, meta)
    }
  }

  return (generationData.generations || [])
    .map(
      (gen: { id: string; url: string; prompt: string | null }) => {
        const linked =
          assetByGenerationId.get(gen.id) || assetByUrl.get(gen.url) || null
        return {
          id: gen.id,
          url: gen.url,
          prompt: gen.prompt,
          displayName: linked?.title || null,
          assetId: linked?.id || null,
        } satisfies DashboardCharacterItem
      }
    )
    .filter(
      (item: DashboardCharacterItem) =>
        typeof item.url === "string" && item.url.length > 0
    )
}

/**
 * Swap the active character @-ref into the prompt + attached refs.
 * Keeps non-character refs; replaces any prior strip character ref.
 */
export function applyCharacterMention(input: {
  character: DashboardCharacterItem
  promptValue: string
  attachedRefs: AttachedRef[]
  previousCharacterRefId: string | null
}): { promptValue: string; attachedRefs: AttachedRef[]; characterRefId: string } {
  const label = getCharacterDisplayName(input.character)
  const characterRefId = characterReferenceId(input.character)
  const chipId = newChipId()

  const base: AttachedRef = {
    id: characterRefId,
    label,
    category: "asset",
    assetType: "image",
    assetUrl: input.character.url,
    previewUrl: input.character.url,
    serialized: `Reference (image) "${label}": ${input.character.url}`,
    chipId,
    mentionToken: "",
  }

  const withoutPrevious = input.attachedRefs.filter((ref) => {
    if (input.previousCharacterRefId && ref.id === input.previousCharacterRefId) {
      return false
    }
    return ref.id !== characterRefId
  })

  const previousToken =
    input.attachedRefs.find((ref) => ref.id === input.previousCharacterRefId)
      ?.mentionToken ?? ""

  let nextPrompt = input.promptValue
  if (previousToken) {
    nextPrompt = nextPrompt.split(previousToken).join(" ").replace(/\s+/g, " ").trim()
  }

  const existing = withoutPrevious.find((ref) => ref.id === characterRefId)
  if (existing?.mentionToken) {
    const token = existing.mentionToken
    if (!nextPrompt.includes(token)) {
      nextPrompt = nextPrompt ? `${token} ${nextPrompt}` : token
    }
    return {
      promptValue: nextPrompt,
      attachedRefs: withoutPrevious,
      characterRefId: existing.id,
    }
  }

  const taken = new Set(
    withoutPrevious.map((ref) => ref.mentionToken).filter(Boolean)
  )
  const mentionToken = makeMentionToken(base, taken)
  const nextRef: AttachedRef = {
    ...base,
    mentionToken,
  }

  nextPrompt = nextPrompt ? `${mentionToken} ${nextPrompt}` : mentionToken

  return {
    promptValue: nextPrompt,
    attachedRefs: [...withoutPrevious, nextRef],
    characterRefId,
  }
}

/** Keep character @tokens when swapping scene tab prompts. */
export function prependCharacterMentions(
  scenePrompt: string,
  attachedRefs: AttachedRef[],
  characterRefId: string | null
): string {
  if (!characterRefId) return scenePrompt
  const token = attachedRefs.find((ref) => ref.id === characterRefId)?.mentionToken
  if (!token) return scenePrompt
  const body = scenePrompt.split(token).join(" ").replace(/\s+/g, " ").trim()
  return body ? `${token} ${body}` : token
}
