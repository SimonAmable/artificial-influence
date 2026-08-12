import { isPresenceProduct } from "@/lib/product/require-presence"

export function buildGenerationHistoryDeepLink(generationId: string, baseUrl: string): string {
  const origin = baseUrl.replace(/\/$/, "")
  const params = new URLSearchParams({ generation: generationId })

  if (isPresenceProduct()) {
    params.set("tab", "media")
    return `${origin}/content?${params.toString()}`
  }

  params.set("tab", "history")
  return `${origin}/assets?${params.toString()}`
}
