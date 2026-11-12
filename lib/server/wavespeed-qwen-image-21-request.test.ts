import assert from "node:assert/strict"
import { buildQwenImage21WaveSpeedRequest } from "./wavespeed-qwen-image-21-request.ts"

const textOnly = buildQwenImage21WaveSpeedRequest({
  prompt: "a paper fox",
  referenceImageUrls: [],
  aspectRatio: "auto",
  resolution: "2K",
  outputFormat: "jpeg",
  seed: -1,
})

assert.equal(textOnly.endpoint, "wavespeed-ai/qwen-image-2.1/text-to-image-lora")
assert.equal(textOnly.input.aspect_ratio, "1:1")
assert.equal(textOnly.input.resolution, "2k")
assert.equal(textOnly.input.output_format, "jpeg")
assert.equal("seed" in textOnly.input, false)

const edit = buildQwenImage21WaveSpeedRequest({
  prompt: "keep the face, change the background",
  referenceImageUrls: ["https://example.com/a.png", "https://example.com/a.png", "https://example.com/b.png"],
  aspectRatio: "9:16",
  resolution: "1.5k",
  outputFormat: "png",
  seed: 4,
})

assert.equal(edit.endpoint, "wavespeed-ai/qwen-image-2.1/edit-lora")
assert.equal(edit.input.aspect_ratio, "9:16")
assert.equal(edit.input.resolution, "1.5k")
assert.equal(edit.input.seed, 4)
assert.deepEqual(edit.input.images, ["https://example.com/a.png", "https://example.com/b.png"])

const withLoras = buildQwenImage21WaveSpeedRequest({
  prompt: "styled fox",
  referenceImageUrls: [],
  aspectRatio: "1:1",
  resolution: "1k",
  outputFormat: "png",
  seed: null,
  loras: [
    { path: "https://example.com/a.safetensors", scale: 1.2 },
    { path: "https://example.com/b.safetensors", scale: 0.5 },
  ],
})

assert.deepEqual(withLoras.input.loras, [
  { path: "https://example.com/a.safetensors", scale: 1.2 },
  { path: "https://example.com/b.safetensors", scale: 0.5 },
])

console.log("qwen image 2.1 wavespeed request tests passed")
