import { NextRequest, NextResponse } from "next/server"

import {
  buildFallbackGoogleGeminiVoices,
  buildFallbackQwenVoices,
  buildFallbackSeedAudioVoices,
  GOOGLE_GEMINI_TTS_MODEL,
  MAX_PRIVATE_VOICE_REFERENCE_SECONDS,
  QWEN3_TTS_MODEL,
  type AudioProvider,
} from "@/lib/constants/audio"
import { isAudioProvider } from "@/lib/server/audio-tts"
import { listCatalogVoices } from "@/lib/server/audio-voices"
import { getAuthenticatedRequestContext } from "@/lib/server/request-auth"
import { createClient } from "@/lib/supabase/server"
import { getAudioDurationSeconds } from "@/lib/video-editor/media-parser"

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

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function safeAudioExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase()
  if (fromName && /^(wav|mp3|mpeg|m4a|ogg|opus|flac|webm)$/.test(fromName)) {
    return fromName === "mpeg" ? "mp3" : fromName
  }
  if (file.type.includes("wav")) return "wav"
  if (file.type.includes("ogg") || file.type.includes("opus")) return "ogg"
  if (file.type.includes("webm")) return "webm"
  if (file.type.includes("mp4")) return "m4a"
  return "mp3"
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
    const config: Record<string, string> = {}

    for (const key of [
      "baseVoice",
      "language",
      "languageCode",
      "referenceText",
      "styleInstruction",
      "stylePrompt",
      "voiceDescription",
    ]) {
      const value = readFormString(formData, key)
      if (value) config[key] = value
    }

    if (kind === "clone") {
      const file = formData.get("referenceAudio")
      if (!(file instanceof File) || !file.type.startsWith("audio/")) {
        return NextResponse.json(
          { error: "Upload an audio recording to clone this voice." },
          { status: 400 }
        )
      }
      if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json({ error: "Voice recordings must be under 20 MB." }, { status: 400 })
      }
      let durationSeconds: number
      try {
        durationSeconds = await getAudioDurationSeconds(file)
      } catch {
        return NextResponse.json(
          { error: "Could not read the reference recording duration." },
          { status: 400 }
        )
      }
      if (
        !Number.isFinite(durationSeconds) ||
        durationSeconds <= 0 ||
        durationSeconds > MAX_PRIVATE_VOICE_REFERENCE_SECONDS
      ) {
        return NextResponse.json(
          { error: "Reference recordings must be 15 seconds or shorter." },
          { status: 400 }
        )
      }

      referenceStoragePath = `${user.id}/${id}/reference.${safeAudioExtension(file)}`
      const { error: uploadError } = await supabase.storage
        .from("private-voices")
        .upload(referenceStoragePath, Buffer.from(await file.arrayBuffer()), {
          contentType: file.type || "audio/mpeg",
          upsert: false,
        })
      if (uploadError) throw new Error(uploadError.message)
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
      .select("id, name, provider, model_id, kind, config")
      .single()

    if (error) {
      if (referenceStoragePath) {
        await supabase.storage.from("private-voices").remove([referenceStoragePath])
      }
      throw new Error(error.message)
    }

    return NextResponse.json({
      voice: {
        voiceId: `private:${data.id}`,
        displayName: data.name,
        description: kind === "clone" ? "Your private cloned voice." : "Your reusable designed voice.",
        langCode: config.languageCode ?? config.language ?? "",
        tags: ["private", kind, provider],
        source: kind === "clone" ? "CLONE" : "DESIGN",
        provider,
        model: modelId,
        privateVoiceId: data.id,
        privateVoiceKind: kind,
        privateVoiceConfig: config,
      },
    })
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
