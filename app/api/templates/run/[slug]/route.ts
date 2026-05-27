import { NextRequest, NextResponse } from "next/server"
import { createChatThread } from "@/lib/chat/database-server"
import { checkUserHasCredits } from "@/lib/credits"
import { createClient } from "@/lib/supabase/server"
import {
  buildTemplateHiddenContext,
  buildTemplateOpeningMessage,
  fillTemplatePrompt,
} from "@/lib/templates/prompt-filler"
import {
  createTemplateRun,
  getTemplateBySlugForUser,
} from "@/lib/templates/database-server"
import { templateRunValuesSchema } from "@/lib/templates/validation"
import { validateRunInputValues } from "@/lib/templates/validate-run-values"

interface RouteParams {
  params: Promise<{ slug: string }>
}

function parsePromptImageUrlsByInputId(
  value: unknown,
): Record<string, string[]> {
  if (!value || typeof value !== "object") {
    return {}
  }

  const entries = Object.entries(value as Record<string, unknown>)
  const next: Record<string, string[]> = {}

  for (const [inputId, urls] of entries) {
    if (!Array.isArray(urls)) continue

    const validUrls = urls
      .filter((url): url is string => typeof url === "string")
      .map((url) => url.trim())
      .filter((url) => url.startsWith("http://") || url.startsWith("https://"))

    if (validUrls.length > 0) {
      next[inputId] = [...new Set(validUrls)]
    }
  }

  return next
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const template = await getTemplateBySlugForUser(slug, user.id)
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    const hasCredits = await checkUserHasCredits(user.id, template.credits_cost, supabase)
    if (!hasCredits) {
      return NextResponse.json(
        {
          error: `Insufficient credits. This template requires ${template.credits_cost} credits.`,
        },
        { status: 402 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const valuesParsed = templateRunValuesSchema.safeParse(body.values ?? body)
    if (!valuesParsed.success) {
      return NextResponse.json({ error: "Invalid input values" }, { status: 400 })
    }

    const validated = validateRunInputValues(template, valuesParsed.data)
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const promptImageUrlsByInputId = parsePromptImageUrlsByInputId(body.promptImageUrlsByInputId)
    const hiddenPromptImageUrls = [
      ...template.prompt_attachments.map((attachment) => attachment.url),
      ...Object.values(promptImageUrlsByInputId).flat(),
    ]
    const filled = fillTemplatePrompt(template, validated.values, {
      additionalImageUrls: hiddenPromptImageUrls,
    })
    const templateContext = buildTemplateHiddenContext(template, validated.values, filled, {
      promptImageCountsByInputId: Object.fromEntries(
        Object.entries(promptImageUrlsByInputId).map(([inputId, urls]) => [inputId, urls.length]),
      ),
    })
    const openingMessage = buildTemplateOpeningMessage(filled, template.title, templateContext, {
      hiddenImageUrls: hiddenPromptImageUrls,
    })

    const thread = await createChatThread(user.id, template.title)

    await createTemplateRun({
      templateId: template.id,
      threadId: thread.id,
      userId: user.id,
      inputValues: validated.values,
      templateContext,
      creditsEstimated: template.credits_cost,
    })

    return NextResponse.json({
      threadId: thread.id,
      templateSlug: template.slug,
      openingMessage,
    })
  } catch (error) {
    console.error("[templates/run] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run template" },
      { status: 500 },
    )
  }
}
