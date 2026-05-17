/**
 * TikTok Direct Post needs the `video.publish` scope. Gate server + UI until the app is approved.
 * Set `TIKTOK_DIRECT_POST_ENABLED=true` and `NEXT_PUBLIC_TIKTOK_DIRECT_POST_ENABLED=true` to turn on.
 */
export function isTikTokDirectPostFeatureEnabled(): boolean {
  return (
    process.env.TIKTOK_DIRECT_POST_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_TIKTOK_DIRECT_POST_ENABLED === "true"
  )
}
