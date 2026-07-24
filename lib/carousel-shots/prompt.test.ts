import assert from "node:assert/strict"

import { buildCarouselShotsPrompt } from "@/lib/carousel-shots/prompt"

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
