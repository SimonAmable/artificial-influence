import { createGateway, generateText } from "ai"
import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

const MODEL = "google/gemini-2.5-flash" as const

type OtherVarPayload = {
  id: string
  name: string
  textSamples: string[]
}

function parseStringListFromModel(raw: string): string[] {
  const t = raw.trim()
  const asStrings = (arr: unknown): string[] =>
    Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean)
      : []

  const tryObject = (s: string): string[] => {
    const o = JSON.parse(s) as unknown
    if (Array.isArray(o)) return asStrings(o)
    if (o && typeof o === "object" && "items" in o) {
      const items = (o as { items?: unknown }).items
      return asStrings(items)
    }
    return []
  }

  try {
    return tryObject(t)
  } catch {
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fence?.[1]) {
      try {
        return tryObject(fence[1].trim())
      } catch {
        // fall through
      }
    }
    const arr = t.match(/\[[\s\S]*\]/)
    if (arr) {
      try {
        return tryObject(arr[0])
      } catch {
        return []
      }
    }
  }
  return []
}

export async function POST(req: Request) {
  try {
    if (!process.env.AI_GATEWAY_API_KEY) {
      return NextResponse.json({ error: "AI gateway is not configured" }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      targetVariableId?: string
      targetVariableName?: string
      existingTextValues?: string[]
      otherVariables?: OtherVarPayload[]
      userHint?: string
      promptContext?: string
    }

    const targetVariableId = typeof body.targetVariableId === "string" ? body.targetVariableId.trim() : ""
    const targetVariableName = typeof body.targetVariableName === "string" ? body.targetVariableName.trim() : ""
    const existingTextValues = Array.isArray(body.existingTextValues)
      ? body.existingTextValues.filter((x): x is string => typeof x === "string").map((s) => s.trim())
      : []
    const otherVariables = Array.isArray(body.otherVariables) ? body.otherVariables : []
    const userHint = typeof body.userHint === "string" ? body.userHint.trim() : ""
    const promptContext =
      typeof body.promptContext === "string" ? body.promptContext.trim().slice(0, 4000) : ""

    if (!targetVariableId || !targetVariableName) {
      return NextResponse.json({ error: "targetVariableId and targetVariableName are required" }, { status: 400 })
    }

    const hasCrossVariableContext = otherVariables.length >= 2
    const hasEnoughLocalTextSamples = existingTextValues.length >= 3

    if (!hasCrossVariableContext && !hasEnoughLocalTextSamples) {
      return NextResponse.json(
        {
          error:
            "Add at least 3 non-empty text values in this variable, or add 3+ variables to the automation for cross-context expansion.",
        },
        { status: 400 },
      )
    }

    const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })

    const othersBlock = otherVariables
      .map(
        (o) =>
          `- ${o.name} (id ${o.id}): ${(o.textSamples ?? []).slice(0, 12).join(" | ") || "(no text values yet)"}`,
      )
      .join("\n")

    const existingBlock =
      existingTextValues.length > 0
        ? existingTextValues.join("\n- ")
        : "(none yet)"

    const crossContextSection = hasCrossVariableContext
      ? `Other variables in this automation (for context — stay consistent with the overall theme):
${othersBlock}
`
      : ""

    const singleVarNote = !hasCrossVariableContext
      ? `There are no other variables yet — infer what kind of list this is from the samples below and add NEW entries in the same spirit (same category, style, and length; avoid duplicates).
`
      : ""

    const userMessage = `You are helping fill a TEXT-ONLY rotation list for one placeholder in an automation prompt.

Target variable (expand THIS list):
- Name: ${targetVariableName}
- Token id: ${targetVariableId}
- Existing text values (do not duplicate these; add new ones in the same style/theme):
- ${existingBlock}

${singleVarNote}${crossContextSection}${promptContext ? `Automation prompt excerpt (for tone/theme):\n${promptContext}\n` : ""}${userHint ? `User request / theme hint:\n${userHint}\n` : ""}

Return between 8 and 20 new short text strings (single line each, no JSON inside strings).`

    const result = await generateText({
      model: gateway(MODEL),
      messages: [
        {
          role: "system",
          content: `You respond with ONLY valid JSON and no other text. Shape: {"items":["string",...]}. Each string is non-empty. No markdown fences.`,
        },
        { role: "user", content: userMessage },
      ],
      temperature: 0.85,
    })

    const items = parseStringListFromModel(result.text)
    const deduped: string[] = []
    const seen = new Set(existingTextValues.map((s) => s.toLowerCase()))
    for (const s of items) {
      const key = s.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(s)
      if (deduped.length >= 24) break
    }

    if (deduped.length === 0) {
      return NextResponse.json({ error: "Could not generate new list items. Try a different hint." }, { status: 422 })
    }

    return NextResponse.json({ items: deduped })
  } catch (e) {
    console.error("[automations/expand-variable-list]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generation failed" },
      { status: 500 },
    )
  }
}
