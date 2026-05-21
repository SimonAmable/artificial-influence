import { NextResponse } from "next/server"

import { isAllowedTikTokStreamSourceUrl } from "@/lib/tiktok/playback-url"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const TIKTOK_REFERER = "https://www.tiktok.com/"

function buildUpstreamHeaders(sourceUrl: string, range: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  }

  if (sourceUrl.includes("tiktokcdn") || sourceUrl.includes("tiktokv.")) {
    headers.Referer = TIKTOK_REFERER
  }

  if (sourceUrl.includes("api.apify.com")) {
    const apifyToken = process.env.APIFY_API_TOKEN?.trim()
    if (apifyToken) {
      headers.Authorization = `Bearer ${apifyToken}`
    }
  }

  if (range) {
    headers.Range = range
  }

  return headers
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Sign in to preview TikTok media." }, { status: 401 })
    }

    const sourceUrl = new URL(request.url).searchParams.get("url")?.trim()
    if (!sourceUrl || !isAllowedTikTokStreamSourceUrl(sourceUrl)) {
      return NextResponse.json({ error: "Invalid or disallowed media URL." }, { status: 400 })
    }

    const range = request.headers.get("range")
    const upstream = await fetch(sourceUrl, {
      headers: buildUpstreamHeaders(sourceUrl, range),
      cache: "no-store",
    })

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `Could not load video (${upstream.status}).` },
        { status: upstream.status === 403 || upstream.status === 404 ? upstream.status : 502 },
      )
    }

    const responseHeaders = new Headers()
    for (const key of ["content-type", "content-length", "accept-ranges", "content-range"] as const) {
      const value = upstream.headers.get(key)
      if (value) {
        responseHeaders.set(key, value)
      }
    }
    if (!responseHeaders.has("content-type")) {
      responseHeaders.set("content-type", "video/mp4")
    }
    responseHeaders.set("Cache-Control", "private, max-age=600")

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stream failed."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
