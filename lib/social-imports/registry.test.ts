import assert from "node:assert/strict"
import { detectSocialPlatformFromUrl, resolveSocialImportAdapter } from "./registry.ts"

assert.equal(detectSocialPlatformFromUrl("https://www.tiktok.com/@user/video/123"), "tiktok")
assert.equal(
  detectSocialPlatformFromUrl("https://www.instagram.com/reel/abc123/"),
  "instagram",
)

const threads = resolveSocialImportAdapter("https://www.threads.net/@user/post/abc")
assert.equal(threads.adapter.platform, "threads")

const redgifsFile = resolveSocialImportAdapter("https://i.redgifs.com/i/criticalmediummangabey.jpg")
assert.equal(redgifsFile.adapter.platform, "direct")

const redgifsWatch = resolveSocialImportAdapter("https://www.redgifs.com/watch/exampleid")
assert.equal(redgifsWatch.adapter.platform, "redgifs")

const instagram = resolveSocialImportAdapter("https://www.instagram.com/p/ABC123xyz/")
assert.equal(instagram.adapter.platform, "instagram")

console.log("social imports registry tests passed")