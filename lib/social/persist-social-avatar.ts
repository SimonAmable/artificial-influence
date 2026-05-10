import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { DEFAULT_UPLOAD_BUCKET } from "@/lib/uploads/shared"

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

function sanitizeAccountIdForPath(raw: string): string {
  const s = raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128)
  return s.length > 0 ? s : "account"
}

function extFromMime(mime: string): string {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? ""
  if (base === "image/jpeg" || base === "image/jpg") return "jpg"
  if (base === "image/png") return "png"
  if (base === "image/webp") return "webp"
  if (base === "image/gif") return "gif"
  return "jpg"
}

/**
 * Downloads a provider avatar and stores it in Supabase public storage under a stable path
 * so the UI does not depend on expiring CDN/signed URLs from Meta or TikTok.
 */
export async function persistSocialAvatarUrl(params: {
  userId: string
  provider: "instagram" | "tiktok"
  accountId: string
  sourceUrl: string | null | undefined
}): Promise<string | null> {
  const source = params.sourceUrl?.trim()
  if (!source) {
    return null
  }

  const service = createServiceRoleClient()
  if (!service) {
    console.warn("[persist-social-avatar] SUPABASE_SERVICE_ROLE_KEY missing; skipping avatar persistence")
    return null
  }

  try {
    const res = await fetch(source, {
      redirect: "follow",
      cache: "no-store",
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; SocialConnect/1.0)",
      },
    })

    if (!res.ok) {
      console.warn("[persist-social-avatar] fetch failed:", res.status)
      return null
    }

    const lenHeader = res.headers.get("content-length")
    if (lenHeader) {
      const n = Number.parseInt(lenHeader, 10)
      if (Number.isFinite(n) && n > MAX_AVATAR_BYTES) {
        return null
      }
    }

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > MAX_AVATAR_BYTES) {
      return null
    }

    const mime =
      res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "image/jpeg"
    if (!mime.startsWith("image/")) {
      console.warn("[persist-social-avatar] response is not an image:", mime)
      return null
    }

    const ext = extFromMime(mime)
    const safeId = sanitizeAccountIdForPath(params.accountId)
    const path = `${params.userId}/social-avatars/${params.provider}/${safeId}.${ext}`

    const upload = await service.storage.from(DEFAULT_UPLOAD_BUCKET).upload(path, buf, {
      contentType: mime,
      upsert: true,
      cacheControl: "31536000",
    })

    if (upload.error) {
      console.warn("[persist-social-avatar] upload failed:", upload.error.message)
      return null
    }

    const { data } = service.storage.from(DEFAULT_UPLOAD_BUCKET).getPublicUrl(path)
    return data.publicUrl
  } catch (error) {
    console.warn("[persist-social-avatar] error:", error)
    return null
  }
}
