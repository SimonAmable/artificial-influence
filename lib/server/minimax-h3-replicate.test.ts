import assert from "node:assert/strict"
import { buildMinimaxH3ReplicateInput } from "./minimax-h3-replicate.ts"

const highspeed = buildMinimaxH3ReplicateInput("minimax/h3-highspeed", {
  prompt: "a city at dusk",
  image: "https://example.com/start.png",
  last_frame: "https://example.com/end.png",
  otherParams: { duration: 3, aspect_ratio: "9:16" },
})

assert.equal(highspeed.duration, 4)
assert.equal(highspeed.ratio, "9:16")
assert.equal(highspeed.first_frame_image, "https://example.com/start.png")
assert.equal(highspeed.last_frame_image, "https://example.com/end.png")
assert.equal("resolution" in highspeed, false)

const lite = buildMinimaxH3ReplicateInput("minimax/h3-lite", {
  prompt: "match the clip",
  otherParams: {
    duration: 20,
    resolution: "480p",
    aspect_ratio: "nope",
    reference_images: ["https://example.com/a.png", "https://example.com/a.png"],
    reference_videos: ["https://example.com/clip.mp4"],
    reference_audios: ["https://example.com/voice.wav"],
    image: "https://example.com/ignored.png",
  },
})

assert.equal(lite.duration, 15)
assert.equal(lite.resolution, "480P")
assert.equal(lite.ratio, "16:9")
assert.deepEqual(lite.reference_image_urls, ["https://example.com/a.png"])
assert.deepEqual(lite.reference_video_urls, ["https://example.com/clip.mp4"])
assert.deepEqual(lite.reference_audio_urls, ["https://example.com/voice.wav"])
assert.equal("first_frame_image" in lite, false)

const audioWithoutVisual = buildMinimaxH3ReplicateInput("minimax/h3-highspeed", {
  prompt: "talking",
  otherParams: { reference_audios: ["https://example.com/voice.wav"] },
})

assert.equal("reference_audio_urls" in audioWithoutVisual, false)

console.log("minimax-h3-replicate tests passed")
