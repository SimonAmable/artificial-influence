/** Make relative or path-only URLs absolute for fetch/validation. */
export function absolutizeAssetUrl(url: string, siteOrigin?: string | null): string {
  const trimmed = typeof url === "string" ? url.trim() : ""
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
    return trimmed
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  if (trimmed.startsWith("/storage/v1/") && supabaseUrl) {
    return `${supabaseUrl}${trimmed}`
  }

  const origin = (siteOrigin || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")
  if (trimmed.startsWith("/") && origin) {
    return `${origin}${trimmed}`
  }

  return trimmed
}
