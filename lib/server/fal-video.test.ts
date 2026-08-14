import assert from "node:assert/strict"

const {
  buildFalVideoRequest,
  FAL_GEMINI_OMNI_FLASH_EDIT,
  FAL_GEMINI_OMNI_FLASH_I2V,
  FAL_GEMINI_OMNI_FLASH_REFERENCE,
  FAL_GEMINI_OMNI_FLASH_T2V,
  FAL_HAPPY_HORSE_I2V,
  FAL_HAPPY_HORSE_REFERENCE,
  FAL_HAPPY_HORSE_T2V,
  FAL_MINIMAX_H3_I2V,
  FAL_MINIMAX_H3_REFERENCE,
  FAL_MINIMAX_H3_T2V,
  FAL_SEEDANCE_2_5_REFERENCE,
  GEMINI_OMNI_FLASH_CANONICAL_ID,
  HAPPY_HORSE_CANONICAL_ID,
  MINIMAX_H3_CANONICAL_ID,
  SEEDANCE_2_5_CANONICAL_ID,
  shouldRouteSeedance25ToFal,
} = await import(new URL("./fal-video.ts", import.meta.url).href)

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

runTest("Happy Horse routes prompt-only generations to text-to-video", () => {
  const result = buildFalVideoRequest({
    aspectRatio: "9:16",
    duration: 6,
    modelIdentifier: HAPPY_HORSE_CANONICAL_ID,
    prompt: "A dancer under neon lights",
    referenceImageUrls: [],
    resolution: "720p",
  })

  assert.equal(result.endpointId, FAL_HAPPY_HORSE_T2V)
  assert.equal(result.mode, "text-to-video")
  assert.equal(result.input.prompt, "A dancer under neon lights")
  assert.equal(result.input.aspect_ratio, "9:16")
  assert.equal(result.input.resolution, "720p")
  assert.ok(!("image_url" in result.input))
  assert.ok(!("image_urls" in result.input))
})

runTest("Happy Horse routes single-image generations to image-to-video", () => {
  const result = buildFalVideoRequest({
    duration: 5,
    imageUrl: "https://example.com/start.png",
    modelIdentifier: HAPPY_HORSE_CANONICAL_ID,
    prompt: null,
    referenceImageUrls: [],
    resolution: "1080p",
  })

  assert.equal(result.endpointId, FAL_HAPPY_HORSE_I2V)
  assert.equal(result.mode, "image-to-video")
  assert.equal(result.input.image_url, "https://example.com/start.png")
  assert.ok(!("aspect_ratio" in result.input))
  assert.ok(!("prompt" in result.input))
})

runTest("Happy Horse reference mode wins over start frame and trims to nine images", () => {
  const result = buildFalVideoRequest({
    aspectRatio: "4:3",
    duration: "7",
    imageUrl: "https://example.com/start.png",
    modelIdentifier: HAPPY_HORSE_CANONICAL_ID,
    prompt: "character1 and character2 walk through a sunlit market",
    referenceImageUrls: [
      "https://example.com/ref-1.png",
      "https://example.com/ref-2.png",
      "https://example.com/ref-3.png",
      "https://example.com/ref-4.png",
      "https://example.com/ref-5.png",
      "https://example.com/ref-6.png",
      "https://example.com/ref-7.png",
      "https://example.com/ref-8.png",
      "https://example.com/ref-9.png",
      "https://example.com/ref-10.png",
    ],
  })

  assert.equal(result.endpointId, FAL_HAPPY_HORSE_REFERENCE)
  assert.equal(result.mode, "reference-to-video")
  assert.equal(result.input.aspect_ratio, "4:3")
  assert.deepEqual(result.input.image_urls, [
    "https://example.com/ref-1.png",
    "https://example.com/ref-2.png",
    "https://example.com/ref-3.png",
    "https://example.com/ref-4.png",
    "https://example.com/ref-5.png",
    "https://example.com/ref-6.png",
    "https://example.com/ref-7.png",
    "https://example.com/ref-8.png",
    "https://example.com/ref-9.png",
  ])
  assert.ok(!("image_url" in result.input))
})

runTest("Gemini Omni Flash routes prompt-only generations to text-to-video", () => {
  const result = buildFalVideoRequest({
    aspectRatio: "9:16",
    duration: 6,
    modelIdentifier: GEMINI_OMNI_FLASH_CANONICAL_ID,
    prompt: "A lighthouse at dusk with crashing waves",
    referenceImageUrls: [],
  })

  assert.equal(result.endpointId, FAL_GEMINI_OMNI_FLASH_T2V)
  assert.equal(result.mode, "text-to-video")
  assert.equal(result.input.prompt, "A lighthouse at dusk with crashing waves")
  assert.equal(result.input.aspect_ratio, "9:16")
  assert.equal(result.input.duration, 6)
})

runTest("Gemini Omni Flash routes single-image generations to image-to-video", () => {
  const result = buildFalVideoRequest({
    aspectRatio: "16:9",
    duration: 8,
    imageUrl: "https://example.com/start.png",
    modelIdentifier: GEMINI_OMNI_FLASH_CANONICAL_ID,
    prompt: "The dog wags its tail",
    referenceImageUrls: [],
  })

  assert.equal(result.endpointId, FAL_GEMINI_OMNI_FLASH_I2V)
  assert.equal(result.mode, "image-to-video")
  assert.equal(result.input.image_url, "https://example.com/start.png")
  assert.equal(result.input.prompt, "The dog wags its tail")
})

runTest("Gemini Omni Flash reference mode wins over start frame", () => {
  const result = buildFalVideoRequest({
    aspectRatio: "9:16",
    duration: 5,
    imageUrl: "https://example.com/start.png",
    modelIdentifier: GEMINI_OMNI_FLASH_CANONICAL_ID,
    prompt: "A cat plays with yarn",
    referenceImageUrls: [
      "https://example.com/ref-1.png",
      "https://example.com/ref-2.png",
    ],
  })

  assert.equal(result.endpointId, FAL_GEMINI_OMNI_FLASH_REFERENCE)
  assert.equal(result.mode, "reference-to-video")
  assert.deepEqual(result.input.image_urls, [
    "https://example.com/ref-1.png",
    "https://example.com/ref-2.png",
  ])
  assert.ok(!("image_url" in result.input))
})

runTest("Gemini Omni Flash routes video input to the edit endpoint", () => {
  const result = buildFalVideoRequest({
    aspectRatio: "9:16",
    duration: 8,
    imageUrl: "https://example.com/start.png",
    modelIdentifier: GEMINI_OMNI_FLASH_CANONICAL_ID,
    prompt: "Replace the pomegranates with apples",
    referenceImageUrls: ["https://example.com/ref.png"],
    videoUrl: "https://example.com/source.mp4",
  })

  assert.equal(result.endpointId, FAL_GEMINI_OMNI_FLASH_EDIT)
  assert.equal(result.mode, "video-to-video")
  assert.deepEqual(result.input, {
    prompt: "Replace the pomegranates with apples",
    video_url: "https://example.com/source.mp4",
  })
})

runTest("MiniMax H3 routes prompt-only generations to text-to-video", () => {
  const result = buildFalVideoRequest({
    aspectRatio: "9:16",
    duration: 8,
    modelIdentifier: "minimax/h3/text-to-video",
    prompt: "A white kitten chases a butterfly across a sunlit garden",
    referenceImageUrls: [],
    resolution: "4K",
  })

  assert.equal(result.endpointId, FAL_MINIMAX_H3_T2V)
  assert.equal(result.mode, "text-to-video")
  assert.equal(result.input.prompt, "A white kitten chases a butterfly across a sunlit garden")
  assert.equal(result.input.aspect_ratio, "9:16")
  assert.equal(result.input.duration, 8)
  assert.equal(result.input.resolution, "4K")
  assert.equal(result.input.enable_prompt_expansion, true)
  assert.equal(result.input.enable_safety_checker, false)
  assert.ok(!("image_url" in result.input))
})

runTest("MiniMax H3 routes first and last frames to image-to-video", () => {
  const result = buildFalVideoRequest({
    duration: 5,
    endImageUrl: "https://example.com/end.png",
    imageUrl: "https://example.com/start.png",
    modelIdentifier: MINIMAX_H3_CANONICAL_ID,
    prompt: "The camera slowly pulls back from the scene",
    referenceImageUrls: [],
    resolution: "2K",
  })

  assert.equal(result.endpointId, FAL_MINIMAX_H3_I2V)
  assert.equal(result.mode, "image-to-video")
  assert.equal(result.input.image_url, "https://example.com/start.png")
  assert.equal(result.input.end_image_url, "https://example.com/end.png")
  assert.ok(!("aspect_ratio" in result.input))
})

runTest("MiniMax H3 last-frame-only generations use the image as the first frame", () => {
  const result = buildFalVideoRequest({
    endImageUrl: "https://example.com/end.png",
    modelIdentifier: MINIMAX_H3_CANONICAL_ID,
    prompt: "Hold on the closing pose",
    referenceImageUrls: [],
  })

  assert.equal(result.endpointId, FAL_MINIMAX_H3_I2V)
  assert.equal(result.input.image_url, "https://example.com/end.png")
  assert.ok(!("end_image_url" in result.input))
})

runTest("MiniMax H3 reference images, videos, and audio win over first/last frames", () => {
  const result = buildFalVideoRequest({
    aspectRatio: "adaptive",
    duration: 12,
    endImageUrl: "https://example.com/end.png",
    imageUrl: "https://example.com/start.png",
    modelIdentifier: MINIMAX_H3_CANONICAL_ID,
    prompt: "Image 1 is the protagonist. Video 1 supplies the camera move. Audio 1 is the score.",
    referenceAudioUrls: ["https://example.com/score.mp3"],
    referenceImageUrls: ["https://example.com/ref-1.png", "https://example.com/ref-2.png"],
    referenceVideoUrls: ["https://example.com/motion.mp4"],
    resolution: "768p",
  })

  assert.equal(result.endpointId, FAL_MINIMAX_H3_REFERENCE)
  assert.equal(result.mode, "reference-to-video")
  assert.equal(result.input.aspect_ratio, "adaptive")
  assert.equal(result.input.resolution, "768P")
  assert.deepEqual(result.input.reference_image_urls, [
    "https://example.com/start.png",
    "https://example.com/end.png",
    "https://example.com/ref-1.png",
    "https://example.com/ref-2.png",
  ])
  assert.deepEqual(result.input.reference_video_urls, ["https://example.com/motion.mp4"])
  assert.deepEqual(result.input.reference_audio_urls, ["https://example.com/score.mp3"])
  assert.ok(!("image_url" in result.input))
})

runTest("MiniMax H3 video-only references route to reference-to-video for edits", () => {
  const result = buildFalVideoRequest({
    modelIdentifier: MINIMAX_H3_CANONICAL_ID,
    prompt: "Replace the red car with a yellow taxi and keep everything else unchanged",
    referenceImageUrls: [],
    videoUrl: "https://example.com/source.mp4",
  })

  assert.equal(result.endpointId, FAL_MINIMAX_H3_REFERENCE)
  assert.deepEqual(result.input.reference_video_urls, ["https://example.com/source.mp4"])
})

runTest("Seedance 2.5 with a reference video routes to Fal reference-to-video", () => {
  const result = buildFalVideoRequest({
    aspectRatio: "adaptive",
    duration: -1,
    generateAudio: false,
    imageUrl: "https://example.com/start.png",
    modelIdentifier: SEEDANCE_2_5_CANONICAL_ID,
    prompt: "The character from [Image1] copies the motion in [Video1]",
    referenceAudioUrls: ["https://example.com/score.mp3"],
    referenceImageUrls: ["https://example.com/ref.png"],
    referenceVideoUrls: ["https://example.com/motion.mp4"],
    resolution: "480p",
  })

  assert.equal(result.endpointId, FAL_SEEDANCE_2_5_REFERENCE)
  assert.equal(result.mode, "reference-to-video")
  assert.equal(result.input.prompt, "The character from @Image1 copies the motion in @Video1")
  assert.equal(result.input.duration, "auto")
  assert.equal(result.input.aspect_ratio, "auto")
  assert.equal(result.input.resolution, "480p")
  assert.equal(result.input.generate_audio, false)
  assert.deepEqual(result.input.image_urls, [
    "https://example.com/start.png",
    "https://example.com/ref.png",
  ])
  assert.deepEqual(result.input.video_urls, ["https://example.com/motion.mp4"])
  assert.deepEqual(result.input.audio_urls, ["https://example.com/score.mp3"])
  assert.equal(shouldRouteSeedance25ToFal({
    hasReferenceVideo: true,
    modelIdentifier: SEEDANCE_2_5_CANONICAL_ID,
  }), true)
  assert.equal(shouldRouteSeedance25ToFal({
    hasReferenceVideo: false,
    modelIdentifier: SEEDANCE_2_5_CANONICAL_ID,
  }), false)
})

runTest("Seedance 2.5 Fal routing rejects requests without a reference video", () => {
  assert.throws(
    () =>
      buildFalVideoRequest({
        modelIdentifier: SEEDANCE_2_5_CANONICAL_ID,
        prompt: "A quiet lakeside at dawn",
        referenceImageUrls: ["https://example.com/still.png"],
      }),
    /reference video/,
  )
})
