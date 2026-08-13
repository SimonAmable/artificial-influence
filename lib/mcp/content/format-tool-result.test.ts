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

runTest("returns resource_link blocks for completed media items", () => {
  const formatted = formatMcpToolResult("generate_image", {
    status: "completed",
    type: "image",
    generationId: "gen-1",
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
        mimeType: "image/png",
        prompt: "Katie at the beach",
      },
    ],
  })

  assert.notEqual(formatted.isError, true)
  assert.equal(formatted.content[0].type, "text")
  assert.equal(formatted.content.some((block) => block.type === "resource_link"), true)

  const link = formatted.content.find((block) => block.type === "resource_link")
  assert.ok(link && link.uri.includes("image.png"))
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

console.log("format-tool-result tests passed")
