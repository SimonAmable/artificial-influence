import assert from "node:assert/strict"
import test from "node:test"
import { estimateStudioToolCredits } from "@/lib/image/studio-tools/estimate-credits"

test("GPT Image 2 studio tools quote medium quality, not the flat model_cost", () => {
  const quoted = estimateStudioToolCredits({
    baseModelIdentifier: "openai/gpt-image-2",
    model_cost: 5,
    pricing_config: {
      strategy: "tiered_per_output",
      defaultCredits: 4,
      dimensions: [
        { parameter: "quality", values: { low: 2, medium: 4, high: 8 } },
      ],
    },
  })

  assert.equal(quoted, 4)
})

test("GPT Image 2 studio tools still quote medium when pricing_config is missing", () => {
  const quoted = estimateStudioToolCredits({
    baseModelIdentifier: "openai/gpt-image-2",
    model_cost: 5,
    pricing_config: null,
  })

  assert.equal(quoted, 4)
})
