import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

import { brandKitFromRow } from "@/lib/brand-kit/database-server"

import {

  parseColorTokens,

  parseReferenceMedia,

  parseStringArray,

  parseTypography,

  splitReferenceMediaToColumns,

} from "@/lib/brand-kit/serialize"



export async function GET() {

  try {

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {

      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    }



    const { data, error } = await supabase

      .from("brand_kits")

      .select("*")

      .eq("user_id", user.id)

      .order("updated_at", { ascending: false })



    if (error) {

      console.error("[brand-kits] GET:", error)

      return NextResponse.json({ error: error.message }, { status: 500 })

    }



    return NextResponse.json({

      kits: (data ?? []).map((r) => brandKitFromRow(r as Record<string, unknown>)),

    })

  } catch (e) {

    console.error("[brand-kits] GET exception:", e)

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })

  }

}



export async function POST(request: NextRequest) {

  try {

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {

      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    }



    const body = await request.json().catch(() => ({}))



    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "My brand"

    const isDefault = Boolean(body.isDefault)



    const { count } = await supabase

      .from("brand_kits")

      .select("*", { count: "exact", head: true })

      .eq("user_id", user.id)



    const forceDefault = (count ?? 0) === 0

    const shouldDefault = isDefault || forceDefault



    if (shouldDefault) {

      await supabase.from("brand_kits").update({ is_default: false }).eq("user_id", user.id)

    }



    const media = parseReferenceMedia(body.referenceMedia)

    const { reference_images, reference_videos } = splitReferenceMediaToColumns(media)



    const insert = {

      user_id: user.id,

      name,

      is_default: shouldDefault,

      website_url:

        typeof body.websiteUrl === "string" && body.websiteUrl.trim() ? body.websiteUrl.trim() : null,

      font_family:

        typeof body.fontFamily === "string" && body.fontFamily.trim() ? body.fontFamily.trim() : null,

      reference_images,

      reference_videos,

      brand_values: parseStringArray(body.brandValues),

      aesthetic_tags: parseStringArray(body.aestheticTags),

      tone_tags: parseStringArray(body.toneTags),

      notes:

        typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,

      logo_url: typeof body.logoUrl === "string" && body.logoUrl.trim() ? body.logoUrl.trim() : null,

      logo_dark_url:

        typeof body.logoDarkUrl === "string" && body.logoDarkUrl.trim() ? body.logoDarkUrl.trim() : null,

      icon_url: typeof body.iconUrl === "string" && body.iconUrl.trim() ? body.iconUrl.trim() : null,

      icon_dark_url:

        typeof body.iconDarkUrl === "string" && body.iconDarkUrl.trim() ? body.iconDarkUrl.trim() : null,

      colors: parseColorTokens(body.colors),

      typography: parseTypography(body.typography),

      tagline: typeof body.tagline === "string" && body.tagline.trim() ? body.tagline.trim() : null,

      avoid_words: parseStringArray(body.avoidWords),

      layout_notes:

        typeof body.layoutNotes === "string" && body.layoutNotes.trim()

          ? body.layoutNotes.trim()

          : null,

      audience: typeof body.audience === "string" && body.audience.trim() ? body.audience.trim() : null,

    }



    const { data, error } = await supabase.from("brand_kits").insert(insert).select("*").single()



    if (error) {

      console.error("[brand-kits] POST:", error)

      return NextResponse.json({ error: error.message }, { status: 500 })

    }



    return NextResponse.json({ kit: brandKitFromRow(data as Record<string, unknown>) })

  } catch (e) {

    console.error("[brand-kits] POST exception:", e)

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })

  }

}

