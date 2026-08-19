import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildFalKlingMotionControlElement,
  parseFaceLockMode,
  resolveFaceLockImageUrl,
  resolveFalKlingMotionControlEndpoint,
  shouldRouteMotionCopyToFal,
} from "./face-lock.ts"

describe("motion-copy face lock", () => {
  it("parses face lock modes", () => {
    assert.equal(parseFaceLockMode("off"), "off")
    assert.equal(parseFaceLockMode("reference"), "reference")
    assert.equal(parseFaceLockMode("custom"), "custom")
    assert.equal(parseFaceLockMode(undefined), "off")
  })

  it("routes to fal only when face lock is active", () => {
    assert.equal(shouldRouteMotionCopyToFal("off"), false)
    assert.equal(shouldRouteMotionCopyToFal("reference"), true)
    assert.equal(shouldRouteMotionCopyToFal("custom"), true)
  })

  it("resolves face image urls by mode", () => {
    assert.equal(
      resolveFaceLockImageUrl({
        faceLock: "reference",
        referenceImageUrl: "https://example.com/ref.png",
      }),
      "https://example.com/ref.png",
    )
    assert.equal(
      resolveFaceLockImageUrl({
        faceLock: "custom",
        customFaceImageUrl: "https://example.com/face.png",
      }),
      "https://example.com/face.png",
    )
    assert.equal(
      resolveFaceLockImageUrl({
        faceLock: "off",
        referenceImageUrl: "https://example.com/ref.png",
      }),
      null,
    )
  })

  it("maps mode to fal endpoints", () => {
    assert.equal(
      resolveFalKlingMotionControlEndpoint("std"),
      "fal-ai/kling-video/v3/standard/motion-control",
    )
    assert.equal(
      resolveFalKlingMotionControlEndpoint("pro"),
      "fal-ai/kling-video/v3/pro/motion-control",
    )
  })

  it("builds fal element payload", () => {
    assert.deepEqual(buildFalKlingMotionControlElement("https://example.com/face.png"), {
      frontal_image_url: "https://example.com/face.png",
      reference_image_urls: ["https://example.com/face.png"],
    })
  })
})
