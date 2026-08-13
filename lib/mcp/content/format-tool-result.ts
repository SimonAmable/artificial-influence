type JsonObject = Record<string, unknown>

type ContentAnnotations = {
  audience?: Array<"user" | "assistant">
  priority?: number
}

export type McpTextContent = {
  type: "text"
  text: string
  annotations?: ContentAnnotations
}

export type McpResourceLinkContent = {
  type: "resource_link"
  uri: string
  name: string
  description?: string
  mimeType?: string
  annotations?: ContentAnnotations
}

export type McpContentBlock = McpTextContent | McpResourceLinkContent

export type FormattedMcpToolResult = {
  content: McpContentBlock[]
  isError?: boolean
}

const PENDING_STATUSES = new Set(["pending", "queued", "processing", "starting", "in_progress"])

export function formatMcpToolResult(toolName: string, result: unknown): FormattedMcpToolResult {
  if (!result || typeof result !== "object") {
    return {
      content: [{ type: "text", text: `${toolName} completed.` }],
    }
  }

  const value = result as JsonObject
  const mediaBlocks = extractMediaResourceLinks(value)

  if (Array.isArray(value.models)) {
    return {
      content: [{ type: "text", text: formatModelCatalog(value.models) }],
    }
  }

  if (Array.isArray(value.media)) {
    return {
      content: [{ type: "text", text: formatMediaSearch(value.media) }],
    }
  }

  if (Array.isArray(value.generations)) {
    return {
      content: [
        {
          type: "text",
          text: `Loaded ${value.generations.length} generation${value.generations.length === 1 ? "" : "s"}.`,
        },
      ],
    }
  }

  if (value.generation && typeof value.generation === "object") {
    const generation = value.generation as JsonObject
    const status = textValue(generation.status) || "ready"
    const type = textValue(generation.type) || "generation"
    const url = textValue(generation.url)
    const generationId = textValue(generation.generationId) || textValue(generation.id)
    const isFailed = status === "failed" || status === "error" || status === "cancelled" || status === "canceled"

    return {
      content: [
        {
          type: "text",
          text: summarizeSingleGeneration({ status, type, url, generationId, error: textValue(generation.error) }),
          annotations: { audience: ["assistant", "user"] },
        },
        ...mediaBlocks,
      ],
      isError: isFailed,
    }
  }

  if (Array.isArray(value.items)) {
    const status = textValue(value.status) || "ready"
    const type = textValue(value.type) || "media"
    const generationId = textValue(value.generationId)
    const isFailed = status === "failed" || status === "error"
    const isPending = PENDING_STATUSES.has(status)

    return {
      content: [
        {
          type: "text",
          text: summarizeMediaBatch({
            toolName,
            status,
            type,
            generationId,
            error: textValue(value.error),
            itemCount: value.items.length,
          }),
          annotations: { audience: ["assistant", "user"] },
        },
        ...mediaBlocks,
      ],
      isError: isFailed,
    }
  }

  if (value.account && typeof value.account === "object") {
    return {
      content: [{ type: "text", text: "Connected UniCan account loaded." }],
    }
  }

  return {
    content: [{ type: "text", text: `${toolName} completed.` }],
  }
}

function summarizeSingleGeneration(input: {
  status: string
  type: string
  url: string | null
  generationId: string | null
  error: string | null
}) {
  if (input.status === "completed" && input.url) {
    return `Your ${input.type} is ready.`
  }
  if (input.status === "failed" || input.status === "error") {
    return input.error
      ? `This ${input.type} could not be completed: ${input.error}`
      : `This ${input.type} could not be completed.`
  }
  if (PENDING_STATUSES.has(input.status)) {
    return input.generationId
      ? `Your ${input.type} is still being created (generationId: ${input.generationId}). Call get_generation with that id to refresh status.`
      : `Your ${input.type} is still being created.`
  }
  return `Generation status: ${input.status}.`
}

function summarizeMediaBatch(input: {
  toolName: string
  status: string
  type: string
  generationId: string | null
  error: string | null
  itemCount: number
}) {
  if (input.status === "completed") {
    const countLabel =
      input.itemCount === 1 ? `Your ${input.type} is ready.` : `${input.itemCount} ${input.type} outputs are ready.`
    return countLabel
  }
  if (input.status === "failed") {
    return input.error
      ? `This ${input.type} could not be completed: ${input.error}`
      : `This ${input.type} could not be completed.`
  }
  if (PENDING_STATUSES.has(input.status)) {
    return input.generationId
      ? `Your ${input.type} is being created (generationId: ${input.generationId}). Call get_generation with that id to refresh status, or check UniCan History.`
      : `Your ${input.type} is being created.`
  }
  return `${input.toolName} completed.`
}

function extractMediaResourceLinks(value: JsonObject): McpResourceLinkContent[] {
  const links: McpResourceLinkContent[] = []
  const seen = new Set<string>()

  const items = Array.isArray(value.items) ? value.items : []
  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object") continue
    const item = rawItem as JsonObject
    const status = textValue(item.status) || textValue(value.status) || "pending"
    if (status !== "completed") continue

    const url =
      textValue(item.mediaUrl) ||
      textValue(item.downloadUrl) ||
      textValue(item.thumbnailUrl) ||
      textValue(item.url)
    if (!url || seen.has(url)) continue
    seen.add(url)

    const kind = textValue(item.type) || textValue(item.kind) || textValue(value.type) || "media"
    const prompt = textValue(item.prompt) || textValue(value.prompt)
    links.push({
      type: "resource_link",
      uri: url,
      name: prompt ? truncate(prompt, 120) : `Generated ${kind}`,
      description: prompt ? truncate(prompt, 240) : undefined,
      mimeType: textValue(item.mimeType) || mimeTypeForKind(kind),
      annotations: { audience: ["user"], priority: 0.9 },
    })
  }

  const directUrl = textValue(value.url)
  if (directUrl && !seen.has(directUrl)) {
    const kind = textValue(value.type) || "media"
    links.push({
      type: "resource_link",
      uri: directUrl,
      name: textValue(value.prompt) ? truncate(String(value.prompt), 120) : `Generated ${kind}`,
      mimeType: mimeTypeForKind(kind),
      annotations: { audience: ["user"], priority: 0.9 },
    })
  }

  return links
}

function formatModelCatalog(models: unknown[]) {
  if (models.length === 0) return "No active UniCan models are available."

  const rows = models.map((model) => {
    const value = model && typeof model === "object" ? (model as JsonObject) : {}
    const label = textValue(value.label) || textValue(value.name) || textValue(value.identifier) || "Unnamed model"
    const identifier = textValue(value.identifier) || "unknown"
    const details = [
      textValue(value.type) || textValue(value.kind),
      textValue(value.provider),
      textValue(value.description),
      formatModelCapabilities(value),
      formatModelSettings(value),
      formatModelCost(value),
    ].filter(Boolean)
    return `- ${label}\n  id: ${identifier}${details.length ? `\n  ${details.join("\n  ")}` : ""}`
  })

  return `Active UniCan models (${models.length}):\n${rows.join("\n")}`
}

function formatModelCapabilities(model: JsonObject) {
  const capabilities = [
    model.supportsReferenceImage === true ? "reference images" : null,
    model.supportsReferenceVideo === true ? "reference videos" : null,
    model.supportsReferenceAudio === true ? "reference audio" : null,
    model.supportsFirstFrame === true ? "first frame" : null,
    model.supportsLastFrame === true ? "last frame" : null,
  ].filter(Boolean)
  return capabilities.length ? `supports: ${capabilities.join(", ")}` : null
}

function formatModelSettings(model: JsonObject) {
  const settings = [
    arrayValues(model.aspectRatios).length ? `aspect ratios: ${arrayValues(model.aspectRatios).join(", ")}` : null,
    textValue(model.defaultAspectRatio) ? `default aspect ratio: ${textValue(model.defaultAspectRatio)}` : null,
    valueText(model.durationOptions) ? `durations: ${valueText(model.durationOptions)}` : null,
    typeof model.maxImages === "number" ? `max images: ${model.maxImages}` : null,
    valueText(model.parameters) ? `parameters: ${valueText(model.parameters)}` : null,
  ].filter(Boolean)
  return settings.length ? settings.join(" | ") : null
}

function formatModelCost(model: JsonObject) {
  const values = [
    typeof model.modelCost === "number" ? `cost: ${model.modelCost} credits` : null,
    typeof model.modelCostPerSecond === "number" ? `cost: ${model.modelCostPerSecond} credits/sec` : null,
  ].filter(Boolean)
  return values.length ? values.join(" | ") : null
}

function formatMediaSearch(media: unknown[]) {
  if (media.length === 0) return "No matching media was found."
  const rows = media.map((entry) => {
    const value = entry && typeof entry === "object" ? (entry as JsonObject) : {}
    const mediaId = textValue(value.mediaId) || "unknown"
    const title = textValue(value.title) || "Untitled media"
    const details = [
      textValue(value.type),
      textValue(value.source),
      textValue(value.status),
      textValue(value.description),
    ].filter(Boolean)
    const tags = arrayValues(value.tags)
    return `- ${title}\n  mediaId: ${mediaId}${details.length ? `\n  ${details.join(" | ")}` : ""}${tags.length ? `\n  tags: ${tags.join(", ")}` : ""}`
  })
  return `Matching UniCan media (${media.length}):\n${rows.join("\n")}`
}

function mimeTypeForKind(kind: string) {
  if (kind === "video") return "video/mp4"
  if (kind === "audio") return "audio/mpeg"
  if (kind === "image") return "image/png"
  return undefined
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function arrayValues(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : []
}

function valueText(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return value.trim() || null
  try {
    const serialized = JSON.stringify(value)
    return serialized.length > 700 ? `${serialized.slice(0, 697)}...` : serialized
  } catch {
    return null
  }
}
