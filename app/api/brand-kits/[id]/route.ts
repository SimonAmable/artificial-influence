import { NextRequest, NextResponse } from "next/server"

import { assertAcceptedCurrentTerms } from "@/lib/legal/terms-acceptance"
import { createClient } from "@/lib/supabase/server"

import { brandKitFromRow } from "@/lib/brand-kit/database-server"

import {

  parseColorTokens,

  parseReferenceMedia,

  parseStringArray,

  parseTypography,

  splitReferenceMediaToColumns,

} from "@/lib/brand-kit/serialize"



type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("brand_kits")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      console.error("[brand-kits] GET id:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ kit: brandKitFromRow(data as Record<string, unknown>) })
  } catch (e) {
    console.error("[brand-kits] GET id exception:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {

  try {

    const { id } = await context.params

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {

      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    }



    const termsResponse = await assertAcceptedCurrentTerms(supabase, user.id)

    if (termsResponse) {

      return termsResponse

    }

    const body = await request.json().catch(() => ({}))



    const { data: existing, error: loadError } = await supabase

      .from("brand_kits")

      .select("id, user_id")

      .eq("id", id)

      .maybeSingle()



    if (loadError || !existing || existing.user_id !== user.id) {

      return NextResponse.json({ error: "Not found" }, { status: 404 })

    }



    if (body.isDefault === true) {

      await supabase.from("brand_kits").update({ is_default: false }).eq("user_id", user.id)

    }



    const patch: Record<string, unknown> = {}



    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim()

    if (body.isDefault === true) patch.is_default = true

    if (body.isDefault === false) patch.is_default = false



    if ("websiteUrl" in body) {

      patch.website_url =

        typeof body.websiteUrl === "string" && body.websiteUrl.trim() ? body.websiteUrl.trim() : null

    }

    if ("fontFamily" in body) {

      patch.font_family =

        typeof body.fontFamily === "string" && body.fontFamily.trim() ? body.fontFamily.trim() : null

    }

    if ("referenceMedia" in body) {

      const media = parseReferenceMedia(body.referenceMedia)

      const { reference_images, reference_videos } = splitReferenceMediaToColumns(media)

      patch.reference_images = reference_images

      patch.reference_videos = reference_videos

    }

    if ("brandValues" in body) {

      patch.brand_values = parseStringArray(body.brandValues)

    }

    if ("aestheticTags" in body) {

      patch.aesthetic_tags = parseStringArray(body.aestheticTags)

    }

    if ("toneTags" in body) {

      patch.tone_tags = parseStringArray(body.toneTags)

    }

    if ("notes" in body) {

      patch.notes =

        typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null

    }



    if ("logoUrl" in body) {

      patch.logo_url =

        typeof body.logoUrl === "string" && body.logoUrl.trim() ? body.logoUrl.trim() : null

    }

    if ("logoDarkUrl" in body) {

      patch.logo_dark_url =

        typeof body.logoDarkUrl === "string" && body.logoDarkUrl.trim() ? body.logoDarkUrl.trim() : null

    }

    if ("iconUrl" in body) {

      patch.icon_url =

        typeof body.iconUrl === "string" && body.iconUrl.trim() ? body.iconUrl.trim() : null

    }

    if ("iconDarkUrl" in body) {

      patch.icon_dark_url =

        typeof body.iconDarkUrl === "string" && body.iconDarkUrl.trim() ? body.iconDarkUrl.trim() : null

    }

    if ("colors" in body) patch.colors = parseColorTokens(body.colors)

    if ("typography" in body) patch.typography = parseTypography(body.typography)

    if ("tagline" in body) {

      patch.tagline =

        typeof body.tagline === "string" && body.tagline.trim() ? body.tagline.trim() : null

    }

    if ("avoidWords" in body) patch.avoid_words = parseStringArray(body.avoidWords)

    if ("layoutNotes" in body) {

      patch.layout_notes =

        typeof body.layoutNotes === "string" && body.layoutNotes.trim()

          ? body.layoutNotes.trim()

          : null

    }

    if ("audience" in body) {

      patch.audience =

        typeof body.audience === "string" && body.audience.trim() ? body.audience.trim() : null

    }



    const { data, error } = await supabase

      .from("brand_kits")

      .update(patch)

      .eq("id", id)

      .eq("user_id", user.id)

      .select("*")

      .single()



    if (error) {

      console.error("[brand-kits] PATCH:", error)

      return NextResponse.json({ error: error.message }, { status: 500 })

    }



    return NextResponse.json({ kit: brandKitFromRow(data as Record<string, unknown>) })

  } catch (e) {

    console.error("[brand-kits] PATCH exception:", e)

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })

  }

}



export async function DELETE(_request: NextRequest, context: RouteContext) {

  try {

    const { id } = await context.params

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {

      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    }



    const termsResponse = await assertAcceptedCurrentTerms(supabase, user.id)

    if (termsResponse) {

      return termsResponse

    }

    const { data: victim, error: vErr } = await supabase

      .from("brand_kits")

      .select("id, is_default")

      .eq("id", id)

      .eq("user_id", user.id)

      .maybeSingle()



    if (vErr || !victim) {

      return NextResponse.json({ error: "Not found" }, { status: 404 })

    }



    const { error } = await supabase.from("brand_kits").delete().eq("id", id).eq("user_id", user.id)



    if (error) {

      console.error("[brand-kits] DELETE:", error)

      return NextResponse.json({ error: error.message }, { status: 500 })

    }



    if (victim.is_default) {

      const { data: nextKit } = await supabase

        .from("brand_kits")

        .select("id")

        .eq("user_id", user.id)

        .order("updated_at", { ascending: false })

        .limit(1)

        .maybeSingle()



      if (nextKit?.id) {

        await supabase.from("brand_kits").update({ is_default: true }).eq("id", nextKit.id)

      }

    }



    return NextResponse.json({ ok: true })

  } catch (e) {

    console.error("[brand-kits] DELETE exception:", e)

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })

  }

}

