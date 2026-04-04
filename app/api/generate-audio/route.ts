import { NextRequest, NextResponse } from "next/server"

import {
  DEFAULT_INWORLD_TTS_MODEL,
  DEFAULT_INWORLD_VOICE_ID,
} from "@/lib/constants/inworld-tts"
import { synthesizeInworldSpeech } from "@/lib/server/inworld-tts"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now()
  console.log("[generate-audio] ===== Request started =====")

  try {
    if (!process.env.INWORLD_API_KEY_BASE64) {
      console.error("[generate-audio] INWORLD_API_KEY_BASE64 not set")
      return NextResponse.json(
        { error: "INWORLD_API_KEY_BASE64 environment variable is not set" },
        { status: 500 }
      )
    }

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

    const body = await request.json()
    const text = (body.text as string) ?? ""
    const voice = ((body.voice as string) || DEFAULT_INWORLD_VOICE_ID).trim()
    const model = (body.model as string) || DEFAULT_INWORLD_TTS_MODEL

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "text and voice are required" },
        { status: 400 }
      )
    }

    if (!voice || typeof voice !== "string") {
      return NextResponse.json(
        { error: "text and voice are required" },
        { status: 400 }
      )
    }

    console.log("[generate-audio] Generating speech with Inworld...", {
      textLength: text.length,
      voice: voice.substring(0, 16),
      model,
    })

    const result = await synthesizeInworldSpeech({
      text,
      voiceId: voice,
      modelId: model,
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
      usage: result.usage ?? null,
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
    message: "Audio Generation API - Inworld TTS",
    usage: {
      method: "POST",
      contentType: "application/json",
      body: {
        text: "string (required) - Text to convert to speech",
        voice: "string (required) - Inworld voice ID from your workspace voice library",
        model: `string (optional) - defaults to ${DEFAULT_INWORLD_TTS_MODEL}`,
      },
      response: {
        audio: {
          url: "string - Public URL of the generated audio",
          mimeType: "string - e.g. audio/wav",
        },
        usage: {
          processedCharactersCount: "number",
          modelId: "string",
        },
      },
    },
  })
}
