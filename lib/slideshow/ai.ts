import "server-only"

import { createHash } from "crypto"
import { generateObject } from "ai"
import { z } from "zod"
import { createAIGatewayProvider } from "@/lib/ai/gateway"
import { formatBrandKitForPrompt } from "@/lib/brand-kit/format-for-prompt"
import type { BrandKit } from "@/lib/brand-kit/types"
import { parseSavedProfileFromMetadata } from "@/lib/instagram/profile"
import type {
  SlideshowCollection,
  SlideshowHookOption,
  SlideshowSlide,
} from "@/lib/slideshow/types"
import { parseSocialMetadata, readStringMetadata } from "@/lib/social-connections"
import { parseTikTokSavedProfile } from "@/lib/tiktok/profile"

const HOOK_MODEL = "google/gemini-2.5-flash"
const SLIDE_MODEL = "google/gemini-2.5-flash"

type SocialConnectionPromptContext = {
  id: string
  provider: "instagram" | "tiktok"
  username: string | null
  displayName: string | null
  metadata: unknown
}

const hookGenerationSchema = z.object({
  hooks: z.array(z.string().trim().min(1).max(180)).length(10),
})

const slideGenerationSchema = z.object({
  slides: z
    .array(
      z.object({
        overlayText: z.string().trim().min(1).max(220),
        narrativeRole: z.string().trim().min(1).max(120),
        preferredCollectionId: z.string().uuid(),
      }),
    )
    .min(4)
    .max(8),
})

function compactLines(parts: Array<string | null | undefined>) {
  return parts.filter((part) => typeof part === "string" && part.trim().length > 0).join("\n")
}

function formatAccountContext(connection: SocialConnectionPromptContext) {
  const metadata = parseSocialMetadata(connection.metadata)
  const accountType = readStringMetadata(metadata, "account_type")
  const instagramProfile =
    connection.provider === "instagram" ? parseSavedProfileFromMetadata(connection.metadata) : null
  const tiktokProfile =
    connection.provider === "tiktok" ? parseTikTokSavedProfile(connection.metadata) : null

  return compactLines([
    `Provider: ${connection.provider}`,
    connection.username ? `Username: ${connection.username}` : null,
    connection.displayName ? `Display name: ${connection.displayName}` : null,
    accountType ? `Account type: ${accountType}` : null,
    instagramProfile?.name ? `Profile name: ${instagramProfile.name}` : null,
    instagramProfile?.biography ? `Bio: ${instagramProfile.biography}` : null,
    instagramProfile?.website ? `Website: ${instagramProfile.website}` : null,
    typeof instagramProfile?.followers_count === "number"
      ? `Followers: ${instagramProfile.followers_count}`
      : null,
    typeof instagramProfile?.media_count === "number" ? `Media count: ${instagramProfile.media_count}` : null,
    tiktokProfile?.display_name ? `Profile name: ${tiktokProfile.display_name}` : null,
    tiktokProfile?.avatar_url ? `Avatar URL: ${tiktokProfile.avatar_url}` : null,
  ])
}

function buildHookPrompt(input: {
  connection: SocialConnectionPromptContext
  brandKit: BrandKit
}) {
  return [
    "You are generating hook overlay ideas for an AI-first social slideshow builder.",
    "Return exactly 10 hook options.",
    "Each hook must be a short overlay-ready line for a social slideshow opener.",
    "Avoid markdown, numbering, hashtags, explanations, or quote marks.",
    "Keep every hook under 14 words.",
    "Make the hooks native-to-feed, punchy, and varied in angle.",
    "Favor conversational lowercase unless emphasis clearly helps.",
    "Do not invent analytics, offers, or claims that are not supported by the brand context.",
    "",
    "Connected account context:",
    formatAccountContext(input.connection),
    "",
    "Brand kit context:",
    formatBrandKitForPrompt(input.brandKit),
  ].join("\n")
}

function summarizeCollections(collections: SlideshowCollection[]) {
  return collections
    .filter((collection) => collection.items.length > 0)
    .map((collection) => {
      const sampleTitles = collection.items
        .slice(0, 5)
        .map((item) => item.title)
        .filter((title) => title.trim().length > 0)
      const sampleTags = Array.from(
        new Set(
          collection.items
            .flatMap((item) => item.tags)
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ).slice(0, 8)

      return compactLines([
        `Collection ID: ${collection.id}`,
        `Name: ${collection.name}`,
        collection.description ? `Description: ${collection.description}` : null,
        `Image count: ${collection.items.length}`,
        sampleTitles.length > 0 ? `Sample image titles: ${sampleTitles.join(", ")}` : null,
        sampleTags.length > 0 ? `Sample tags: ${sampleTags.join(", ")}` : null,
      ])
    })
    .join("\n\n")
}

function buildSlidePrompt(input: {
  hook: string
  connection: SocialConnectionPromptContext
  brandKit: BrandKit
  collections: SlideshowCollection[]
}) {
  return [
    "You are planning an AI-generated image slideshow for short-form social posting.",
    "Return 4 to 8 slides.",
    "For every slide, choose exactly one preferredCollectionId from the provided collection ids.",
    "overlayText should feel like short on-screen copy, not full captions.",
    "Make the first slide deliver or sharpen the selected hook.",
    "The sequence should build a coherent narrative arc and end with a strong payoff or takeaway.",
    "Do not mention collection ids in overlayText.",
    "Do not output markdown or explanations.",
    "",
    `Selected hook: ${input.hook}`,
    "",
    "Connected account context:",
    formatAccountContext(input.connection),
    "",
    "Brand kit context:",
    formatBrandKitForPrompt(input.brandKit),
    "",
    "Available image collections:",
    summarizeCollections(input.collections),
  ].join("\n")
}

function slugFragment(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 24) || "hook"
  )
}

function buildHookId(text: string, index: number) {
  return `${index + 1}-${slugFragment(text)}`
}

function stableIndex(seed: string, length: number) {
  if (length <= 1) return 0
  const digest = createHash("sha1").update(seed).digest()
  return digest.readUInt32BE(0) % length
}

export async function generateSlideshowHooks(input: {
  connection: SocialConnectionPromptContext
  brandKit: BrandKit
}): Promise<SlideshowHookOption[]> {
  const gateway = createAIGatewayProvider()
  const { object } = await generateObject({
    model: gateway(HOOK_MODEL),
    schema: hookGenerationSchema,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: buildHookPrompt(input) }],
      },
    ],
  })

  return object.hooks.map((text, index) => ({
    id: buildHookId(text, index),
    text: text.trim(),
  }))
}

export async function generateSlideshowSlides(input: {
  projectId: string
  hook: string
  connection: SocialConnectionPromptContext
  brandKit: BrandKit
  collections: SlideshowCollection[]
}): Promise<SlideshowSlide[]> {
  const usableCollections = input.collections.filter((collection) => collection.items.length > 0)
  if (usableCollections.length === 0) {
    throw new Error("Add at least one image collection with images before generating slides.")
  }

  const gateway = createAIGatewayProvider()
  const { object } = await generateObject({
    model: gateway(SLIDE_MODEL),
    schema: slideGenerationSchema,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: buildSlidePrompt({ ...input, collections: usableCollections }) }],
      },
    ],
  })

  const usableCollectionsById = new Map(usableCollections.map((collection) => [collection.id, collection]))
  const fallbackCollection = usableCollections[0]
  const usedImageIdsByCollection = new Map<string, Set<string>>()

  return object.slides.map((slide, index) => {
    const collection = usableCollectionsById.get(slide.preferredCollectionId) ?? fallbackCollection
    const usedIds = usedImageIdsByCollection.get(collection.id) ?? new Set<string>()
    usedImageIdsByCollection.set(collection.id, usedIds)

    const rotationIndex = stableIndex(
      `${input.projectId}:${input.hook}:${collection.id}:${index}`,
      collection.items.length,
    )
    const rotatedItems = [
      ...collection.items.slice(rotationIndex),
      ...collection.items.slice(0, rotationIndex),
    ]

    const unusedPick = rotatedItems.find((item) => !usedIds.has(item.id))
    const chosenItem = unusedPick ?? collection.items[0]
    const selectionMode = unusedPick ? "random" : "first"
    usedIds.add(chosenItem.id)

    return {
      index,
      overlayText: slide.overlayText.trim(),
      collectionId: collection.id,
      collectionImageId: chosenItem.id,
      assetUrl: chosenItem.url,
      selectionMode,
      narrativeRole: slide.narrativeRole.trim(),
      notes: null,
    } satisfies SlideshowSlide
  })
}
