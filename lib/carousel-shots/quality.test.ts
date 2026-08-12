import assert from "node:assert/strict"

import {
  getCarouselFastQualityParams,
  getCarouselGenerationQualityParams,
  getCarouselHdQualityParams,
  getCarouselReplicateResolution,
} from "@/lib/carousel-shots/quality"

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

runTest("fast mode uses highest quality per model", () => {
  assert.deepEqual(getCarouselFastQualityParams("openai/gpt-image-2"), { quality: "high" })
  assert.deepEqual(getCarouselFastQualityParams("google/nano-banana-2"), { resolution: "4k" })
  assert.deepEqual(getCarouselFastQualityParams("bytedance/seedream-4.5"), {
    resolutionPreset: "4K",
  })
  assert.deepEqual(getCarouselFastQualityParams("bytedance/seedream-5-lite"), {
    resolutionPreset: "3K",
  })
  assert.deepEqual(getCarouselFastQualityParams("bytedance/seedream-5-pro"), {
    resolutionPreset: "2K",
  })
})

runTest("hd mode uses lowest quality per model", () => {
  assert.deepEqual(getCarouselHdQualityParams("openai/gpt-image-2"), { quality: "low" })
  assert.deepEqual(getCarouselHdQualityParams("google/nano-banana-2"), { resolution: "1k" })
  assert.deepEqual(getCarouselHdQualityParams("bytedance/seedream-4.5"), {
    resolutionPreset: "2K",
  })
  assert.deepEqual(getCarouselHdQualityParams("bytedance/seedream-5-lite"), {
    resolutionPreset: "2K",
  })
  assert.deepEqual(getCarouselHdQualityParams("bytedance/seedream-5-pro"), {
    resolutionPreset: "1K",
  })
})

runTest("generation mode selects the correct quality profile", () => {
  assert.deepEqual(
    getCarouselGenerationQualityParams("fast", "openai/gpt-image-2"),
    { quality: "high" },
  )
  assert.deepEqual(
    getCarouselGenerationQualityParams("hd", "openai/gpt-image-2"),
    { quality: "low" },
  )
})

runTest("replicate resolution follows generation mode", () => {
  assert.equal(getCarouselReplicateResolution("fast", "google/nano-banana-2"), "4K")
  assert.equal(getCarouselReplicateResolution("hd", "google/nano-banana-2"), "1K")
})
