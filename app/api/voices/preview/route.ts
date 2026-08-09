import { NextRequest, NextResponse } from "next/server"

import { PRIVATE_VOICE_PREVIEW_CREDIT_COST } from "@/lib/constants/audio"
import { checkUserHasCredits, deductUserCredits } from "@/lib/credits"
import {
  generateAndStorePrivateVoicePreview,
  upsertPrivateVoiceFromForm,
} from "@/lib/server/private-voice-ops"
import { getAuthenticatedRequestContext } from "@/lib/server/request-auth"
import { authContextFailureResponse } from "@/lib/server/require-active-user"

export async function POST(request: NextRequest) {
  const { supabase, user, error: authError } =
    await getAuthenticatedRequestContext(request, ["generations:write"])
  if (authError || !user) {
    return authContextFailureResponse(authError)
  }

  try {
    const hasCredits = await checkUserHasCredits(
      user.id,
      PRIVATE_VOICE_PREVIEW_CREDIT_COST,
      supabase
    )
    if (!hasCredits) {
      return NextResponse.json(
        {
          error: `Insufficient credits. Voice preview costs ${PRIVATE_VOICE_PREVIEW_CREDIT_COST} credit.`,
        },
        { status: 402 }
      )
    }

    const formData = await request.formData()
    const upsert = await upsertPrivateVoiceFromForm({
      supabase,
      userId: user.id,
      formData,
    })
    if (!upsert.ok) {
      return NextResponse.json({ error: upsert.error }, { status: upsert.status })
    }

    const preview = await generateAndStorePrivateVoicePreview({
      supabase,
      userId: user.id,
      row: upsert.row,
    })
    if (!preview.ok) {
      return NextResponse.json({ error: preview.error }, { status: preview.status })
    }

    const updatedCreditBalance = await deductUserCredits(
      user.id,
      PRIVATE_VOICE_PREVIEW_CREDIT_COST,
      supabase
    )

    return NextResponse.json({
      voice: preview.voice,
      previewAudioUrl: preview.previewAudioUrl,
      created: upsert.created,
      creditsUsed: PRIVATE_VOICE_PREVIEW_CREDIT_COST,
      creditBalance: updatedCreditBalance === -1 ? undefined : updatedCreditBalance,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not generate a voice preview.",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
