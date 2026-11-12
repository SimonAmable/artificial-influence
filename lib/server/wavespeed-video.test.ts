import assert from "node:assert/strict"
import { buildWan30WaveSpeedRequest } from "./wavespeed-wan30-request.ts"

const textOnly = buildWan30WaveSpeedRequest({
  prompt: "a train at sunset",
  imageUrl: null,
  endImageUrl: null,
  referenceImageUrls: [],
  referenceVideoUrls: [],
  referenceAudioUrls: [],
  videoUrl: null,
  aspectRatio: "adaptive",
  duration: 1,
  resolution: "1080p",
  generateAudio: null,
  enablePromptExpansion: null,
  seed: -1,
})

assert.equal(textOnly.endpoint, "alibaba/wan-3.0/text-to-video")
assert.equal(textOnly.input.aspect_ratio, "16:9")
assert.equal(textOnly.input.duration, 2)
assert.equal(textOnly.input.resolution, "1080p")
assert.equal(textOnly.input.generate_audio, true)
assert.equal("seed" in textOnly.input, false)

const framed = buildWan30WaveSpeedRequest({
  prompt: "she turns",
  imageUrl: "https://example.com/start.png",
  endImageUrl: "https://example.com/end.png",
  referenceImageUrls: [],
  referenceVideoUrls: [],
  referenceAudioUrls: [],
  videoUrl: null,
  aspectRatio: null,
  duration: 5,
  resolution: null,
  generateAudio: false,
  enablePromptExpansion: false,
  seed: null,
})

assert.equal(framed.endpoint, "alibaba/wan-3.0/image-to-video")
assert.equal(framed.input.image, "https://example.com/start.png")
assert.equal(framed.input.last_image, "https://example.com/end.png")
assert.equal("aspect_ratio" in framed.input, false)
assert.equal(framed.input.generate_audio, false)

const reference = buildWan30WaveSpeedRequest({
  prompt: "the woman from Image 1 performs Video 1",
  imageUrl: "https://example.com/character.png",
  endImageUrl: null,
  referenceImageUrls: ["https://example.com/character.png", "https://example.com/outfit.png"],
  referenceVideoUrls: [],
  referenceAudioUrls: ["https://example.com/room.wav"],
  videoUrl: "https://example.com/move.mp4",
  aspectRatio: "9:16",
  duration: 40,
  resolution: "720p",
  generateAudio: true,
  enablePromptExpansion: true,
  seed: 7,
})

assert.equal(reference.endpoint, "alibaba/wan-3.0/reference-to-video")
assert.equal(reference.input.duration, 30)
assert.equal(reference.input.aspect_ratio, "9:16")
assert.equal(reference.input.seed, 7)
assert.deepEqual(reference.input.reference_images, [
  "https://example.com/character.png",
  "https://example.com/outfit.png",
])
assert.deepEqual(reference.input.reference_videos, ["https://example.com/move.mp4"])
assert.deepEqual(reference.input.reference_audios, ["https://example.com/room.wav"])

console.log("wavespeed wan 3 request tests passed")
