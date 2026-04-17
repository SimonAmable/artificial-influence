import { NextResponse } from "next/server"
import type { Caption } from "@remotion/captions"
import { createClient } from "@/lib/supabase/server"

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions"

type GroqVerboseSegment = {
  start: number
  end: number
  text: string
}

type GroqVerboseResponse = {
  text?: string
  segments?: GroqVerboseSegment[]
  words?: { word: string; start: number; end: number }[]
}

function segmentsToCaptions(segments: GroqVerboseSegment[]): Caption[] {
  const out: Caption[] = []
  for (const seg of segments) {
    const text = seg.text.trim()
    if (!text) continue
    const startMs = Math.round(seg.start * 1000)
    const endMs = Math.round(seg.end * 1000)
    out.push({
      text,
      startMs,
      endMs,
      timestampMs: startMs,
      confidence: null,
    })
  }
  return out
}

export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 })
  }
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const contentType = req.headers.get("content-type") ?? ""
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get("audio") ?? formData.get("file")
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 })
  }

  const groqForm = new FormData()
  groqForm.append("file", file, "audio.mp3")
  groqForm.append("model", "whisper-large-v3-turbo")
  groqForm.append("response_format", "verbose_json")
  groqForm.append("timestamp_granularities[]", "segment")

  const res = await fetch(GROQ_TRANSCRIBE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: groqForm,
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error("[editor/transcribe]", res.status, errText)
    return NextResponse.json({ error: "Transcription failed" }, { status: 502 })
  }

  const data = (await res.json()) as GroqVerboseResponse
  const segments = data.segments ?? []
  const captions = segmentsToCaptions(segments)

  return NextResponse.json({
    text: data.text ?? "",
    captions,
  })
}
