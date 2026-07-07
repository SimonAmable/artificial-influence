import assert from "node:assert/strict"

const {
  buildFalImageRequest,
  coerceWanImagePrompt,
  FAL_OPENAI_GPT_IMAGE_2_EDIT,
  FAL_OPENAI_GPT_IMAGE_2_T2I,
  FAL_SEEDREAM_4_5_EDIT,
  FAL_SEEDREAM_4_5_T2I,
  FAL_SEEDREAM_5_LITE_EDIT,
  FAL_SEEDREAM_5_LITE_T2I,
  FAL_NANO_BANANA_2_LITE_EDIT,
  FAL_NANO_BANANA_2_LITE_T2I,
  FAL_WAN_27_PRO_EDIT,
  FAL_WAN_27_PRO_T2I,
  NANO_BANANA_2_LITE_CANONICAL_ID,
  OPENAI_GPT_IMAGE_2_CANONICAL_ID,
  SEEDREAM_4_5_CANONICAL_ID,
  SEEDREAM_5_LITE_CANONICAL_ID,
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

runTest("coerceWanImagePrompt extracts summary string from pasted JSON", () => {
  const coerced = coerceWanImagePrompt(`{ "summary": "plain grey wall, flash aesthetic", "meta": true }`)
  assert.equal(coerced, "plain grey wall, flash aesthetic")
})

runTest("Wan 2.7 Pro edit disables prompt expansion when prompt exceeds expansion threshold", () => {
  const long = "x".repeat(3501)
  const result = buildFalImageRequest({
    aspectRatio: null,
    enablePromptExpansion: true,
    modelIdentifier: WAN_27_PRO_IMAGE_CANONICAL_ID,
    numImages: 1,
    outputFormat: "png",
    prompt: long,
    referenceImageUrls: ["https://example.com/ref-1.png"],
  })
  assert.equal(result.input.enable_prompt_expansion, false)
})

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

runTest("Seedream 4.5 routes prompt-only generations to Fal text-to-image with safety checker off", () => {
  const result = buildFalImageRequest({
    aspectRatio: "16:9",
    modelIdentifier: SEEDREAM_4_5_CANONICAL_ID,
    numImages: 2,
    prompt: "A polished perfume ad with crisp headline text",
    referenceImageUrls: [],
    resolutionPreset: "4K",
  })

  assert.equal(result.endpointId, FAL_SEEDREAM_4_5_T2I)
  assert.equal(result.input.image_size, "auto_4K")
  assert.equal(result.input.num_images, 2)
  assert.equal(result.input.enable_safety_checker, false)
  assert.ok(!("image_urls" in result.input))
})

runTest("Seedream 4.5 routes referenced generations to Fal edit", () => {
  const result = buildFalImageRequest({
    aspectRatio: null,
    modelIdentifier: SEEDREAM_4_5_CANONICAL_ID,
    numImages: 1,
    prompt: "Replace the product in Figure 1 with that in Figure 2",
    referenceImageUrls: [
      "https://example.com/ref-1.png",
      "https://example.com/ref-2.png",
    ],
  })

  assert.equal(result.endpointId, FAL_SEEDREAM_4_5_EDIT)
  assert.equal(result.resolvedAspectRatio, "match_input_image")
  assert.equal(result.input.image_size, "auto_2K")
  assert.deepEqual(result.input.image_urls, [
    "https://example.com/ref-1.png",
    "https://example.com/ref-2.png",
  ])
  assert.equal(result.input.enable_safety_checker, false)
})

runTest("Seedream 5 Lite supports 3K preset and trims references to ten images", () => {
  const references = Array.from({ length: 12 }, (_, index) => `https://example.com/ref-${index + 1}.png`)
  const result = buildFalImageRequest({
    aspectRatio: "1:1",
    modelIdentifier: SEEDREAM_5_LITE_CANONICAL_ID,
    numImages: 3,
    prompt: "Blend the references into one frosted-glass product hero",
    referenceImageUrls: references,
    resolutionPreset: "3K",
  })

  assert.equal(result.endpointId, FAL_SEEDREAM_5_LITE_EDIT)
  assert.equal(result.input.image_size, "auto_3K")
  assert.equal(result.input.num_images, 3)
  assert.equal((result.input.image_urls as string[]).length, 10)
})

runTest("Seedream 5 Lite routes prompt-only generations to Fal text-to-image", () => {
  const result = buildFalImageRequest({
    aspectRatio: "4:3",
    modelIdentifier: SEEDREAM_5_LITE_CANONICAL_ID,
    numImages: 1,
    prompt: "A cinematic product still on marble",
    referenceImageUrls: [],
  })

  assert.equal(result.endpointId, FAL_SEEDREAM_5_LITE_T2I)
  assert.equal(result.input.image_size, "landscape_4_3")
  assert.equal(result.input.enable_safety_checker, false)
})

runTest("Nano Banana 2 Lite routes prompt-only generations to text-to-image with safety_tolerance 6", () => {
  const result = buildFalImageRequest({
    aspectRatio: "16:9",
    modelIdentifier: NANO_BANANA_2_LITE_CANONICAL_ID,
    numImages: 2,
    prompt: "A black lab swimming in a pool",
    referenceImageUrls: [],
  })

  assert.equal(result.endpointId, FAL_NANO_BANANA_2_LITE_T2I)
  assert.equal(result.input.aspect_ratio, "16:9")
  assert.equal(result.input.safety_tolerance, "6")
  assert.equal(result.input.num_images, 2)
})

runTest("Nano Banana 2 Lite routes referenced generations to edit with auto aspect ratio", () => {
  const result = buildFalImageRequest({
    aspectRatio: "match_input_image",
    modelIdentifier: NANO_BANANA_2_LITE_CANONICAL_ID,
    numImages: 1,
    prompt: "Make the scene sunset",
    referenceImageUrls: ["https://example.com/ref-1.png"],
  })

  assert.equal(result.endpointId, FAL_NANO_BANANA_2_LITE_EDIT)
  assert.equal(result.input.aspect_ratio, "auto")
  assert.equal(result.input.safety_tolerance, "6")
  assert.deepEqual(result.input.image_urls, ["https://example.com/ref-1.png"])
})
