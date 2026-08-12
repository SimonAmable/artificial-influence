import assert from "node:assert/strict"

import { buildCarouselHdShotPrompt, buildCarouselShotsPrompt } from "@/lib/carousel-shots/prompt"

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

runTest("prompt includes panel count and variation strength", () => {
  const prompt = buildCarouselShotsPrompt({ gridSize: 9, variationStrength: "creative" })
  assert.match(prompt, /9/)
  assert.match(prompt, /3×3|3x3/i)
  assert.match(prompt, /expressive/i)
})

runTest("subtle variation uses minimal change language", () => {
  const prompt = buildCarouselShotsPrompt({ gridSize: 4, variationStrength: "subtle" })
  assert.match(prompt, /minimal/i)
})

runTest("custom variation uses provided text", () => {
  const prompt = buildCarouselShotsPrompt({
    gridSize: 4,
    variationStrength: "custom",
    customVariation: "Rotate the camera 15 degrees left each panel",
  })
  assert.match(prompt, /Rotate the camera 15 degrees left each panel/)
})

runTest("per-shot variation instructions are included in contact sheet prompt", () => {
  const prompt = buildCarouselShotsPrompt({
    gridSize: 4,
    variationStrength: "custom",
    perShotVariations: ["Wave at camera", "", "Look over shoulder", "Smile wider"],
  })
  assert.match(prompt, /Panel 1: Wave at camera/)
  assert.match(prompt, /Panel 3: Look over shoulder/)
  assert.doesNotMatch(prompt, /Panel 2:/)
})

runTest("hd shot prompt includes shot index and custom variation", () => {
  const prompt = buildCarouselHdShotPrompt({
    shotIndex: 1,
    shotCount: 5,
    variationStrength: "custom",
    customVariation: "Slight zoom in",
  })
  assert.match(prompt, /shot 2 of 5/i)
  assert.match(prompt, /Slight zoom in/)
})

runTest("hd per-shot variation overrides general custom text", () => {
  const prompt = buildCarouselHdShotPrompt({
    shotIndex: 0,
    shotCount: 3,
    variationStrength: "custom",
    customVariation: "General variation",
    perShotVariation: "Arms crossed",
  })
  assert.match(prompt, /Arms crossed/)
  assert.doesNotMatch(prompt, /General variation/)
})
