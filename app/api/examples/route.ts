import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createSavedExample, listSavedExamplesForGallery, updateSavedExample } from "@/lib/examples/database-server"
import type { TemplateInput } from "@/lib/templates/types"

const exampleRequestSchema = z.object({
  surface: z.enum(["image", "video"]).default("image"),
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  prompt: z.string().trim().min(1).max(8000),
  prompt_attachments: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string().max(240).nullable().optional(),
      }),
    )
    .max(12)
    .optional(),
  inputs: z.array(z.record(z.string(), z.unknown())).max(20).optional(),
  default_settings: z.record(z.string(), z.unknown()).optional(),
  source_generation_id: z.string().uuid().nullable().optional(),
  cover_url: z.string().url().nullable().optional(),
  cover_kind: z.enum(["image", "video"]).default("image"),
  visibility: z.enum(["private", "public"]).default("private"),
})

function buildFallbackTitle(prompt: string) {
  const cleaned = prompt.replace(/\{\{[^}]+\}\}/g, " ").replace(/\s+/g, " ").trim()
  if (!cleaned) {
    return "New example"
  }

  const words = cleaned.split(" ").slice(0, 8).join(" ")
  return words.length > 120 ? `${words.slice(0, 117)}...` : words
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const searchParams = request.nextUrl.searchParams
    const surface = searchParams.get("surface") ?? "image"
    const search = searchParams.get("search") ?? undefined

    const examples = await listSavedExamplesForGallery(user?.id ?? null, surface, search)

    return NextResponse.json({ examples, viewerId: user?.id ?? null })
  } catch (error) {
    console.error("[examples] GET error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch examples",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = exampleRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const title = parsed.data.title?.trim() || buildFallbackTitle(parsed.data.prompt)

    const example = await createSavedExample(user.id, {
      surface: parsed.data.surface,
      title,
      description: parsed.data.description ?? "",
      prompt: parsed.data.prompt,
      prompt_attachments: parsed.data.prompt_attachments ?? [],
      inputs: (parsed.data.inputs ?? []) as TemplateInput[],
      default_settings: parsed.data.default_settings ?? {},
      source_generation_id: parsed.data.source_generation_id ?? null,
      cover_url: parsed.data.cover_url ?? null,
      cover_kind: parsed.data.cover_kind,
      visibility: parsed.data.visibility,
    })

    return NextResponse.json({ example })
  } catch (error) {
    console.error("[examples] POST error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create example",
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const exampleId = typeof body.id === "string" ? body.id : ""
    const parsed = exampleRequestSchema.safeParse(body)
    if (!exampleId || !parsed.success) {
      return NextResponse.json({ error: parsed.success ? "Invalid example id" : parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const title = parsed.data.title?.trim() || buildFallbackTitle(parsed.data.prompt)
    const example = await updateSavedExample(exampleId, user.id, {
      surface: parsed.data.surface, title, description: parsed.data.description ?? "", prompt: parsed.data.prompt,
      prompt_attachments: parsed.data.prompt_attachments ?? [], inputs: (parsed.data.inputs ?? []) as TemplateInput[],
      default_settings: parsed.data.default_settings ?? {}, source_generation_id: parsed.data.source_generation_id ?? null,
      cover_url: parsed.data.cover_url ?? null, cover_kind: parsed.data.cover_kind, visibility: parsed.data.visibility,
    })
    return NextResponse.json({ example })
  } catch (error) {
    console.error("[examples] PATCH error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update example" }, { status: 500 })
  }
}
