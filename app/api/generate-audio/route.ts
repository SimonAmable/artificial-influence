import { NextRequest, NextResponse } from "next/server"

import {
  AUDIO_GENERATION_CREDIT_COST,
  DEFAULT_AUDIO_PROVIDER,
  MAX_AUDIO_SCRIPT_CHARACTERS,
  getDefaultAudioModel,
  getDefaultAudioVoiceId,
} from "@/lib/constants/audio"
import { checkUserHasCredits, deductUserCredits } from "@/lib/credits"
import { resolveAudioProvider, synthesizeSpeech } from "@/lib/server/audio-tts"
import { getAuthenticatedRequestContext } from "@/lib/server/request-auth"

type PrivateVoiceRow = {
  id: string
  user_id: string
  provider: string
  kind: "clone" | "design"
  config: Record<string, unknown> | null
  reference_storage_path: string | null
}

function readOptionalNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now()
  console.log("[generate-audio] ===== Request started =====")

  try {
    const { supabase, user, error: authError } = await getAuthenticatedRequestContext(
      request,
      ["generations:write"]
    )

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
    const text = typeof body.text === "string" ? body.text : ""
    const provider = resolveAudioProvider(
      typeof body.provider === "string" ? body.provider : null,
      typeof body.model === "string" ? body.model : null
    )
    let voice = ((body.voice as string) || getDefaultAudioVoiceId(provider)).trim()
    const model = ((body.model as string) || getDefaultAudioModel(provider)).trim()
    let stylePrompt =
      typeof body.stylePrompt === "string" ? body.stylePrompt.trim() : ""
    let languageCode =
      typeof body.languageCode === "string" ? body.languageCode.trim() : ""
    let qwenMode =
      body.qwenMode === "voice_clone" || body.qwenMode === "voice_design"
        ? body.qwenMode
        : "custom_voice"
    let qwenLanguage =
      typeof body.qwenLanguage === "string" ? body.qwenLanguage.trim() : ""
    let referenceAudioUrl =
      typeof body.referenceAudioUrl === "string" ? body.referenceAudioUrl.trim() : ""
    let referenceText =
      typeof body.referenceText === "string" ? body.referenceText.trim() : ""
    let styleInstruction =
      typeof body.styleInstruction === "string" ? body.styleInstruction.trim() : ""
    let voiceDescription =
      typeof body.voiceDescription === "string" ? body.voiceDescription.trim() : ""

    if (voice.startsWith("private:")) {
      const privateVoiceId = voice.slice("private:".length)
      const { data: privateVoice, error: privateVoiceError } = await supabase
        .from("private_audio_voices")
        .select("id, user_id, provider, kind, config, reference_storage_path")
        .eq("id", privateVoiceId)
        .eq("user_id", user.id)
        .single()

      if (privateVoiceError || !privateVoice) {
        return NextResponse.json({ error: "Private voice not found." }, { status: 404 })
      }

      const savedVoice = privateVoice as PrivateVoiceRow
      if (savedVoice.provider !== provider) {
        return NextResponse.json(
          { error: "This saved voice belongs to a different audio model." },
          { status: 400 }
        )
      }

      const config = savedVoice.config ?? {}
      if (provider === "google") {
        voice =
          typeof config.baseVoice === "string"
            ? config.baseVoice
            : getDefaultAudioVoiceId("google")
        stylePrompt =
          typeof config.stylePrompt === "string" ? config.stylePrompt : stylePrompt
        languageCode =
          typeof config.languageCode === "string" ? config.languageCode : languageCode
      } else if (provider === "qwen") {
        qwenMode = savedVoice.kind === "clone" ? "voice_clone" : "voice_design"
        qwenLanguage =
          typeof config.language === "string" ? config.language : qwenLanguage
        referenceText =
          typeof config.referenceText === "string" ? config.referenceText : referenceText
        styleInstruction =
          typeof config.styleInstruction === "string"
            ? config.styleInstruction
            : styleInstruction
        voiceDescription =
          typeof config.voiceDescription === "string"
            ? config.voiceDescription
            : voiceDescription

        if (savedVoice.kind === "clone") {
          if (!savedVoice.reference_storage_path) {
            return NextResponse.json(
              { error: "This cloned voice is missing its reference recording." },
              { status: 409 }
            )
          }
          const { data: signedData, error: signedError } = await supabase.storage
            .from("private-voices")
            .createSignedUrl(savedVoice.reference_storage_path, 600)
          if (signedError || !signedData?.signedUrl) {
            throw new Error(signedError?.message || "Could not access private voice audio.")
          }
          referenceAudioUrl = signedData.signedUrl
        }
        voice = getDefaultAudioVoiceId("qwen")
      }
    }

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      )
    }
    if (text.length > MAX_AUDIO_SCRIPT_CHARACTERS) {
      return NextResponse.json(
        { error: `Audio scripts are limited to ${MAX_AUDIO_SCRIPT_CHARACTERS} characters.` },
        { status: 400 }
      )
    }

    if (!voice) {
      return NextResponse.json(
        { error: "voice is required" },
        { status: 400 }
      )
    }
    const hasCredits = await checkUserHasCredits(
      user.id,
      AUDIO_GENERATION_CREDIT_COST,
      supabase
    )
    if (!hasCredits) {
      return NextResponse.json(
        { error: "Insufficient credits. Audio generation costs 1 credit." },
        { status: 402 }
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
      qwenMode,
      qwenLanguage,
      referenceAudioUrl,
      referenceText,
      styleInstruction,
      voiceDescription,
      audioUrls: Array.isArray(body.audioUrls)
        ? body.audioUrls.filter((url: unknown): url is string => typeof url === "string")
        : [],
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : null,
      outputFormat: typeof body.outputFormat === "string" ? body.outputFormat : null,
      sampleRate: readOptionalNumber(body.sampleRate),
      speed: readOptionalNumber(body.speed),
      volume: readOptionalNumber(body.volume),
      pitch: readOptionalNumber(body.pitch),
      multilingual: typeof body.multilingual === "boolean" ? body.multilingual : null,
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

    let savedGenerationId: string | null = null

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
        savedGenerationId = savedData?.id ?? null
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

    const updatedCreditBalance = await deductUserCredits(
      user.id,
      AUDIO_GENERATION_CREDIT_COST,
      supabase
    )
    if (updatedCreditBalance === -1) {
      console.error("[generate-audio] Failed to deduct generation credit")
    }

    return NextResponse.json({
      audio: { url, mimeType: result.mimeType },
      creditsUsed: AUDIO_GENERATION_CREDIT_COST,
      generationId: savedGenerationId,
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
        privateVoice:
          "Select a private:<id> voice returned by the voice catalog to reuse a saved clone or design.",
        qwen:
          "qwenMode, qwenLanguage, referenceAudioUrl, referenceText, styleInstruction, voiceDescription",
        seedAudio:
          "audioUrls (max 3) or imageUrl, outputFormat, sampleRate, speed, volume, pitch, multilingual",
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
