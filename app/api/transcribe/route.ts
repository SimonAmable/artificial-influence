import { experimental_transcribe as transcribe, NoTranscriptGeneratedError } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { createClient } from "@/lib/supabase/server"

const MAX_AUDIO_BYTES = 25 * 1024 * 1024

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      console.error("[transcribe] GROQ_API_KEY not set")
      return Response.json({ error: "Speech-to-text is not configured." }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const contentType = req.headers.get("content-type") ?? ""
    if (!contentType.includes("multipart/form-data")) {
      return Response.json({ error: "Expected multipart form data." }, { status: 400 })
    }

    const formData = await req.formData()
    const file = formData.get("audio") ?? formData.get("file")
    if (!(file instanceof Blob) || file.size === 0) {
      return Response.json({ error: "Missing or empty audio file." }, { status: 400 })
    }

    if (file.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: "Audio file is too large." }, { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const result = await transcribe({
      model: groq.transcription("whisper-large-v3-turbo"),
      audio: buffer,
    })

    return Response.json({
      text: result.text,
      language: result.language ?? undefined,
    })
  } catch (error) {
    if (NoTranscriptGeneratedError.isInstance(error)) {
      console.error("[transcribe] No transcript:", error.cause)
      return Response.json({ error: "Could not transcribe audio. Try again." }, { status: 422 })
    }

    console.error("[transcribe]", error)
    return Response.json({ error: "Transcription failed." }, { status: 500 })
  }
}
