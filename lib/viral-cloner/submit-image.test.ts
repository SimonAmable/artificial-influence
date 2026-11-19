import assert from "node:assert/strict"
import { buildQwenImage21WaveSpeedRequest } from "@/lib/server/wavespeed-qwen-image-21-request.ts"
import { buildViralClonerImagePrompt } from "./prompt.ts"
import { readViralClonerQwenLoraPath, readViralClonerQwenLoraScale } from "./constants.ts"

const prompt = buildViralClonerImagePrompt()
assert.ok(prompt.includes("identity"))

const req = buildQwenImage21WaveSpeedRequest({
  prompt,
  referenceImageUrls: ["https://example.com/char.jpg", "https://example.com/src.jpg"],
  aspectRatio: null,
  resolution: "1.5k",
  outputFormat: "png",
  seed: null,
  loras: [{ path: readViralClonerQwenLoraPath(), scale: readViralClonerQwenLoraScale() }],
})

assert.equal(req.endpoint, "wavespeed-ai/qwen-image-2.1/edit-lora")
assert.equal(req.input.resolution, "1.5k")
const loras = req.input.loras as Array<{ path: string; scale: number }> | undefined
assert.equal(loras?.[0]?.path, readViralClonerQwenLoraPath())

console.log("viral cloner qwen request tests passed")