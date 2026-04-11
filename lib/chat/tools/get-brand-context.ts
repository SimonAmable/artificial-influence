import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { brandKitFromRow } from "@/lib/brand-kit/database-server"
import {
  formatBrandKitForPrompt,
  isBrandKitEffectivelyEmpty,
} from "@/lib/brand-kit/format-for-prompt"
import type { BrandKit } from "@/lib/brand-kit/types"

interface CreateGetBrandContextToolOptions {
  supabase: SupabaseClient
  userId: string
}

function normalizeBrandText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function getWebsiteHost(value: string | null | undefined) {
  if (!value) return ""

  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return normalizeBrandText(value).replace(/\s+/g, "")
  }
}

function getBrandCandidateNames(kit: BrandKit) {
  const candidates = new Set<string>()
  const normalizedName = normalizeBrandText(kit.name)
  const websiteHost = getWebsiteHost(kit.websiteUrl)

  if (normalizedName) {
    candidates.add(normalizedName)
  }

  if (websiteHost) {
    candidates.add(websiteHost)
    const root = websiteHost.split(".")[0]
    if (root) {
      candidates.add(normalizeBrandText(root))
    }
  }

  return [...candidates]
}

function scoreBrandKitMatch(kit: BrandKit, brandHint: string) {
  const hint = normalizeBrandText(brandHint)
  if (!hint) return 0

  const compactHint = hint.replace(/\s+/g, "")
  let score = 0

  for (const candidate of getBrandCandidateNames(kit)) {
    const compactCandidate = candidate.replace(/\s+/g, "")

    if (candidate === hint || compactCandidate === compactHint) {
      return 100
    }

    if (candidate.includes(hint) || hint.includes(candidate)) {
      score = Math.max(score, 85)
    }

    const hintTokens = new Set(hint.split(" ").filter(Boolean))
    const candidateTokens = candidate.split(" ").filter(Boolean)
    const overlap = candidateTokens.filter((token) => hintTokens.has(token)).length

    if (overlap > 0) {
      score = Math.max(score, 45 + overlap * 15)
    }
  }

  return score
}

function summarizeBrandKit(kit: BrandKit) {
  const typography = kit.typography ?? {}

  return {
    aestheticTags: kit.aestheticTags,
    avoidWords: kit.avoidWords,
    brandValues: kit.brandValues,
    colorCount: kit.colors.length,
    referenceCount: kit.referenceMedia.length,
    toneTags: kit.toneTags,
    typography: {
      bodyFont: typography.bodyFont ?? null,
      headingFont: typography.headingFont ?? null,
      monoFont: typography.monoFont ?? null,
    },
  }
}

function serializeBrandChoice(kit: BrandKit) {
  return {
    id: kit.id,
    iconUrl: kit.iconUrl ?? kit.iconDarkUrl ?? kit.logoUrl ?? kit.logoDarkUrl ?? null,
    isDefault: kit.isDefault,
    name: kit.name,
    websiteUrl: kit.websiteUrl,
  }
}

async function loadUserBrandKits(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("brand_kits")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to load brand kits: ${error.message}`)
  }

  return (data ?? []).map((row) => brandKitFromRow(row as Record<string, unknown>))
}

export function createGetBrandContextTool({
  supabase,
  userId,
}: CreateGetBrandContextToolOptions) {
  return tool({
    description:
      "Fetch saved brand kit context for the current user. Use this when the user asks to make something on-brand, use a saved brand, follow brand voice/palette/logo rules, or compare brand kits. If the user has multiple brands and the intended one is not obvious, pass no brandName or the best guess and then ask a short clarifying question if the tool returns needs-clarification.",
    inputSchema: z.object({
      brandName: z
        .string()
        .min(1)
        .max(120)
        .optional()
        .describe("Optional saved brand kit name or website/domain hint, such as Acme, acme.com, or the user's explicit brand name."),
    }),
    strict: true,
    execute: async ({ brandName }) => {
      const kits = await loadUserBrandKits(supabase, userId)

      if (kits.length === 0) {
        return {
          status: "no-brand-kits" as const,
          message: "No saved brand kits were found for this user.",
        }
      }

      if (!brandName?.trim()) {
        if (kits.length === 1) {
          const onlyKit = kits[0]

          if (isBrandKitEffectivelyEmpty(onlyKit)) {
            return {
              status: "empty-brand-kit" as const,
              brand: serializeBrandChoice(onlyKit),
              message: `The only saved brand kit, ${onlyKit.name}, is still mostly empty.`,
            }
          }

          return {
            status: "resolved" as const,
            brand: serializeBrandChoice(onlyKit),
            message: `Loaded brand context for ${onlyKit.name}.`,
            promptFragment: formatBrandKitForPrompt(onlyKit),
            summary: summarizeBrandKit(onlyKit),
          }
        }

        return {
          status: "needs-clarification" as const,
          availableBrands: kits.map(serializeBrandChoice),
          defaultBrand:
            kits.find((kit) => kit.isDefault)?.name ?? null,
          message:
            "Multiple saved brand kits are available, so the user should specify which brand to use.",
        }
      }

      const scoredMatches = kits
        .map((kit) => ({
          kit,
          score: scoreBrandKitMatch(kit, brandName),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)

      if (scoredMatches.length === 0) {
        return {
          status: "no-match" as const,
          availableBrands: kits.map(serializeBrandChoice),
          message: `No saved brand kit matched "${brandName}".`,
        }
      }

      const best = scoredMatches[0]
      const secondBest = scoredMatches[1]
      const isAmbiguous =
        secondBest != null &&
        best.score < 100 &&
        best.score - secondBest.score < 15

      if (isAmbiguous) {
        return {
          status: "needs-clarification" as const,
          availableBrands: scoredMatches.slice(0, 4).map(({ kit }) => serializeBrandChoice(kit)),
          defaultBrand:
            kits.find((kit) => kit.isDefault)?.name ?? null,
          message: `More than one saved brand kit could match "${brandName}".`,
        }
      }

      if (isBrandKitEffectivelyEmpty(best.kit)) {
        return {
          status: "empty-brand-kit" as const,
          brand: serializeBrandChoice(best.kit),
          message: `The saved brand kit "${best.kit.name}" exists but is still mostly empty.`,
        }
      }

      return {
        status: "resolved" as const,
        brand: serializeBrandChoice(best.kit),
        message: `Loaded brand context for ${best.kit.name}.`,
        promptFragment: formatBrandKitForPrompt(best.kit),
        summary: summarizeBrandKit(best.kit),
      }
    },
  })
}
