import assert from "node:assert/strict"
import { buildH3HighspeedWaveSpeedRequest } from "./wavespeed-h3-highspeed-request.ts"

const textOnly = buildH3HighspeedWaveSpeedRequest({
  prompt: "a city at dusk",
  imageUrl: null,
  endImageUrl: null,
  referenceImageUrls: [],
  referenceVideoUrls: [],
  referenceAudioUrls: [],
  videoUrl: null,
  aspectRatio: "9:16",
  duration: 2,
})

assert.equal(textOnly.endpoint, "minimax/h3-highspeed/text-to-video")
assert.equal(textOnly.input.duration, 4)
assert.equal(textOnly.input.resolution, "768p")
assert.equal(textOnly.input.aspect_ratio, "9:16")

const framed = buildH3HighspeedWaveSpeedRequest({
  prompt: "she turns",
  imageUrl: "https://example.com/start.png",
  endImageUrl: "https://example.com/end.png",
  referenceImageUrls: [],
  referenceVideoUrls: [],
  referenceAudioUrls: [],
  videoUrl: null,
  aspectRatio: "1:1",
  duration: 5,
})

assert.equal(framed.endpoint, "minimax/h3-highspeed/image-to-video")
assert.equal(framed.input.image, "https://example.com/start.png")
assert.equal(framed.input.last_image, "https://example.com/end.png")
assert.equal("aspect_ratio" in framed.input, false)

const reference = buildH3HighspeedWaveSpeedRequest({
  prompt: "Image 1 performs Video 1",
  imageUrl: "https://example.com/face.png",
  endImageUrl: null,
  referenceImageUrls: ["https://example.com/face.png"],
  referenceVideoUrls: [],
  referenceAudioUrls: ["https://example.com/voice.wav"],
  videoUrl: "https://example.com/move.mp4",
  aspectRatio: "nope",
  duration: 20,
})

assert.equal(reference.endpoint, "minimax/h3-highspeed/reference-to-video")
assert.equal(reference.input.duration, 15)
assert.equal(reference.input.aspect_ratio, "16:9")
assert.deepEqual(reference.input.reference_images, ["https://example.com/face.png"])
assert.deepEqual(reference.input.reference_videos, ["https://example.com/move.mp4"])
assert.deepEqual(reference.input.reference_audios, ["https://example.com/voice.wav"])

assert.throws(
  () =>
    buildH3HighspeedWaveSpeedRequest({
      prompt: "talk",
      imageUrl: null,
      endImageUrl: null,
      referenceImageUrls: [],
      referenceVideoUrls: [],
      referenceAudioUrls: ["https://example.com/voice.wav"],
      videoUrl: null,
      aspectRatio: null,
      duration: 5,
    }),
  /image or video/,
)

console.log("wavespeed h3 highspeed request tests passed")
