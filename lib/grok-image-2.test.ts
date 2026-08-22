import assert from "node:assert/strict"

const {
  formatGrokImage2QualityLabel,
  formatGrokImage2ThinkingLabel,
  isGrokImage2Identifier,
  normalizeGrokImage2Quality,
  normalizeGrokImage2Resolution,
  resolveXaiImageQuality,
} = await import(new URL("./grok-image-2.ts", import.meta.url).href)

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

runTest("identifies Grok Image 2", () => {
  assert.equal(isGrokImage2Identifier("xai/grok-imagine-image-2.0"), true)
  assert.equal(isGrokImage2Identifier("openai/gpt-image-2"), false)
})

runTest("thinking maps onto the xAI quality field", () => {
  assert.equal(normalizeGrokImage2Quality("low"), "low")
  assert.equal(normalizeGrokImage2Quality("off"), "low")
  assert.equal(normalizeGrokImage2Quality("medium"), "medium")
  assert.equal(normalizeGrokImage2Quality("on"), "medium")
  assert.equal(normalizeGrokImage2Quality("high"), "medium")
})

runTest("quality select maps onto resolution", () => {
  assert.equal(normalizeGrokImage2Resolution("1k"), "1k")
  assert.equal(normalizeGrokImage2Resolution("2k"), "2k")
  assert.equal(normalizeGrokImage2Resolution("4k"), "1k")
})

runTest("select labels stay split", () => {
  assert.equal(formatGrokImage2ThinkingLabel("low"), "Off")
  assert.equal(formatGrokImage2ThinkingLabel("medium"), "On")
  assert.equal(formatGrokImage2QualityLabel("1k"), "1K")
  assert.equal(formatGrokImage2QualityLabel("2k"), "2K")
})

runTest("Grok Image 2 never sends quality high", () => {
  assert.equal(resolveXaiImageQuality("xai/grok-imagine-image-2.0", "high"), "medium")
  assert.equal(resolveXaiImageQuality("xai/grok-imagine-image-2.0", null), "low")
  assert.equal(resolveXaiImageQuality("xai/grok-imagine-image", "high"), "high")
})
