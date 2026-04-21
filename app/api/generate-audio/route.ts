import { NextRequest, NextResponse } from "next/server"

import {
  DEFAULT_AUDIO_PROVIDER,
  getDefaultAudioModel,
  getDefaultAudioVoiceId,
} from "@/lib/constants/audio"
import { assertAcceptedCurrentTerms } from "@/lib/legal/terms-acceptance"
import { resolveAudioProvider, synthesizeSpeech } from "@/lib/server/audio-tts"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now()
  console.log("[generate-audio] ===== Request started =====")

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error(
        "[generate-audio] Authentication failed:",
        authError?.message || "No user"
      )
      return NextResponse.json(
        { error: "Unauthorized. Please log in to generate audio." },
        { status: 401 }
      )
    }

    const termsResponse = await assertAcceptedCurrentTerms(supabase, user.id)
    if (termsResponse) {
      return termsResponse
    }

    const body = await request.json()
    const text = (body.text as string) ?? ""
    const provider = resolveAudioProvider(
      typeof body.provider === "string" ? body.provider : null,
      typeof body.model === "string" ? body.model : null
    )
    const voice = ((body.voice as string) || getDefaultAudioVoiceId(provider)).trim()
    const model = ((body.model as string) || getDefaultAudioModel(provider)).trim()
    const stylePrompt =
      typeof body.stylePrompt === "string" ? body.stylePrompt.trim() : ""
    const languageCode =
      typeof body.languageCode === "string" ? body.languageCode.trim() : ""

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      )
    }

    if (!voice) {
      return NextResponse.json(
        { error: "voice is required" },
        { status: 400 }
      )
    }

    console.log("[generate-audio] Generating speech...", {
      provider,
      textLength: text.length,
      voice: voice.substring(0, 16),
      model,
      hasStylePrompt: stylePrompt.length > 0,
      languageCode,
    })

    const result = await synthesizeSpeech({
      provider,
      text,
      voiceId: voice,
      modelId: model,
      stylePrompt,
      languageCode,
    })

    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(7)
    const storagePath = `${user.id}/audio-generations/${timestamp}-${randomStr}.${result.fileExtension}`

    const { error: uploadError } = await supabase.storage
      .from("public-bucket")
      .upload(storagePath, result.audioBuffer, {
        contentType: result.mimeType,
        upsert: false,
      })

    if (uploadError) {
      console.error("[generate-audio] Upload error:", uploadError)
      return NextResponse.json(
        { error: "Failed to upload generated audio", message: uploadError.message },
        { status: 500 }
      )
    }

    const { data: urlData } = supabase.storage
      .from("public-bucket")
      .getPublicUrl(storagePath)
    const url = urlData.publicUrl

    try {
      const generationData = {
        user_id: user.id,
        prompt: text,
        supabase_storage_path: storagePath,
        reference_images_supabase_storage_path: null as string[] | null,
        reference_videos_supabase_storage_path: null as string[] | null,
        model: result.modelId,
        type: "audio" as const,
        is_public: true,
      }

      const { data: savedData, error: saveError } = await supabase
        .from("generations")
        .insert(generationData)
        .select()
        .single()

      if (saveError) {
        console.error(
          "[generate-audio] Error saving generation to database:",
          saveError
        )
      } else {
        console.log(
          "[generate-audio] Generation saved to database with ID:",
          savedData?.id
        )
      }
    } catch (error) {
      console.error("[generate-audio] Exception saving generation to database:", error)
    }

    const totalTime = Date.now() - requestStartTime
    console.log(
      "[generate-audio] ===== Request completed successfully in",
      totalTime,
      "ms ====="
    )

    return NextResponse.json({
      audio: { url, mimeType: result.mimeType },
      usage: result.usage
        ? {
            ...result.usage,
            provider,
            modelId: result.modelId,
          }
        : {
            provider,
            modelId: result.modelId,
          },
    })
  } catch (error) {
    const totalTime = Date.now() - requestStartTime
    console.error("[generate-audio] ===== Error after", totalTime, "ms =====")
    console.error("[generate-audio] Error details:", error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Failed to generate audio", message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Audio Generation API",
    usage: {
      method: "POST",
      contentType: "application/json",
      body: {
        text: "string (required) - Text to convert to speech",
        provider: `string (optional) - defaults to ${DEFAULT_AUDIO_PROVIDER}`,
        voice: "string (required) - Voice ID from your workspace voice library",
        model: "string (optional) - defaults to the provider's default model",
        stylePrompt:
          "string (optional) - Google Gemini style prompt / delivery instructions",
        languageCode:
          "string (optional) - BCP-47 language code for Google Gemini TTS",
      },
      response: {
        audio: {
          url: "string - Public URL of the generated audio",
          mimeType: "string - e.g. audio/wav or audio/mpeg",
        },
        usage: "object - provider-specific usage plus provider/modelId",
      },
    },
  })
}
