import { createClient } from "@/lib/supabase/server"

import type { BrandKit, BrandReferenceMediaItem } from "./types"

import { formatBrandKitForPrompt, isBrandKitEffectivelyEmpty } from "./format-for-prompt"

import { parseStringArray } from "./serialize"



function buildReferenceMedia(images: string[], videos: string[]): BrandReferenceMediaItem[] {

  return [

    ...images.map((url) => ({ url, kind: "image" as const })),

    ...videos.map((url) => ({ url, kind: "video" as const })),

  ]

}



/** Map a Supabase `brand_kits` row to `BrandKit` (shared by API routes and server helpers). */

export function brandKitFromRow(row: Record<string, unknown>): BrandKit {

  const colorsRaw = row.colors

  const typoRaw = row.typography



  const referenceImages = parseStringArray(row.reference_images)

  const referenceVideos = parseStringArray(row.reference_videos)

  const referenceMedia = buildReferenceMedia(referenceImages, referenceVideos)



  const brandValues = parseStringArray(row.brand_values)

  const aestheticTags = parseStringArray(row.aesthetic_tags)

  const toneTags = parseStringArray(row.tone_tags)



  const notesRaw = row.notes

  const notes =

    notesRaw != null && String(notesRaw).trim() ? String(notesRaw).trim() : null



  return {

    id: String(row.id),

    name: String(row.name || "My brand"),

    isDefault: Boolean(row.is_default),

    websiteUrl: row.website_url != null ? String(row.website_url) : null,

    fontFamily: row.font_family != null ? String(row.font_family) : null,

    referenceImages,

    referenceVideos,

    referenceMedia,

    brandValues,

    aestheticTags,

    toneTags,

    notes,

    logoUrl: (row.logo_url as string | null) ?? null,

    logoDarkUrl: (row.logo_dark_url as string | null) ?? null,

    iconUrl: (row.icon_url as string | null) ?? null,

    iconDarkUrl: (row.icon_dark_url as string | null) ?? null,

    colors: Array.isArray(colorsRaw) ? (colorsRaw as BrandKit["colors"]) : [],

    typography:

      typoRaw && typeof typoRaw === "object" && !Array.isArray(typoRaw)

        ? (typoRaw as BrandKit["typography"])

        : {},

    tagline: (row.tagline as string | null) ?? null,

    avoidWords: parseStringArray(row.avoid_words),

    layoutNotes: (row.layout_notes as string | null) ?? null,

    audience: (row.audience as string | null) ?? null,

    createdAt: String(row.created_at),

    updatedAt: String(row.updated_at),

  }

}



/**

 * Default kit: explicit `is_default`, else most recently updated.

 */

export async function getDefaultBrandKitForUser(userId: string): Promise<BrandKit | null> {

  const supabase = await createClient()



  const { data: marked, error: e1 } = await supabase

    .from("brand_kits")

    .select("*")

    .eq("user_id", userId)

    .eq("is_default", true)

    .maybeSingle()



  if (e1) {

    if (e1.message?.includes("does not exist") || e1.code === "42P01") {

      return null

    }

    console.warn("[brand_kits] get default (marked):", e1.message)

  }



  if (marked) {

    return brandKitFromRow(marked as Record<string, unknown>)

  }



  const { data: latest, error: e2 } = await supabase

    .from("brand_kits")

    .select("*")

    .eq("user_id", userId)

    .order("updated_at", { ascending: false })

    .limit(1)

    .maybeSingle()



  if (e2) {

    if (e2.message?.includes("does not exist") || e2.code === "42P01") {

      return null

    }

    console.warn("[brand_kits] get default (latest):", e2.message)

    return null

  }



  if (!latest) return null

  return brandKitFromRow(latest as Record<string, unknown>)

}



export async function getBrandKitPromptFragmentForUser(userId: string): Promise<string | null> {

  const kit = await getDefaultBrandKitForUser(userId)

  if (!kit || isBrandKitEffectivelyEmpty(kit)) return null

  return formatBrandKitForPrompt(kit)

}

