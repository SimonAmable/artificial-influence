import type { UIMessage } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"

import { brandKitFromRow } from "@/lib/brand-kit/database-server"
import { formatBrandKitForPrompt } from "@/lib/brand-kit/format-for-prompt"
import { getSelectedReferencesFromMessage } from "@/lib/chat/reference-metadata"

function extractDatabaseId(prefixedId: string, prefix: "brand:" | "asset:") {
  if (!prefixedId.startsWith(prefix)) return null
  const value = prefixedId.slice(prefix.length).trim()
  return value || null
}

export async function buildSelectedReferenceContext(
  supabase: SupabaseClient,
  userId: string,
  messages: UIMessage[],
) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")
  const selectedRefs = latestUserMessage ? getSelectedReferencesFromMessage(latestUserMessage) : []

  if (selectedRefs.length === 0) {
    return ""
  }

  const brandIds = selectedRefs
    .filter((ref) => ref.category === "brand")
    .map((ref) => extractDatabaseId(ref.id, "brand:"))
    .filter((value): value is string => Boolean(value))

  const assetIds = selectedRefs
    .filter((ref) => ref.category === "asset")
    .map((ref) => extractDatabaseId(ref.id, "asset:"))
    .filter((value): value is string => Boolean(value))

  const sections: string[] = []

  if (brandIds.length > 0) {
    const { data: brandRows, error: brandError } = await supabase
      .from("brand_kits")
      .select("*")
      .eq("user_id", userId)
      .in("id", brandIds)

    if (brandError) {
      throw new Error(`Failed to load selected brand kits: ${brandError.message}`)
    }

    const brands = (brandRows ?? []).map((row) => brandKitFromRow(row as Record<string, unknown>))
    if (brands.length > 0) {
      sections.push(
        `User-selected brand context for this turn:\n${brands
          .map((brand) => `---\n${formatBrandKitForPrompt(brand)}`)
          .join("\n")}`,
      )
    }
  }

  if (assetIds.length > 0) {
    const { data: assetRows, error: assetError } = await supabase
      .from("assets")
      .select("id, title, asset_type, category, asset_url")
      .eq("user_id", userId)
      .in("id", assetIds)

    if (assetError) {
      throw new Error(`Failed to load selected assets: ${assetError.message}`)
    }

    if ((assetRows ?? []).length > 0) {
      sections.push(
        `User-selected asset references for this turn:\n${(assetRows ?? [])
          .map((row) => {
            const asset = row as {
              asset_type: string
              asset_url: string
              category: string
              title: string
            }
            return `- ${asset.title} (${asset.asset_type}, ${asset.category}): ${asset.asset_url}`
          })
          .join("\n")}`,
      )
    }
  }

  return sections.join("\n\n").trim()
}
