import assert from "node:assert/strict"
import {
  extractFalImageUrls,
  extractFalVideoUrl,
  isFalRequestNotFoundError,
} from "./fal-output.ts"

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

runTest("extractFalImageUrls reads images[].url", () => {
  assert.deepEqual(
    extractFalImageUrls({
      images: [{ url: "https://example.com/a.png" }, { url: "https://example.com/b.png" }],
    }),
    ["https://example.com/a.png", "https://example.com/b.png"],
  )
})

runTest("extractFalImageUrls falls back to image.url", () => {
  assert.deepEqual(extractFalImageUrls({ image: { url: "https://example.com/solo.png" } }), [
    "https://example.com/solo.png",
  ])
})

runTest("extractFalVideoUrl reads video.url", () => {
  assert.equal(extractFalVideoUrl({ video: { url: "https://example.com/out.mp4" } }), "https://example.com/out.mp4")
})

runTest("isFalRequestNotFoundError matches Fal client message", () => {
  assert.equal(isFalRequestNotFoundError("Request not found"), true)
  assert.equal(isFalRequestNotFoundError("Fal API error (500)."), false)
})
