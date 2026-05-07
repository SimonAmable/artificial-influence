import type { SupabaseClient } from "@supabase/supabase-js"
import { generateObject } from "ai"
import type { UIMessage } from "ai"
import { z } from "zod"

import {
  AI_GATEWAY_CONFIG_ERROR,
  createAIGatewayProvider,
  hasAIGatewayCredentials,
} from "@/lib/ai/gateway"

/** Fast model via AI Gateway — override with THREAD_TITLE_GATEWAY_MODEL when needed. */
const DEFAULT_THREAD_TITLE_GATEWAY_MODEL = "google/gemini-2.5-flash" as const

const intentTitleSchema = z.object({
  title: z
    .string()
    .min(2)
    .max(72)
    .describe(
      "Short chat thread title capturing the user's opening intent only. 3–8 words preferred. Title case or sentence case. No quotes.",
    ),
})

/**
 * Normalize the first user message into a bounded string for naming (first user message only).
 */
export function plaintextFromFirstUserMessageForIntentTitle(message: UIMessage | undefined): string | null {
  if (!message || message.role !== "user") {
    return null
  }

  const chunks: string[] = []

  for (const part of message.parts) {
    if (part.type === "text" && typeof part.text === "string") {
      const t = part.text.replace(/\s+/g, " ").trim()
      if (t.length > 0) {
        chunks.push(t)
      }
      continue
    }

    if (part.type === "file") {
      const file = part as { filename?: string; name?: string; mediaType?: string }
      const fn =
        typeof file.filename === "string"
          ? file.filename
          : typeof file.name === "string"
            ? file.name
            : null
      if (fn?.trim()) {
        chunks.push(`[File: ${fn.trim()}]`)
      } else if (typeof file.mediaType === "string") {
        chunks.push(`[File: ${file.mediaType}]`)
      } else {
        chunks.push("[File attachment]")
      }
    }
  }

  const merged = chunks.join(" ").replace(/\s+/g, " ").trim()
  if (merged.length === 0) {
    return null
  }

  return merged.length > 4000 ? `${merged.slice(0, 3997)}...` : merged
}

function resolveThreadTitleModelId(): string {
  const raw = process.env.THREAD_TITLE_GATEWAY_MODEL?.trim()
  return raw?.length ? raw : DEFAULT_THREAD_TITLE_GATEWAY_MODEL
}

export async function generateIntentThreadTitleFromUserOpening(openingPlaintext: string): Promise<string | null> {
  if (!openingPlaintext.trim()) {
    return null
  }
  if (!hasAIGatewayCredentials()) {
    console.error("[thread-intent-title]", AI_GATEWAY_CONFIG_ERROR)
    return null
  }

  try {
    const gateway = createAIGatewayProvider()
    const model = gateway(resolveThreadTitleModelId())

    const { object } = await generateObject({
      model,
      schema: intentTitleSchema,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You produce short conversation titles seen in chat sidebars.\n\
Rules:\n\
- Infer intent only from the user's opening message text you are given.\n\
- Ignore any assumptions about how an assistant replied.\n\
- Prefer 3–8 words unless the topic demands slightly more.\n\
- Never include quotes surrounding the entire title.\n\
- Avoid trailing ellipsis unless necessary.",
        },
        {
          role: "user",
          content:
            `Propose a sidebar title summarizing ONLY this opening user message (no other context):\n\n${openingPlaintext}`,
        },
      ],
    })

    const t = object.title.replace(/\s+/g, " ").trim()
    if (t.length < 2) {
      return null
    }

    return t.length > 80 ? `${t.slice(0, 77)}…` : t
  } catch (e) {
    console.error("[thread-intent-title] generateObject failed:", e)
    return null
  }
}

/**
 * At-most-one CAS: wins the sole intent-title generation slot for user threads.
 * Call before invoking the naming model.
 */
export async function claimIntentTitleGenerationSlot(
  supabase: SupabaseClient,
  threadId: string,
  userId: string,
): Promise<boolean> {
  const startedAt = new Date().toISOString()

  const { data, error } = await supabase
    .from("chat_threads")
    .update({ intent_title_started_at: startedAt })
    .eq("id", threadId)
    .eq("user_id", userId)
    .eq("source", "user")
    .is("intent_title_started_at", null)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("[thread-intent-title] claim CAS failed:", error)
    return false
  }

  return Boolean(data?.id)
}

export async function applyIntentGeneratedThreadTitle(
  supabase: SupabaseClient,
  threadId: string,
  userId: string,
  title: string,
): Promise<void> {
  const safe = title.replace(/\s+/g, " ").trim()
  if (safe.length < 2) {
    return
  }

  const { error } = await supabase
    .from("chat_threads")
    .update({
      title: safe.slice(0, 120),
      title_locked: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId)
    .eq("user_id", userId)

  if (error) {
    console.error("[thread-intent-title] apply title failed:", error)
    throw new Error(error.message)
  }
}
