import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import type { AudioProvider } from "@/lib/constants/audio"
import {
  getDefaultAudioModel,
  getDefaultAudioVoiceId,
} from "@/lib/constants/audio"
import { listCatalogVoices } from "@/lib/server/audio-voices"
import {
  resolveAudioProvider,
  synthesizeSpeech,
} from "@/lib/server/audio-tts"

interface CreateGenerateAudioToolOptions {
  supabase: SupabaseClient
  threadId?: string
  userId: string
}

function getSafeFileStem(text: string) {
  const cleaned = text
    .replace(/[^a-z0-9\s-]+/gi, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()

  return cleaned.length > 0 ? cleaned.slice(0, 48) : "voiceover"
}

export function createGenerateAudioTool({
  supabase,
  threadId,
  userId,
}: CreateGenerateAudioToolOptions) {
  return tool({
    description:
      "Generate text-to-speech audio in chat. Use this when the user explicitly wants a voiceover, narration, spoken line, or audio read now. Keep the script literal unless the user asked you to rewrite it. If the user described the voice by qualities instead of an exact voice id, call searchVoices first.",
    inputSchema: z.object({
      text: z
        .string()
        .min(1)
        .max(5000)
        .describe("Exact spoken script to synthesize. Preserve the user's wording unless they explicitly asked for writing help."),
      provider: z
        .enum(["inworld", "google"])
        .optional()
        .describe("Optional audio provider override."),
      modelIdentifier: z
        .string()
        .min(1)
        .max(120)
        .optional()
        .describe("Optional audio model identifier. If omitted, use the provider default."),
      voiceId: z
        .string()
        .min(1)
        .max(160)
        .optional()
        .describe("Exact voice id from searchVoices or the audio studio voice picker."),
      stylePrompt: z
        .string()
        .max(1000)
        .optional()
        .describe("Optional delivery direction for Gemini TTS. Omit for Inworld unless the user explicitly wants Gemini-style prompting."),
      languageCode: z
        .string()
        .min(2)
        .max(32)
        .optional()
        .describe("Optional BCP-47 language code, mainly for Gemini TTS."),
    }),
    strict: true,
    execute: async ({
      languageCode,
      modelIdentifier,
      provider,
      stylePrompt,
      text,
      voiceId,
    }: {
      languageCode?: string
      modelIdentifier?: string
      provider?: AudioProvider
      stylePrompt?: string
      text: string
      voiceId?: string
    }) => {
      const resolvedProvider = resolveAudioProvider(provider, modelIdentifier)
      const resolvedModelId = (modelIdentifier?.trim() || getDefaultAudioModel(resolvedProvider)).trim()
      const resolvedVoiceId = (voiceId?.trim() || getDefaultAudioVoiceId(resolvedProvider)).trim()
      const trimmedText = text.trim()

      if (!trimmedText) {
        throw new Error("Audio generation requires non-empty spoken text.")
      }

      const result = await synthesizeSpeech({
        languageCode: resolvedProvider === "google" ? languageCode?.trim() : undefined,
        modelId: resolvedModelId,
        provider: resolvedProvider,
        stylePrompt: resolvedProvider === "google" ? stylePrompt?.trim() : undefined,
        text: trimmedText,
        voiceId: resolvedVoiceId,
      })

      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).slice(2, 10)
      const storagePath = `${userId}/audio-generations/${timestamp}-${getSafeFileStem(trimmedText)}-${randomStr}.${result.fileExtension}`

      const { error: uploadError } = await supabase.storage
        .from("public-bucket")
        .upload(storagePath, result.audioBuffer, {
          contentType: result.mimeType,
          upsert: false,
        })

      if (uploadError) {
        throw new Error(`Failed to upload generated audio: ${uploadError.message}`)
      }

      const { data: urlData } = supabase.storage.from("public-bucket").getPublicUrl(storagePath)
      const publicUrl = urlData.publicUrl

      const voiceCatalog = await listCatalogVoices(supabase, {
        provider: resolvedProvider,
      }).catch(() => [])
      const matchedVoice = voiceCatalog.find((voice) => voice.voiceId === resolvedVoiceId)

      const { data: savedGeneration, error: saveError } = await supabase
        .from("generations")
        .insert({
          user_id: userId,
          prompt: trimmedText,
          supabase_storage_path: storagePath,
          reference_images_supabase_storage_path: null,
          reference_videos_supabase_storage_path: null,
          model: result.modelId,
          type: "audio",
          is_public: true,
          tool: "chat-generate-audio",
          status: "completed",
          ...(threadId ? { chat_thread_id: threadId } : {}),
        })
        .select("id")
        .single()

      if (saveError || !savedGeneration) {
        throw new Error(`Failed to save generated audio: ${saveError?.message ?? "Unknown error"}`)
      }

      return {
        audio: {
          mimeType: result.mimeType,
          storagePath,
          url: publicUrl,
        },
        generationId: savedGeneration.id,
        message: `Generated audio with ${result.modelId}${matchedVoice ? ` using ${matchedVoice.displayName}` : ""}.`,
        model: result.modelId,
        provider: resolvedProvider,
        status: "completed" as const,
        voiceDisplayName: matchedVoice?.displayName ?? null,
        voiceId: resolvedVoiceId,
      }
    },
  })
}
