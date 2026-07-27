import { NextRequest, NextResponse } from "next/server"

import {
  buildFallbackGoogleGeminiVoices,
  buildFallbackQwenVoices,
  buildFallbackSeedAudioVoices,
  GOOGLE_GEMINI_TTS_MODEL,
  QWEN3_TTS_MODEL,
  type AudioProvider,
} from "@/lib/constants/audio"
import { isAudioProvider } from "@/lib/server/audio-tts"
import { listCatalogVoices, mapPrivateVoiceRows } from "@/lib/server/audio-voices"
import {
  readFormString,
  readPrivateVoiceConfigFromForm,
  validateAndUploadPrivateVoiceReference,
} from "@/lib/server/private-voice-upload"
import { getAuthenticatedRequestContext } from "@/lib/server/request-auth"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const requestedProvider = request.nextUrl.searchParams.get("provider")?.trim()
  const provider: AudioProvider =
    requestedProvider && isAudioProvider(requestedProvider)
      ? requestedProvider
      : "inworld"
  const languages = request.nextUrl.searchParams
    .getAll("languages")
    .map((language) => language.trim())
    .filter(Boolean)

  try {
    const supabase = await createClient()
    const voices = await listCatalogVoices(supabase, { provider, languages })

    return NextResponse.json({ voices })
  } catch (error) {
    if (provider === "google" || provider === "qwen" || provider === "fal") {
      const providerFallback =
        provider === "google"
          ? buildFallbackGoogleGeminiVoices()
          : provider === "qwen"
            ? buildFallbackQwenVoices()
            : buildFallbackSeedAudioVoices()
      const fallbackVoices = providerFallback.filter((voice) =>
        languages.length > 0 ? languages.includes(voice.langCode) : true
      )

      return NextResponse.json({
        voices: fallbackVoices,
        degraded: true,
        warning: error instanceof Error ? error.message : "Unknown error",
      })
    }

    return NextResponse.json(
      {
        error: "Failed to load voice catalog",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { supabase, user, error: authError } =
    await getAuthenticatedRequestContext(request, ["generations:write"])
  if (authError || !user) {
    return NextResponse.json({ error: "Please log in to save a private voice." }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const provider = readFormString(formData, "provider")
    const kind = readFormString(formData, "kind")
    const name = readFormString(formData, "name")

    if ((provider !== "qwen" && provider !== "google") || !["clone", "design"].includes(kind)) {
      return NextResponse.json({ error: "Unsupported private voice type." }, { status: 400 })
    }
    if (provider === "google" && kind !== "design") {
      return NextResponse.json(
        { error: "Gemini supports saved designed voice profiles, not voice cloning." },
        { status: 400 }
      )
    }
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: "Voice name must be 2–80 characters." }, { status: 400 })
    }

    const id = crypto.randomUUID()
    let referenceStoragePath: string | null = null
    const config = readPrivateVoiceConfigFromForm(formData)

    if (kind === "clone") {
      const file = formData.get("referenceAudio")
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Upload an audio recording to clone this voice." },
          { status: 400 }
        )
      }

      const upload = await validateAndUploadPrivateVoiceReference({
        supabase,
        userId: user.id,
        voiceId: id,
        file,
      })
      if (!upload.ok) {
        return NextResponse.json({ error: upload.error }, { status: upload.status })
      }
      referenceStoragePath = upload.path
    }

    const modelId = provider === "qwen" ? QWEN3_TTS_MODEL : GOOGLE_GEMINI_TTS_MODEL
    const { data, error } = await supabase
      .from("private_audio_voices")
      .insert({
        id,
        user_id: user.id,
        name,
        provider,
        model_id: modelId,
        kind,
        config,
        reference_storage_path: referenceStoragePath,
      })
      .select("id, name, provider, model_id, kind, config, reference_storage_path, preview_storage_path")
      .single()

    if (error) {
      if (referenceStoragePath) {
        await supabase.storage.from("private-voices").remove([referenceStoragePath])
      }
      throw new Error(error.message)
    }

    const [voice] = await mapPrivateVoiceRows(supabase, [data])
    return NextResponse.json({ voice })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not save this private voice.",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
