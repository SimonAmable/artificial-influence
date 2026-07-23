import assert from "node:assert/strict"

const {
  buildImagePricingParameters,
  parsePricingConfig,
  resolveGenerationPricingQuote,
} = await import(new URL("./generation-pricing.ts", import.meta.url).href)

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

runTest("parsePricingConfig accepts tiered_per_output", () => {
  const config = parsePricingConfig({
    strategy: "tiered_per_output",
    defaultCredits: 4,
    dimensions: [{ parameter: "quality", values: { low: 2, high: 8 } }],
  })

  assert.equal(config?.strategy, "tiered_per_output")
})

runTest("GPT Image 2 quality tiers change quoted credits", () => {
  const quote = resolveGenerationPricingQuote({
    model: {
      identifier: "openai/gpt-image-2",
      type: "image",
      model_cost: 4,
      pricing_config: {
        strategy: "tiered_per_output",
        defaultCredits: 4,
        dimensions: [{ parameter: "quality", values: { low: 2, medium: 4, high: 8 } }],
      },
    },
    parameters: buildImagePricingParameters({ quality: "high" }),
    outputCount: 2,
  })

  assert.equal(quote.quotedCredits, 16)
  assert.equal(quote.creditsPerUnit, 8)
})

runTest("Grok Imagine resolution tiers", () => {
  const quote1k = resolveGenerationPricingQuote({
    model: {
      identifier: "xai/grok-imagine-image-quality",
      type: "image",
      model_cost: 7,
      pricing_config: {
        strategy: "tiered_per_output",
        defaultCredits: 7,
        dimensions: [{ parameter: "resolution", values: { "1k": 5, "2k": 7 } }],
      },
    },
    parameters: buildImagePricingParameters({ resolution: "1k" }),
    outputCount: 1,
  })

  const quote2k = resolveGenerationPricingQuote({
    model: {
      identifier: "xai/grok-imagine-image-quality",
      type: "image",
      model_cost: 7,
      pricing_config: {
        strategy: "tiered_per_output",
        defaultCredits: 7,
        dimensions: [{ parameter: "resolution", values: { "1k": 5, "2k": 7 } }],
      },
    },
    parameters: buildImagePricingParameters({ resolution: "2k" }),
    outputCount: 1,
  })

  assert.equal(quote1k.quotedCredits, 5)
  assert.equal(quote2k.quotedCredits, 7)
})

runTest("Kling v3 mode and audio matrix", () => {
  const quote = resolveGenerationPricingQuote({
    model: {
      identifier: "kwaivgi/kling-v3-video",
      type: "video",
      model_cost: 10,
      model_cost_per_second: 10,
      pricing_config: {
        strategy: "per_second",
        defaultCreditsPerSecond: 10,
        tiers: [
          { match: { mode: "standard", generate_audio: false }, creditsPerSecond: 7 },
          { match: { mode: "standard", generate_audio: true }, creditsPerSecond: 11 },
          { match: { mode: "pro", generate_audio: false }, creditsPerSecond: 10 },
          { match: { mode: "pro", generate_audio: true }, creditsPerSecond: 14 },
        ],
      },
    },
    parameters: { mode: "standard", generate_audio: true, duration: 5 },
    durationSeconds: 5,
  })

  assert.equal(quote.creditsPerUnit, 11)
  assert.equal(quote.quotedCredits, 55)
})

runTest("falls back to model_cost when pricing_config is null", () => {
  const quote = resolveGenerationPricingQuote({
    model: {
      identifier: "google/nano-banana-2-lite",
      type: "image",
      model_cost: 2,
      pricing_config: null,
    },
    parameters: {},
    outputCount: 3,
  })

  assert.equal(quote.quotedCredits, 6)
  assert.equal(quote.pricingSnapshot.strategy, "legacy_fallback")
})

console.log("generation-pricing tests passed")
