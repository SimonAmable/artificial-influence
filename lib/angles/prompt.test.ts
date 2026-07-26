import assert from "node:assert/strict"

const { buildAnglesPrompt, buildCameraPromptSpec } = await import(
  new URL("./prompt.ts", import.meta.url).href
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

runTest("camera description maps cardinal angles", () => {
  assert.equal(
    buildCameraPromptSpec({ rotation: 270, tilt: -30, zoom: 10 }).viewDescription,
    "left profile, low-angle view, close framing",
  )
})

runTest("Nano Banana Lite prompt is deterministic JSON with numeric camera values", () => {
  const prompt = buildAnglesPrompt("google/nano-banana-2-lite", {
    rotation: 45,
    tilt: 20,
    zoom: 8,
  })
  const parsed = JSON.parse(prompt)
  assert.deepEqual(parsed.camera, {
    rotation_degrees: 45,
    tilt_degrees: 20,
    zoom_level: 8,
    view: "front-right three-quarter view, high-angle view, close framing",
  })
})

runTest("other models receive a concise camera instruction", () => {
  const prompt = buildAnglesPrompt("openai/gpt-image-2", {
    rotation: 90,
    tilt: 0,
    zoom: 5,
  })
  assert.match(prompt, /90 degrees rotation/)
  assert.match(prompt, /right profile/)
})
