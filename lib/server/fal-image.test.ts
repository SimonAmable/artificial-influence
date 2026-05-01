import assert from "node:assert/strict"

const {
  buildFalImageRequest,
  FAL_OPENAI_GPT_IMAGE_2_EDIT,
  FAL_OPENAI_GPT_IMAGE_2_T2I,
  FAL_WAN_27_PRO_EDIT,
  FAL_WAN_27_PRO_T2I,
  OPENAI_GPT_IMAGE_2_CANONICAL_ID,
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

runTest("GPT Image 2 routes prompt-only generations to Fal text-to-image", () => {
  const result = buildFalImageRequest({
    aspectRatio: "16:9",
    modelIdentifier: OPENAI_GPT_IMAGE_2_CANONICAL_ID,
    numImages: 2,
    prompt: "A clean product hero shot with headline text",
    quality: "medium",
    referenceImageUrls: [],
  })

  assert.equal(result.endpointId, FAL_OPENAI_GPT_IMAGE_2_T2I)
  assert.equal(result.resolvedAspectRatio, "16:9")
  assert.equal(result.input.quality, "medium")
  assert.equal(result.input.num_images, 2)
  assert.equal(result.input.image_size, "landscape_16_9")
  assert.ok(!("image_urls" in result.input))
})

runTest("GPT Image 2 routes referenced generations to Fal edit and preserves match-input sizing", () => {
  const result = buildFalImageRequest({
    aspectRatio: null,
    modelIdentifier: OPENAI_GPT_IMAGE_2_CANONICAL_ID,
    numImages: 1,
    prompt: "Change the shirt color but keep the pose and lighting identical",
    referenceImageUrls: ["https://example.com/ref-1.png"],
  })

  assert.equal(result.endpointId, FAL_OPENAI_GPT_IMAGE_2_EDIT)
  assert.equal(result.resolvedAspectRatio, "match_input_image")
  assert.equal(result.input.image_size, "auto")
  assert.deepEqual(result.input.image_urls, ["https://example.com/ref-1.png"])
})

runTest("GPT Image 2 maps wide custom ratios to explicit dimensions", () => {
  const result = buildFalImageRequest({
    aspectRatio: "21:9",
    modelIdentifier: OPENAI_GPT_IMAGE_2_CANONICAL_ID,
    numImages: 1,
    prompt: "An ultra-wide futuristic city skyline at blue hour",
    referenceImageUrls: [],
  })

  assert.equal(result.endpointId, FAL_OPENAI_GPT_IMAGE_2_T2I)
  assert.deepEqual(result.input.image_size, {
    width: 1344,
    height: 576,
  })
})
