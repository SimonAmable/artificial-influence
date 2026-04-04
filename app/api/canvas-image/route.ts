import { NextRequest, NextResponse } from "next/server"

function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === "localhost" || host === "127.0.0.1") return true

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl) {
    try {
      if (host === new URL(supabaseUrl).hostname) return true
    } catch {
      /* ignore */
    }
  }
  if (host.endsWith(".supabase.co")) return true
  if (host === "replicate.delivery" || host.endsWith(".replicate.delivery")) return true
  if (host.endsWith(".public.blob.vercel-storage.com")) return true
  if (host === "fal.media" || host.endsWith(".fal.media")) return true
  if (host === "fal.run" || host.endsWith(".fal.run")) return true
  return false
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")
  if (!raw?.trim()) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 })
  }

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }

  if (target.protocol !== "https:" && !(target.protocol === "http:" && isAllowedImageHost(target.hostname))) {
    return NextResponse.json({ error: "URL scheme not allowed" }, { status: 400 })
  }

  if (!isAllowedImageHost(target.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 })
  }

  let upstream: Response
  try {
    upstream = await fetch(target.toString(), {
      redirect: "follow",
      headers: { Accept: "image/*,*/*" },
      next: { revalidate: 300 },
    })
  } catch (e) {
    console.error("[canvas-image] fetch failed:", e)
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 })
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Upstream returned error", status: upstream.status },
      { status: 502 }
    )
  }

  const rawType = upstream.headers.get("content-type") || ""
  const baseType = rawType.split(";")[0]?.trim() || ""
  const contentType = baseType.startsWith("image/") ? baseType : "image/png"

  const buf = await upstream.arrayBuffer()
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
    },
  })
}
