import assert from "node:assert/strict"
import { buildGenjutsuFalRequest } from "./request"
import { resolveGenjutsuDuration } from "./duration"
import { buildGenjutsuPrompt, editOverridesClothing } from "./prompt"

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

runTest("empty edit cites Image 1 and Video 1 without a feature list", () => {
  const prompt = buildGenjutsuPrompt(1, "")
  assert.match(prompt, /Image 1/)
  assert.match(prompt, /Video 1/)
  assert.match(prompt, /identity preserved/i)
  assert.match(prompt, /clothing, background, and lighting come only from Video 1/)
  assert.doesNotMatch(prompt, /Edit:/)
  assert.doesNotMatch(prompt, /makeup|eyeliner|tattoo|freckles/i)
})

runTest("extra images are the same person", () => {
  const prompt = buildGenjutsuPrompt(3, null)
  assert.match(prompt, /Image 1 through Image 3/)
  assert.match(prompt, /same person/)
})

runTest("a clothing edit drops the clothing lock and keeps the edit", () => {
  const edit = "use her red jacket from the sheet"
  assert.equal(editOverridesClothing(edit), true)
  const prompt = buildGenjutsuPrompt(1, edit)
  assert.match(prompt, /Clothing named in the edit comes from the character images/)
  assert.doesNotMatch(prompt, /clothing, background, and lighting come only from Video 1/)
  assert.match(prompt, /Edit: use her red jacket from the sheet/)
  assert.match(prompt, /Video 1/)
})

runTest("a named subject stays in the prompt", () => {
  const prompt = buildGenjutsuPrompt(1, "Replace only the driver")
  assert.match(prompt, /Edit: Replace only the driver/)
  assert.match(prompt, /Image 1/)
  assert.match(prompt, /clothing, background, and lighting come only from Video 1/)
})

runTest("Genjutsu sends reference-to-video without a start frame or prompt expansion", () => {
  const result = buildGenjutsuFalRequest({
    durationSeconds: 8.4,
    prompt: buildGenjutsuPrompt(1, ""),
    referenceImageUrls: ["https://example.com/character.png"],
    referenceVideoUrl: "https://example.com/motion.mp4",
  })

  assert.equal(result.endpointId, "alibaba/wan-3.0/reference-to-video")
  assert.equal(result.mode, "reference-to-video")
  assert.equal(result.input.duration, 8)
  assert.equal(result.input.enable_prompt_expansion, false)
  assert.equal(result.input.audio, false)
  assert.equal(result.input.aspect_ratio, "adaptive")
  assert.equal(result.input.resolution, "720p")
  assert.equal(result.input.start_image_url, undefined)
  assert.deepEqual(result.input.reference_image_urls, ["https://example.com/character.png"])
  assert.deepEqual(result.input.reference_video_urls, ["https://example.com/motion.mp4"])
})

runTest("clips longer than 15 seconds are rejected", () => {
  assert.throws(() => resolveGenjutsuDuration(16), /15 seconds/)
  assert.equal(resolveGenjutsuDuration(1.2), 2)
  assert.equal(resolveGenjutsuDuration(15), 15)
})
