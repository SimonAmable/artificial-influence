import { NextResponse } from "next/server"

import {
  normalizeTikTokVideoBuffer,
  TIKTOK_COMPATIBILITY_PROFILE,
  TIKTOK_COMPATIBLE_MIME_TYPE,
} from "@/lib/tiktok/normalize-video"

export const maxDuration = 300

function encodeFileName(fileName: string) {
  return encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, "%2A")
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const entry = formData.get("file")

    if (!(entry instanceof File)) {
      return NextResponse.json({ error: "Attach a video file first." }, { status: 400 })
    }

    if (!entry.type.startsWith("video/")) {
      return NextResponse.json({ error: "Only video uploads are supported." }, { status: 400 })
    }

    const normalized = await normalizeTikTokVideoBuffer({
      bytes: await entry.arrayBuffer(),
      fileName: entry.name || "video.mp4",
    })

    return new NextResponse(new Uint8Array(normalized.buffer), {
      status: 200,
      headers: {
        "Content-Type": TIKTOK_COMPATIBLE_MIME_TYPE,
        "Content-Length": String(normalized.buffer.byteLength),
        "Content-Disposition": `attachment; filename="${normalized.fileName}"; filename*=UTF-8''${encodeFileName(normalized.fileName)}`,
        "X-TikTok-Compatibility-Profile": TIKTOK_COMPATIBILITY_PROFILE,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not convert the video."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
