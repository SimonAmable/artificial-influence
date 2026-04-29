import { assertSafeHttpUrl } from "@/lib/server/web-research/url-safety"

type ExpectedKind = "image" | "video" | "audio"

type ValidateExternalReferenceUrlOptions = {
  url: string
  expectedKind: ExpectedKind
  maxContentLengthBytes?: number
}

function contentTypeMatches(expectedKind: ExpectedKind, contentType: string | null) {
  if (!contentType) return true
  return contentType.toLowerCase().startsWith(`${expectedKind}/`)
}

export async function validateExternalReferenceUrl({
  url,
  expectedKind,
  maxContentLengthBytes,
}: ValidateExternalReferenceUrlOptions) {
  const safeUrl = await assertSafeHttpUrl(url.trim())

  try {
    const headResponse = await fetch(safeUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    })

    if (headResponse.ok) {
      const finalUrl = await assertSafeHttpUrl(headResponse.url)
      const contentType = headResponse.headers.get("content-type")?.split(";")[0]?.trim() ?? null

      if (!contentTypeMatches(expectedKind, contentType)) {
        throw new Error(`Expected ${expectedKind} URL but got ${contentType || "unknown content type"}.`)
      }

      const contentLength = Number(headResponse.headers.get("content-length") ?? "")
      if (
        typeof maxContentLengthBytes === "number" &&
        Number.isFinite(contentLength) &&
        contentLength > maxContentLengthBytes
      ) {
        throw new Error(`Reference file is too large for ${expectedKind} generation.`)
      }

      return finalUrl
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("Expected ") || error.message.includes("too large"))
    ) {
      throw error
    }
  }

  return safeUrl
}
