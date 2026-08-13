import assert from "node:assert/strict"

const { formatMcpToolResult } = await import(new URL("./format-tool-result.ts", import.meta.url).href)

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

runTest("returns UniCan pageUrl resource_link for completed media", () => {
  const formatted = formatMcpToolResult("generate_image", {
    status: "completed",
    type: "image",
    generationId: "gen-1",
    pageUrl: "https://unican.ai/assets?tab=history&generation=gen-1",
    prompt: "Katie at the beach",
    url: "https://example.supabase.co/storage/v1/object/public/public-bucket/user/image.png",
    items: [
      {
        id: "gen-1",
        generationId: "gen-1",
        status: "completed",
        type: "image",
        kind: "image",
        mediaUrl: "https://example.supabase.co/storage/v1/object/public/public-bucket/user/image.png",
        pageUrl: "https://unican.ai/assets?tab=history&generation=gen-1",
        mimeType: "image/png",
        prompt: "Katie at the beach",
      },
    ],
  })

  assert.notEqual(formatted.isError, true)
  const link = formatted.content.find((block) => block.type === "resource_link")
  assert.ok(link)
  assert.equal(link?.uri, "https://unican.ai/assets?tab=history&generation=gen-1")
})

runTest("marks failed generations as errors with a text summary", () => {
  const formatted = formatMcpToolResult("generate_image", {
    status: "failed",
    type: "image",
    error: "Moderation blocked request",
    items: [{ status: "failed", type: "image" }],
  })

  assert.equal(formatted.isError, true)
  const textBlock = formatted.content[0]
  assert.equal(textBlock.type, "text")
  if (textBlock.type === "text") {
    assert.match(textBlock.text, /Moderation blocked request/)
  }
})

runTest("includes generationId guidance for pending results", () => {
  const formatted = formatMcpToolResult("generate_image", {
    status: "pending",
    type: "image",
    generationId: "gen-pending",
    items: [{ status: "pending", type: "image" }],
  })

  const textBlock = formatted.content[0]
  assert.equal(textBlock.type, "text")
  if (textBlock.type === "text") {
    assert.match(textBlock.text, /gen-pending/)
    assert.match(textBlock.text, /get_generation/)
  }
  assert.equal(formatted.content.some((block) => block.type === "resource_link"), false)
})

runTest("formats empty character roster with guidance", () => {
  const formatted = formatMcpToolResult("list_characters", {
    characters: [],
    total: 0,
    media: [],
  })

  const textBlock = formatted.content[0]
  assert.equal(textBlock.type, "text")
  if (textBlock.type === "text") {
    assert.match(textBlock.text, /No saved characters/)
  }
})

runTest("formats character roster from characters array", () => {
  const formatted = formatMcpToolResult("list_characters", {
    characters: [
      {
        mediaId: "med_asset_katie",
        title: "Katie",
        type: "image",
        previewUrl: "https://example.supabase.co/katie.png",
        pageUrl: "https://unican.ai/assets?tab=characters&character=katie",
      },
    ],
    total: 1,
    media: [
      {
        mediaId: "med_asset_katie",
        title: "Katie",
        type: "image",
        previewUrl: "https://example.supabase.co/katie.png",
        pageUrl: "https://unican.ai/assets?tab=characters&character=katie",
      },
    ],
  })

  const textBlock = formatted.content[0]
  assert.equal(textBlock.type, "text")
  if (textBlock.type === "text") {
    assert.match(textBlock.text, /Saved characters \(1\)/)
    assert.match(textBlock.text, /Katie/)
  }
  assert.equal(formatted.content.some((block) => block.type === "resource_link"), true)
})

console.log("format-tool-result tests passed")
