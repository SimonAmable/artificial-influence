import assert from "node:assert/strict"

const { resolveXaiAspectRatio } = await import(
  new URL("./xai-aspect-ratio.ts", import.meta.url).href
)

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

runTest("passes through supported ratios", () => {
  assert.equal(resolveXaiAspectRatio("9:16"), "9:16")
  assert.equal(resolveXaiAspectRatio("1:1"), "1:1")
  assert.equal(resolveXaiAspectRatio("19.5:9"), "19.5:9")
})

runTest("maps match_input_image to auto", () => {
  assert.equal(resolveXaiAspectRatio("match_input_image"), "auto")
  assert.equal(resolveXaiAspectRatio("auto"), "auto")
})

runTest("snaps contact-sheet ratios to nearest allowed value", () => {
  // 167:295 ≈ 0.566 — closest to 9:16 (0.5625)
  assert.equal(resolveXaiAspectRatio("167:295"), "9:16")
})

runTest("snaps unsupported panel ratios used by shots HD mode", () => {
  // 4:5 = 0.8 — closer to 3:4 (0.75) than 2:3 (≈0.667)
  assert.equal(resolveXaiAspectRatio("4:5"), "3:4")
})

runTest("returns undefined for empty or invalid input", () => {
  assert.equal(resolveXaiAspectRatio(null), undefined)
  assert.equal(resolveXaiAspectRatio(""), undefined)
  assert.equal(resolveXaiAspectRatio("square"), undefined)
})
