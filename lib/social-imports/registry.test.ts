import assert from "node:assert/strict"
import { detectSocialPlatformFromUrl, resolveSocialImportAdapter } from "./registry.ts"

assert.equal(detectSocialPlatformFromUrl("https://www.tiktok.com/@user/video/123"), "tiktok")
assert.equal(
  detectSocialPlatformFromUrl("https://www.instagram.com/reel/abc123/"),
  "instagram",
)

const threads = resolveSocialImportAdapter("https://www.threads.net/@user/post/abc")
assert.equal(threads.adapter.platform, "threads")

console.log("social imports registry tests passed")