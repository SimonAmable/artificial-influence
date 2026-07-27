import { NextRequest, NextResponse } from "next/server"

import {
  mapPrivateVoiceRows,
  type PrivateVoiceRow,
} from "@/lib/server/audio-voices"
import {
  readFormString,
  readPrivateVoiceConfigFromForm,
  validateAndUploadPrivateVoiceReference,
} from "@/lib/server/private-voice-upload"
import { getAuthenticatedRequestContext } from "@/lib/server/request-auth"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { supabase, user, error: authError } =
    await getAuthenticatedRequestContext(request, ["generations:write"])
  if (authError || !user) {
    return NextResponse.json(
      { error: "Please log in to update a private voice." },
      { status: 401 }
    )
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: "Voice id is required." }, { status: 400 })
  }

  try {
    const { data: existing, error: existingError } = await supabase
      .from("private_audio_voices")
      .select("id, name, provider, model_id, kind, config, reference_storage_path, preview_storage_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existingError) throw new Error(existingError.message)
    if (!existing) {
      return NextResponse.json({ error: "Private voice not found." }, { status: 404 })
    }

    const current = existing as PrivateVoiceRow & {
      reference_storage_path: string | null
    }
    const formData = await request.formData()
    const name = readFormString(formData, "name") || current.name

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { error: "Voice name must be 2–80 characters." },
        { status: 400 }
      )
    }

    const nextConfig = {
      ...(current.config ?? {}),
      ...readPrivateVoiceConfigFromForm(formData),
    }

    // Allow clearing optional delivery fields when the form sends empty strings.
    for (const key of ["styleInstruction", "stylePrompt"] as const) {
      if (formData.has(key) && !readFormString(formData, key)) {
        delete nextConfig[key]
      }
    }

    if (current.kind === "design" && current.provider === "qwen") {
      const voiceDescription =
        typeof nextConfig.voiceDescription === "string"
          ? nextConfig.voiceDescription.trim()
          : ""
      if (!voiceDescription) {
        return NextResponse.json(
          { error: "Designed voices need a voice description." },
          { status: 400 }
        )
      }
    }

    if (current.kind === "design" && current.provider === "google") {
      const stylePrompt =
        typeof nextConfig.stylePrompt === "string" ? nextConfig.stylePrompt.trim() : ""
      if (!stylePrompt) {
        nextConfig.stylePrompt = "Say the following."
      }
    }

    let referenceStoragePath = current.reference_storage_path
    const file = formData.get("referenceAudio")
    if (file instanceof File && file.size > 0) {
      if (current.kind !== "clone") {
        return NextResponse.json(
          { error: "Only cloned voices can replace a reference recording." },
          { status: 400 }
        )
      }

      const upload = await validateAndUploadPrivateVoiceReference({
        supabase,
        userId: user.id,
        voiceId: current.id,
        file,
        previousPath: current.reference_storage_path,
      })
      if (!upload.ok) {
        return NextResponse.json({ error: upload.error }, { status: upload.status })
      }
      referenceStoragePath = upload.path

      const referenceText = readFormString(formData, "referenceText")
      if (referenceText) {
        nextConfig.referenceText = referenceText
      } else {
        delete nextConfig.referenceText
      }
    }

    const { data, error } = await supabase
      .from("private_audio_voices")
      .update({
        name,
        config: nextConfig,
        reference_storage_path: referenceStoragePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id)
      .eq("user_id", user.id)
      .select("id, name, provider, model_id, kind, config, reference_storage_path, preview_storage_path")
      .single()

    if (error) throw new Error(error.message)

    const [voice] = await mapPrivateVoiceRows(supabase, [data])
    return NextResponse.json({ voice })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not update this private voice.",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
