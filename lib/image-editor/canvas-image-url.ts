/**
 * Fabric/canvas loads with crossOrigin "anonymous" require CORS on the image host.
 * Many storage CDNs block that for anonymous canvas use. Proxying through our origin
 * fixes loading while keeping the canvas exportable.
 */
export function resolveImageUrlForFabric(imageUrl: string): string {
  if (!imageUrl || imageUrl.startsWith("data:") || imageUrl.startsWith("blob:")) {
    return imageUrl
  }
  if (typeof window === "undefined") {
    return imageUrl
  }
  try {
    const parsed = new URL(imageUrl, window.location.href)
    if (parsed.origin === window.location.origin) {
      return imageUrl
    }
  } catch {
    return imageUrl
  }
  const params = new URLSearchParams({ url: imageUrl })
  return `/api/canvas-image?${params.toString()}`
}
