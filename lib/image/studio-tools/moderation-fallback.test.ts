import assert from "node:assert/strict"
import test from "node:test"
import {
  STUDIO_IMAGE_FALLBACK_CHAIN,
  getStudioToolFalQualityParams,
  isModerationGenerationFailure,
  isStudioImageToolTag,
} from "@/lib/image/studio-tools/moderation-fallback"

test("isStudioImageToolTag recognizes proprietary studio tools only", () => {
  assert.equal(isStudioImageToolTag("face_swap"), true)
  assert.equal(isStudioImageToolTag("character_swap"), true)
  assert.equal(isStudioImageToolTag("outfit_swap"), true)
  assert.equal(isStudioImageToolTag("pose_recreate"), true)
  assert.equal(isStudioImageToolTag("shot_recreate"), true)
  assert.equal(isStudioImageToolTag("carousel_shots"), false)
  assert.equal(isStudioImageToolTag("image"), false)
  assert.equal(isStudioImageToolTag(null), false)
})

test("isModerationGenerationFailure only matches moderation-like errors", () => {
  assert.equal(isModerationGenerationFailure(new Error("content_policy_violation")), true)
  assert.equal(isModerationGenerationFailure(new Error("flagged by safety filter")), true)
  assert.equal(isModerationGenerationFailure(new Error("Fal generation timed out")), false)
  assert.equal(isModerationGenerationFailure(new Error("Insufficient credits")), false)
})

test("studio fallback chain starts with lowest-quality model", () => {
  assert.deepEqual(STUDIO_IMAGE_FALLBACK_CHAIN, [
    "google/nano-banana-2-lite",
    "openai/gpt-image-2",
    "bytedance/seedream-5-lite",
  ])
})

test("studio tool quality params use the lowest tier per model", () => {
  assert.deepEqual(getStudioToolFalQualityParams("google/nano-banana-2-lite"), {})
  assert.deepEqual(getStudioToolFalQualityParams("openai/gpt-image-2"), { quality: "medium" })
  assert.deepEqual(getStudioToolFalQualityParams("bytedance/seedream-5-lite"), {
    resolutionPreset: "2K",
  })
})
