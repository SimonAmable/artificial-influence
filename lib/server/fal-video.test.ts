import assert from "node:assert/strict"

const {
  buildFalVideoRequest,
  FAL_HAPPY_HORSE_I2V,
  FAL_HAPPY_HORSE_REFERENCE,
  FAL_HAPPY_HORSE_T2V,
  HAPPY_HORSE_CANONICAL_ID,
} = await import(new URL("./fal-video.ts", import.meta.url).href)

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

runTest("Happy Horse routes prompt-only generations to text-to-video", () => {
  const result = buildFalVideoRequest({
    aspectRatio: "9:16",
    duration: 6,
    modelIdentifier: HAPPY_HORSE_CANONICAL_ID,
    prompt: "A dancer under neon lights",
    referenceImageUrls: [],
    resolution: "720p",
  })

  assert.equal(result.endpointId, FAL_HAPPY_HORSE_T2V)
  assert.equal(result.mode, "text-to-video")
  assert.equal(result.input.prompt, "A dancer under neon lights")
  assert.equal(result.input.aspect_ratio, "9:16")
  assert.equal(result.input.resolution, "720p")
  assert.ok(!("image_url" in result.input))
  assert.ok(!("image_urls" in result.input))
})

runTest("Happy Horse routes single-image generations to image-to-video", () => {
  const result = buildFalVideoRequest({
    duration: 5,
    imageUrl: "https://example.com/start.png",
    modelIdentifier: HAPPY_HORSE_CANONICAL_ID,
    prompt: null,
    referenceImageUrls: [],
    resolution: "1080p",
  })

  assert.equal(result.endpointId, FAL_HAPPY_HORSE_I2V)
  assert.equal(result.mode, "image-to-video")
  assert.equal(result.input.image_url, "https://example.com/start.png")
  assert.ok(!("aspect_ratio" in result.input))
  assert.ok(!("prompt" in result.input))
})

runTest("Happy Horse reference mode wins over start frame and trims to nine images", () => {
  const result = buildFalVideoRequest({
    aspectRatio: "4:3",
    duration: "7",
    imageUrl: "https://example.com/start.png",
    modelIdentifier: HAPPY_HORSE_CANONICAL_ID,
    prompt: "character1 and character2 walk through a sunlit market",
    referenceImageUrls: [
      "https://example.com/ref-1.png",
      "https://example.com/ref-2.png",
      "https://example.com/ref-3.png",
      "https://example.com/ref-4.png",
      "https://example.com/ref-5.png",
      "https://example.com/ref-6.png",
      "https://example.com/ref-7.png",
      "https://example.com/ref-8.png",
      "https://example.com/ref-9.png",
      "https://example.com/ref-10.png",
    ],
  })

  assert.equal(result.endpointId, FAL_HAPPY_HORSE_REFERENCE)
  assert.equal(result.mode, "reference-to-video")
  assert.equal(result.input.aspect_ratio, "4:3")
  assert.deepEqual(result.input.image_urls, [
    "https://example.com/ref-1.png",
    "https://example.com/ref-2.png",
    "https://example.com/ref-3.png",
    "https://example.com/ref-4.png",
    "https://example.com/ref-5.png",
    "https://example.com/ref-6.png",
    "https://example.com/ref-7.png",
    "https://example.com/ref-8.png",
    "https://example.com/ref-9.png",
  ])
  assert.ok(!("image_url" in result.input))
})
