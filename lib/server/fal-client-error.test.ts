import assert from "node:assert/strict"
import { ApiError } from "@fal-ai/client"
import { formatFalClientError } from "./fal-client-error.ts"

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

runTest("formatFalClientError parses content_policy_violation detail", () => {
  const error = new ApiError({
    message: "Unprocessable Entity",
    status: 422,
    body: {
      detail: [
        {
          loc: ["body", "prompt"],
          msg: "The content could not be processed because it contained material flagged by a content checker.",
          type: "content_policy_violation",
        },
      ],
    },
  })

  assert.equal(
    formatFalClientError(error),
    "The content could not be processed because it contained material flagged by a content checker.",
  )
})

runTest("formatFalClientError formats pydantic field errors with loc", () => {
  const error = new ApiError({
    message: "Unprocessable Entity",
    status: 422,
    body: {
      detail: [
        {
          loc: ["body", "image_urls", 0],
          msg: "Image too small",
          type: "image_too_small",
        },
      ],
    },
  })

  assert.equal(formatFalClientError(error), "body.image_urls.0: Image too small")
})
