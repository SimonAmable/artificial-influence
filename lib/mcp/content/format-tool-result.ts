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
  const catalogMedia = getCatalogMedia(value)

  if (Array.isArray(value.models)) {
    return {
      content: [{ type: "text", text: formatModelCatalog(value.models) }],
    }
  }

  if (catalogMedia) {
    const blocks: McpContentBlock[] = [
      {
        type: "text",
        text:
          toolName === "list_characters"
            ? formatCharacterList(catalogMedia)
            : formatMediaSearch(catalogMedia),
      },
    ]

    for (const entry of catalogMedia) {
      if (!entry || typeof entry !== "object") continue
      const row = entry as JsonObject
      const title = textValue(row.title) || "Media"
      const previewUrl = textValue(row.previewUrl)
      const pageUrl = textValue(row.pageUrl)
      const type = textValue(row.type)

      if (previewUrl && type === "image") {
        blocks.push({
          type: "resource_link",
          uri: previewUrl,
          name: title,
          mimeType: "image/png",
          annotations: { audience: ["assistant"], priority: 0.85 },
        })
      }

      if (pageUrl) {
        blocks.push({
          type: "resource_link",
          uri: pageUrl,
          name: `Open ${title} in UniCan`,
          annotations: { audience: ["user"], priority: 0.9 },
        })
      }
    }

    return { content: blocks }
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
    const pageUrl = textValue(generation.pageUrl) || textValue(generation.openUrl)
    const isFailed = status === "failed" || status === "error" || status === "cancelled" || status === "canceled"

    return {
      content: [
        {
          type: "text",
          text: summarizeSingleGeneration({
            status,
            type,
            url,
            generationId,
            pageUrl,
            error: textValue(generation.error),
          }),
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
    const pageUrl = textValue(value.pageUrl) || textValue(value.openUrl)
    const isFailed = status === "failed" || status === "error"

    return {
      content: [
        {
          type: "text",
          text: summarizeMediaBatch({
            toolName,
            status,
            type,
            generationId,
            pageUrl,
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
  pageUrl: string | null
  error: string | null
}) {
  if (input.status === "completed" && (input.pageUrl || input.url)) {
    return input.pageUrl
      ? `Your ${input.type} is ready. Open in UniCan: ${input.pageUrl}`
      : `Your ${input.type} is ready.`
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
  pageUrl: string | null
  error: string | null
  itemCount: number
}) {
  if (input.status === "completed") {
    const countLabel =
      input.itemCount === 1 ? `Your ${input.type} is ready.` : `${input.itemCount} ${input.type} outputs are ready.`
    return input.pageUrl ? `${countLabel} Open in UniCan: ${input.pageUrl}` : countLabel
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

    const pageUrl =
      textValue(item.pageUrl) ||
      textValue(item.openUrl) ||
      textValue(value.pageUrl) ||
      textValue(value.openUrl)
    const mediaUrl =
      textValue(item.mediaUrl) ||
      textValue(item.downloadUrl) ||
      textValue(item.thumbnailUrl) ||
      textValue(item.url)
    if ((!pageUrl && !mediaUrl) || seen.has(pageUrl || mediaUrl || "")) continue
    if (pageUrl) seen.add(pageUrl)
    if (mediaUrl) seen.add(mediaUrl)

    const kind = textValue(item.type) || textValue(item.kind) || textValue(value.type) || "media"
    const prompt = textValue(item.prompt) || textValue(value.prompt)
    const label = prompt ? truncate(prompt, 120) : `Generated ${kind}`

    if (pageUrl) {
      links.push({
        type: "resource_link",
        uri: pageUrl,
        name: "Open in UniCan",
        description: label,
        mimeType: mimeTypeForKind(kind),
        annotations: { audience: ["user"], priority: 0.95 },
      })
    } else if (mediaUrl) {
      links.push({
        type: "resource_link",
        uri: mediaUrl,
        name: label,
        mimeType: mimeTypeForKind(kind),
        annotations: { audience: ["user"], priority: 0.9 },
      })
    }
  }

  const directPageUrl = textValue(value.pageUrl) || textValue(value.openUrl)
  const directUrl = textValue(value.url)
  if (directPageUrl && !seen.has(directPageUrl)) {
    const kind = textValue(value.type) || "media"
    links.push({
      type: "resource_link",
      uri: directPageUrl,
      name: "Open in UniCan",
      mimeType: mimeTypeForKind(kind),
      annotations: { audience: ["user"], priority: 0.95 },
    })
  } else if (directUrl && !seen.has(directUrl)) {
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

function getCatalogMedia(value: JsonObject): unknown[] | null {
  if (Array.isArray(value.characters)) return value.characters
  if (Array.isArray(value.media)) return value.media
  return null
}

function formatCharacterList(characters: unknown[]) {
  if (characters.length === 0) {
    return "No saved characters yet. Save a face in UniCan (Library → Characters), then call list_characters again."
  }

  return `Saved characters (${characters.length}):\n${formatMediaSearch(characters)}`
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
      textValue(value.category),
      textValue(value.description),
    ].filter(Boolean)
    const tags = arrayValues(value.tags)
    const previewUrl = textValue(value.previewUrl)
    const pageUrl = textValue(value.pageUrl)
    return `- ${title}\n  mediaId: ${mediaId}${details.length ? `\n  ${details.join(" | ")}` : ""}${tags.length ? `\n  tags: ${tags.join(", ")}` : ""}${previewUrl ? `\n  previewUrl: ${previewUrl}` : ""}${pageUrl ? `\n  pageUrl: ${pageUrl}` : ""}`
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
