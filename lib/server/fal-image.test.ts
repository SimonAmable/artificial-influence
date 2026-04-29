import assert from "node:assert/strict"

const {
  buildFalImageRequest,
  FAL_WAN_27_PRO_EDIT,
  FAL_WAN_27_PRO_T2I,
  WAN_27_PRO_IMAGE_CANONICAL_ID,
} = await import(new URL("./fal-image.ts", import.meta.url).href)

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

runTest("Wan 2.7 Pro routes prompt-only generations to text-to-image", () => {
  const result = buildFalImageRequest({
    aspectRatio: "16:9",
    enablePromptExpansion: true,
    modelIdentifier: WAN_27_PRO_IMAGE_CANONICAL_ID,
    numImages: 3,
    prompt: "A polished product photo of a watch on marble",
    referenceImageUrls: [],
  })

  assert.equal(result.endpointId, FAL_WAN_27_PRO_T2I)
  assert.equal(result.resolvedAspectRatio, "16:9")
  assert.equal(result.input.max_images, 3)
  assert.equal(result.input.image_size, "landscape_16_9")
  assert.ok(!("image_urls" in result.input))
  assert.ok(!("num_images" in result.input))
})

runTest("Wan 2.7 Pro routes referenced generations to edit", () => {
  const result = buildFalImageRequest({
    aspectRatio: null,
    enablePromptExpansion: false,
    modelIdentifier: WAN_27_PRO_IMAGE_CANONICAL_ID,
    numImages: 2,
    prompt: "Turn image 1 into a clean studio portrait",
    referenceImageUrls: ["https://example.com/ref-1.png"],
  })

  assert.equal(result.endpointId, FAL_WAN_27_PRO_EDIT)
  assert.equal(result.resolvedAspectRatio, "match_input_image")
  assert.deepEqual(result.input.image_urls, ["https://example.com/ref-1.png"])
  assert.equal(result.input.num_images, 2)
  assert.equal(result.input.enable_prompt_expansion, false)
  assert.ok(!("max_images" in result.input))
})

runTest("Wan 2.7 Pro edit trims references to four images", () => {
  const result = buildFalImageRequest({
    aspectRatio: "4:3",
    enablePromptExpansion: true,
    modelIdentifier: WAN_27_PRO_IMAGE_CANONICAL_ID,
    numImages: 1,
    prompt: "Blend the references into one scene",
    referenceImageUrls: [
      "https://example.com/ref-1.png",
      "https://example.com/ref-2.png",
      "https://example.com/ref-3.png",
      "https://example.com/ref-4.png",
      "https://example.com/ref-5.png",
    ],
  })

  assert.equal(result.endpointId, FAL_WAN_27_PRO_EDIT)
  assert.equal(result.input.image_size, "landscape_4_3")
  assert.deepEqual(result.input.image_urls, [
    "https://example.com/ref-1.png",
    "https://example.com/ref-2.png",
    "https://example.com/ref-3.png",
    "https://example.com/ref-4.png",
  ])
})
