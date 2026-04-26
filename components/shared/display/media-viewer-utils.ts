"use client"

export type FullscreenMediaKind = "image" | "video"

export function normalizeMediaModelName(name: string | null | undefined): string {
  if (!name) return "Unknown model"

  const nameAfterSlash = name.includes("/") ? name.split("/").slice(1).join("/") : name

  return nameAfterSlash
    .replace(/\-/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function normalizeMediaToolName(
  tool: string | null | undefined,
  fallbackKind?: FullscreenMediaKind | string | null,
): string {
  const value = typeof tool === "string" && tool.trim() ? tool.trim() : null
  if (value) {
    return value
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }
  if (fallbackKind === "image") return "Image"
  if (fallbackKind === "video") return "Video"
  return "Unknown Tool"
}

export function formatMediaDate(dateString: string | null | undefined): string {
  if (!dateString) return "Unknown date"

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return "Unknown date"

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  if (diffDays === 0) return `Today at ${timeStr}`
  if (diffDays === 1) return `Yesterday at ${timeStr}`
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })
}

function extensionForBlob(kind: FullscreenMediaKind, mimeType: string): string {
  if (mimeType.includes("webm")) return "webm"
  if (mimeType.includes("quicktime")) return "mov"
  if (mimeType.includes("jpeg")) return "jpg"
  if (mimeType.includes("png")) return "png"
  if (mimeType.includes("webp")) return "webp"
  if (kind === "video") return "mp4"
  return "png"
}

export async function downloadMediaFile({
  url,
  kind,
  filenamePrefix,
}: {
  url: string
  kind: FullscreenMediaKind
  filenamePrefix?: string
}) {
  const prefix = filenamePrefix || (kind === "video" ? "generated-video" : "generated-image")

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error("Failed to fetch media for download")
    }

    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const extension = extensionForBlob(kind, blob.type)
    const anchor = document.createElement("a")
    anchor.href = blobUrl
    anchor.download = `${prefix}-${Date.now()}.${extension}`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.URL.revokeObjectURL(blobUrl)
  } catch {
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${prefix}-${Date.now()}${kind === "video" ? ".mp4" : ".png"}`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }
}

export async function copyMediaToClipboard({
  url,
  kind,
}: {
  url: string
  kind: FullscreenMediaKind
}): Promise<"media" | "url"> {
  if (kind === "image") {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error("Failed to fetch image for clipboard copy")
      }

      const blob = await response.blob()
      const canWriteImage =
        typeof navigator !== "undefined" &&
        Boolean(navigator.clipboard) &&
        typeof ClipboardItem !== "undefined" &&
        blob.type.startsWith("image/")

      if (canWriteImage) {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
        return "media"
      }
    } catch {
      // Fall through to URL copy.
    }
  }

  if (!navigator?.clipboard) {
    throw new Error("Clipboard not available")
  }

  await navigator.clipboard.writeText(url)
  return "url"
}
