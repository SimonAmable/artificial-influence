import "server-only"

import { filterPublicCatalogModels } from "@/lib/server/model-catalog-visibility"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { McpAuthContext } from "@/lib/mcp/auth"
import { UNICAN_MEDIA_WIDGET_URI } from "@/lib/mcp/widget"
import { resolveAssetAccessUrl, type AssetAccessRow } from "@/lib/assets/resolve-asset-access-url"

type JsonObject = Record<string, unknown>
type ToolMeta = {
  ui?: {
    resourceUri?: string
    visibility?: Array<"model" | "app">
  }
  [key: string]: unknown
}

type ToolDefinition = {
  name: string
  title: string
  description: string
  inputSchema: JsonObject
  outputSchema: JsonObject
  scopes: string[]
  annotations?: JsonObject
  _meta?: ToolMeta
}

const BEARER_SECURITY_SCHEMES = [{ type: "http", scheme: "bearer" }]
const GENERATION_TOOL_META = {
  ui: {
    resourceUri: UNICAN_MEDIA_WIDGET_URI,
    visibility: ["model", "app"],
  },
} satisfies ToolMeta

type MediaKind = "image" | "video" | "audio"
type MediaReferenceRole = "reference_image" | "first_frame" | "last_frame" | "reference_video" | "reference_audio"
type ResolvedMedia = {
  mediaId: string
  source: "asset" | "generation"
  sourceId: string
  type: MediaKind
  status: string
  title: string
  url: string | null
}

export const MCP_TOOLS: ToolDefinition[] = [
  {
    name: "get_account",
    title: "Get account",
    description: "Return the connected Unican account id and email.",
    scopes: ["account:read"],
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: accountOutputSchema(),
    annotations: readOnlyAnnotations(),
  },
  {
    name: "list_models",
    title: "List models",
    description: "List every active Unican generation model at once. This tool accepts no input; group or choose models from the returned model metadata.",
    scopes: ["models:read"],
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: modelsOutputSchema(),
    annotations: readOnlyAnnotations(),
  },
  {
    name: "list_generations",
    title: "List generations",
    description: "List recent generation history for the connected user.",
    scopes: ["generations:read"],
    inputSchema: generationListSchema(),
    outputSchema: generationListOutputSchema(),
    annotations: readOnlyAnnotations(),
  },
  {
    name: "search_media",
    title: "Search media",
    description: "Find the connected user's reusable library assets and completed generations. Returns stable media IDs for use as generation references.",
    scopes: ["assets:read", "generations:read"],
    inputSchema: mediaSearchSchema(),
    outputSchema: mediaSearchOutputSchema(),
    annotations: readOnlyAnnotations(),
  },
  {
    name: "search_generations",
    title: "Search generations",
    description: "Search generation history by prompt, model, type, status, or tool.",
    scopes: ["generations:read"],
    inputSchema: generationListSchema({ includeSearch: true }),
    outputSchema: generationListOutputSchema(),
    annotations: readOnlyAnnotations(),
  },
  {
    name: "get_generation",
    title: "Get generation",
    description: "Refresh the status and output of an existing UniCan generation. Used by the generation card after a creation has started.",
    scopes: ["generations:read"],
    inputSchema: {
      type: "object",
      properties: {
        generationId: { type: "string", description: "Generation UUID." },
      },
      required: ["generationId"],
      additionalProperties: false,
    },
    outputSchema: generationOutputSchema(),
    annotations: readOnlyAnnotations(),
    _meta: { ui: { visibility: ["app"] } },
  },
  {
    name: "generate_image",
    title: "Generate image",
    description: "Create an image using an active Unican image model.",
    scopes: ["generations:write"],
    inputSchema: generateImageSchema(),
    outputSchema: generatedMediaOutputSchema(),
    annotations: billableGenerationAnnotations(),
    _meta: GENERATION_TOOL_META,
  },
  {
    name: "generate_video",
    title: "Generate video",
    description: "Create a video using an active Unican video model.",
    scopes: ["generations:write"],
    inputSchema: generateVideoSchema(),
    outputSchema: generatedMediaOutputSchema(),
    annotations: billableGenerationAnnotations(),
    _meta: GENERATION_TOOL_META,
  },
  {
    name: "generate_audio",
    title: "Generate audio",
    description: "Create text-to-speech audio using an active Unican audio provider.",
    scopes: ["generations:write"],
    inputSchema: generateAudioSchema(),
    outputSchema: generatedMediaOutputSchema(),
    annotations: billableGenerationAnnotations(),
    _meta: GENERATION_TOOL_META,
  },
]

export function serializeToolDefinition(tool: ToolDefinition) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    annotations: tool.annotations,
    securitySchemes: BEARER_SECURITY_SCHEMES,
    _meta: {
      securitySchemes: BEARER_SECURITY_SCHEMES,
      ...tool._meta,
    },
  }
}

export function getToolDefinition(name: string) {
  return MCP_TOOLS.find((tool) => tool.name === name) || null
}

export async function callMcpTool(options: {
  auth: McpAuthContext
  args: JsonObject
  name: string
  origin: string
}) {
  switch (options.name) {
    case "get_account":
      return getAccount(options.auth)
    case "list_models":
      return listModels(options.args)
    case "list_generations":
      return listGenerations(options.auth.user.id, options.args)
    case "search_media":
      return searchMedia(options.auth.user.id, options.args)
    case "search_generations":
      return listGenerations(options.auth.user.id, options.args)
    case "get_generation":
      return getGeneration(options.auth.user.id, String(options.args.generationId || ""))
    case "generate_image":
      return generateImage(options)
    case "generate_video":
      return generateVideo(options)
    case "generate_audio":
      return generateAudio(options)
    default:
      throw new Error(`Unknown MCP tool: ${options.name}`)
  }
}

async function getAccount(auth: McpAuthContext) {
  const supabase = requireServiceRole()
  const { data: profile } = await supabase
    .from("profiles")
    .select("credits, is_pro")
    .eq("id", auth.user.id)
    .maybeSingle()

  return {
    account: {
      id: auth.user.id,
      email: auth.user.email || null,
      credits: typeof profile?.credits === "number" ? profile.credits : null,
      isPro: Boolean(profile?.is_pro),
    },
  }
}

export async function auditMcpToolCall(input: {
  auth: McpAuthContext
  toolName: string
  status: "success" | "error"
  request: JsonObject
  response: JsonObject
  errorMessage?: string | null
  generationId?: string | null
}) {
  const supabase = createServiceRoleClient()
  if (!supabase) return

  await supabase.from("mcp_tool_calls").insert({
    user_id: input.auth.user.id,
    client_id: input.auth.clientId,
    token_id: input.auth.tokenId,
    tool_name: input.toolName,
    status: input.status,
    error_message: input.errorMessage || null,
    generation_id: input.generationId || null,
    request: input.request,
    response: input.response,
  })
}

async function listModels(args: JsonObject) {
  const supabase = requireServiceRole()
  void args

  const query = supabase
    .from("models")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true })

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const models = filterPublicCatalogModels(data || []).map((model) => {
    const aspectRatios = stringArray(model.aspect_ratios)
    const type = typeof model.type === "string" ? model.type : "model"
    const provider = typeof model.provider === "string" ? model.provider : null
    return {
      id: model.id,
      identifier: model.identifier,
      label: model.name,
      name: model.name,
      description: model.description,
      kind: type,
      type,
      provider,
      badges: [
        type,
        provider,
        aspectRatios.length > 0 ? aspectRatios.join(", ") : null,
        model.max_images && Number(model.max_images) > 1 ? `up to ${model.max_images}` : null,
      ].filter(Boolean),
      modelCost: model.model_cost,
      modelCostPerSecond: model.model_cost_per_second ?? null,
      supportsReferenceImage: Boolean(model.supports_reference_image),
      supportsReferenceVideo: Boolean(model.supports_reference_video),
      supportsReferenceAudio: Boolean(model.supports_reference_audio),
      supportsFirstFrame: Boolean(model.supports_first_frame),
      supportsLastFrame: Boolean(model.supports_last_frame),
      aspectRatios,
      defaultAspectRatio: typeof model.default_aspect_ratio === "string" ? model.default_aspect_ratio : null,
      durationOptions: model.duration_options ?? null,
      maxImages: model.max_images ?? null,
      parameters: model.parameters ?? null,
      defaultSettings: {
        aspectRatio: typeof model.default_aspect_ratio === "string" ? model.default_aspect_ratio : null,
      },
    }
  })

  return {
    models,
    total: models.length,
    groups: groupCounts(models.map((model) => model.type)),
  }
}

async function listGenerations(userId: string, args: JsonObject) {
  const supabase = requireServiceRole()
  const limit = clampInt(args.limit, 1, 50, 20)
  const offset = clampInt(args.offset, 0, 10000, 0)
  const search = typeof args.search === "string" ? args.search.trim().slice(0, 120) : ""

  let query = supabase
    .from("generations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (isMediaType(args.type)) query = query.eq("type", args.type)
  if (typeof args.model === "string" && args.model.trim()) query = query.eq("model", args.model.trim())
  if (typeof args.status === "string" && args.status.trim()) query = query.eq("status", args.status.trim())
  if (typeof args.tool === "string" && args.tool.trim()) query = query.eq("tool", args.tool.trim())

  if (search) {
    const escaped = search.replace(/[\\%_]/g, (match) => `\\${match}`).replace(/[,()]/g, " ")
    const pattern = `%${escaped}%`
    query = query.or([
      `prompt.ilike.${pattern}`,
      `model.ilike.${pattern}`,
      `tool.ilike.${pattern}`,
      `type.ilike.${pattern}`,
    ].join(","))
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  const generations = (data || []).map((row) => mapGeneration(row))
  const items = generations.map(generationToMediaItem)

  return {
    generations,
    items,
    pagination: {
      limit,
      offset,
      returned: data?.length ?? 0,
      hasMore: (data?.length ?? 0) === limit,
    },
  }
}

async function searchMedia(userId: string, args: JsonObject) {
  const supabase = requireServiceRole()
  const limit = clampInt(args.limit, 1, 40, 12)
  const search = typeof args.search === "string" ? args.search.trim().slice(0, 120) : ""
  const requestedType = isMediaType(args.type) ? args.type : null
  const source = args.source === "asset" || args.source === "generation" ? args.source : null
  const queryLimit = source ? limit : Math.max(1, Math.ceil(limit / 2))
  const media: JsonObject[] = []

  if (source !== "generation") {
    let query = supabase
      .from("assets")
      .select("id, asset_type, title, description, tags, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(queryLimit)

    if (requestedType) query = query.eq("asset_type", requestedType)
    if (search) {
      const pattern = `%${escapeLike(search)}%`
      query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    for (const row of data || []) {
      const id = String(row.id)
      const type = isMediaType(row.asset_type) ? row.asset_type : "image"
      media.push({
        mediaId: mediaIdFor("asset", id),
        source: "asset",
        type,
        status: "ready",
        title: typeof row.title === "string" ? row.title : "Untitled asset",
        description: typeof row.description === "string" ? row.description : null,
        tags: Array.isArray(row.tags) ? row.tags : [],
        createdAt: typeof row.created_at === "string" ? row.created_at : null,
      })
    }
  }

  if (source !== "asset") {
    let query = supabase
      .from("generations")
      .select("id, type, status, prompt, model, created_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(queryLimit)

    if (requestedType) query = query.eq("type", requestedType)
    if (search) {
      const pattern = `%${escapeLike(search)}%`
      query = query.or(`prompt.ilike.${pattern},model.ilike.${pattern}`)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    for (const row of data || []) {
      const id = String(row.id)
      const type = isMediaType(row.type) ? row.type : "image"
      const prompt = typeof row.prompt === "string" ? row.prompt : null
      media.push({
        mediaId: mediaIdFor("generation", id),
        source: "generation",
        type,
        status: typeof row.status === "string" ? row.status : "completed",
        title: prompt || (typeof row.model === "string" ? row.model : "Generated media"),
        description: prompt,
        tags: [],
        createdAt: typeof row.created_at === "string" ? row.created_at : null,
      })
    }
  }

  return { media: media.slice(0, limit) }
}

async function getGeneration(userId: string, generationId: string) {
  if (!generationId) throw new Error("generationId is required")
  const supabase = requireServiceRole()
  const { data, error } = await supabase
    .from("generations")
    .select("*")
    .eq("id", generationId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Generation not found")
  const generation = mapGeneration(data)
  return {
    generation,
    items: [generationToMediaItem(generation)],
    prompt: stringOrNull(generation.prompt),
    model: stringOrNull(generation.model),
    status: stringOrNull(generation.status),
  }
}

async function generateImage(options: {
  auth: McpAuthContext
  args: JsonObject
  origin: string
}) {
  const form = new FormData()
  appendString(form, "prompt", options.args.prompt)
  appendString(form, "model", options.args.model)
  form.set("tool", "mcp")

  const referenceUrls = collectStringArray(options.args.referenceImageUrls)
  const references = await resolveMediaReferences(options.auth.user.id, options.args.referenceMedia)
  for (const reference of references) {
    if (reference.role !== "reference_image") {
      throw new Error("Image generation only accepts reference_image media references")
    }
    if (reference.media.type !== "image") {
      throw new Error("Image generation references must be images")
    }
    if (!reference.media.url) throw new Error(`Media ${reference.media.mediaId} is not ready to use`)
    referenceUrls.push(reference.media.url)
  }
  if (typeof options.args.sourceGenerationId === "string") {
    const source = await resolveGenerationUrl(options.auth.user.id, options.args.sourceGenerationId)
    if (source?.url) referenceUrls.push(source.url)
  }

  for (const url of [...new Set(referenceUrls)]) {
    form.append("referenceImageUrls", url)
  }

  appendOptionsToForm(form, options.args.options)

  const response = await fetch(`${options.origin}/api/generate-image`, {
    method: "POST",
    headers: { authorization: `Bearer ${options.auth.rawToken}` },
    body: form,
  })

  return normalizeGenerationResponse(await safeJson(response), response.status, {
    type: "image",
    model: stringOrNull(options.args.model),
    prompt: stringOrNull(options.args.prompt),
  })
}

async function generateVideo(options: {
  auth: McpAuthContext
  args: JsonObject
  origin: string
}) {
  const body: JsonObject = {
    ...(isPlainObject(options.args.options) ? options.args.options : {}),
    tool: "mcp",
  }
  copyString(options.args, body, "prompt")
  copyString(options.args, body, "model")
  copyString(options.args, body, "image")
  copyString(options.args, body, "first_frame_image")
  copyString(options.args, body, "last_frame_image")
  copyString(options.args, body, "video")
  copyString(options.args, body, "reference_video")

  const references = await resolveMediaReferences(options.auth.user.id, options.args.referenceMedia)
  for (const reference of references) {
    if (!reference.media.url) throw new Error(`Media ${reference.media.mediaId} is not ready to use`)
    switch (reference.role) {
      case "reference_image":
        if (reference.media.type !== "image") throw new Error("reference_image must use an image")
        assignReferenceUrl(body, "image", reference.media.url)
        break
      case "first_frame":
        if (reference.media.type !== "image") throw new Error("first_frame must use an image")
        assignReferenceUrl(body, "first_frame_image", reference.media.url)
        break
      case "last_frame":
        if (reference.media.type !== "image") throw new Error("last_frame must use an image")
        assignReferenceUrl(body, "last_frame_image", reference.media.url)
        break
      case "reference_video":
        if (reference.media.type !== "video") throw new Error("reference_video must use a video")
        assignReferenceUrl(body, "reference_video", reference.media.url)
        break
      default:
        throw new Error(`${reference.role} is not supported for video generation`)
    }
  }

  if (typeof options.args.sourceGenerationId === "string" && !body.image && !body.first_frame_image) {
    const source = await resolveGenerationUrl(options.auth.user.id, options.args.sourceGenerationId)
    if (source?.url) {
      body.image = source.url
      body.first_frame_image = source.url
    }
  }

  const response = await fetch(`${options.origin}/api/generate-video-any-model`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.auth.rawToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  return normalizeGenerationResponse(await safeJson(response), response.status, {
    type: "video",
    model: stringOrNull(options.args.model),
    prompt: stringOrNull(options.args.prompt),
  })
}

async function generateAudio(options: {
  auth: McpAuthContext
  args: JsonObject
  origin: string
}) {
  if (Array.isArray(options.args.referenceMedia) && options.args.referenceMedia.length > 0) {
    throw new Error("Audio generation does not support media references yet")
  }
  const body: JsonObject = {
    ...(isPlainObject(options.args.options) ? options.args.options : {}),
  }
  copyString(options.args, body, "text")
  copyString(options.args, body, "provider")
  copyString(options.args, body, "model")
  copyString(options.args, body, "voice")
  copyString(options.args, body, "stylePrompt")
  copyString(options.args, body, "languageCode")

  const response = await fetch(`${options.origin}/api/generate-audio`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.auth.rawToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  return normalizeGenerationResponse(await safeJson(response), response.status, {
    type: "audio",
    model: stringOrNull(options.args.model),
    prompt: stringOrNull(options.args.text),
  })
}

async function resolveGenerationUrl(userId: string, generationId: string) {
  const { generation } = await getGeneration(userId, generationId)
  if (!generation || typeof generation !== "object") return null
  const url = (generation as { url?: unknown }).url
  const storagePath = (generation as { storagePath?: unknown }).storagePath
  return {
    url: typeof url === "string" ? url : null,
    storagePath: typeof storagePath === "string" ? storagePath : null,
  }
}

async function resolveMediaReferences(userId: string, value: unknown) {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error("referenceMedia must be an array")
  const references: Array<{ role: MediaReferenceRole; media: ResolvedMedia }> = []
  const roles = new Set<MediaReferenceRole>()

  for (const entry of value) {
    if (!isPlainObject(entry)) throw new Error("Each media reference must be an object")
    const mediaId = stringOrNull(entry.mediaId)
    const role = stringOrNull(entry.role) as MediaReferenceRole | null
    if (!mediaId || !role || !isMediaReferenceRole(role)) {
      throw new Error("Each media reference needs a valid mediaId and role")
    }
    if (role !== "reference_image" && roles.has(role)) {
      throw new Error(`Only one ${role} media reference is allowed`)
    }
    roles.add(role)
    references.push({ role, media: await resolveMediaId(userId, mediaId) })
  }

  return references
}

async function resolveMediaId(userId: string, mediaId: string): Promise<ResolvedMedia> {
  const parsed = parseMediaId(mediaId)
  if (!parsed) throw new Error("Invalid mediaId. Use an ID returned by search_media or a generation result")
  const supabase = requireServiceRole()

  if (parsed.source === "asset") {
    const { data, error } = await supabase
      .from("assets")
      .select("id, user_id, asset_type, title, asset_url, thumbnail_url, upload_id, supabase_storage_path, visibility")
      .eq("id", parsed.id)
      .eq("user_id", userId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error("Media not found or not available to this account")
    const asset = data as AssetAccessRow & { id: string; asset_type: unknown; title: unknown }
    const type = isMediaType(asset.asset_type) ? asset.asset_type : null
    if (!type) throw new Error("Media has an unsupported type")
    return {
      mediaId: mediaIdFor("asset", asset.id),
      source: "asset",
      sourceId: asset.id,
      type,
      status: "ready",
      title: typeof asset.title === "string" ? asset.title : "Untitled asset",
      url: await resolveAssetAccessUrl(supabase, asset),
    }
  }

  const { generation } = await getGeneration(userId, parsed.id)
  const type = generation && typeof generation === "object" && isMediaType((generation as Record<string, unknown>).type)
    ? (generation as Record<string, unknown>).type
    : null
  const status = generation && typeof generation === "object" ? stringOrNull((generation as Record<string, unknown>).status) : null
  const url = generation && typeof generation === "object" ? stringOrNull((generation as Record<string, unknown>).url) : null
  if (!type || status !== "completed" || !url) throw new Error("Generated media is not ready to use as a reference")
  return {
    mediaId: mediaIdFor("generation", parsed.id),
    source: "generation",
    sourceId: parsed.id,
    type,
    status,
    title: stringOrNull((generation as Record<string, unknown>).prompt) || "Generated media",
    url,
  }
}

function assignReferenceUrl(body: JsonObject, key: string, url: string) {
  if (typeof body[key] === "string" && body[key] !== url) {
    throw new Error(`Use either ${key} or referenceMedia for that reference, not both`)
  }
  body[key] = url
}

function mapGeneration(row: Record<string, unknown>) {
  const storagePath = typeof row.supabase_storage_path === "string" ? row.supabase_storage_path : null
  const supabase = requireServiceRole()
  const url = storagePath
    ? supabase.storage.from("public-bucket").getPublicUrl(storagePath).data.publicUrl
    : null

  return {
    generationId: row.id,
    mediaId: mediaIdFor("generation", String(row.id)),
    status: row.status || "completed",
    type: row.type,
    model: row.model,
    prompt: row.prompt,
    url,
    storagePath,
    tool: row.tool ?? null,
    createdAt: row.created_at,
    finishedAt: row.finished_at ?? null,
    error: row.error_message ?? null,
    referenceImageStoragePaths: row.reference_images_supabase_storage_path ?? null,
    referenceVideoStoragePaths: row.reference_videos_supabase_storage_path ?? null,
    predictionId: row.replicate_prediction_id ?? row.fal_request_id ?? null,
  }
}

function generationToMediaItem(generation: Record<string, unknown>) {
  const kind = typeof generation.type === "string" ? generation.type : "image"
  const url = stringOrNull(generation.url)
  const status = stringOrNull(generation.status) || (url ? "completed" : "pending")
  const generationId = stringOrNull(generation.generationId) || stringOrNull(generation.id)
  return {
    id: generationId,
    generationId,
    mediaId: stringOrNull(generation.mediaId) || (generationId ? mediaIdFor("generation", generationId) : null),
    status,
    kind,
    type: kind,
    mediaUrl: url,
    thumbnailUrl: url,
    downloadUrl: url,
    mimeType: mimeTypeForKind(kind),
    model: stringOrNull(generation.model),
    prompt: stringOrNull(generation.prompt),
    error: stringOrNull(generation.error),
    createdAt: stringOrNull(generation.createdAt),
  }
}

function normalizeGenerationResponse(
  body: unknown,
  statusCode: number,
  fallback: { type?: string | null; model?: string | null; prompt?: string | null } = {},
) {
  if (!isPlainObject(body)) {
    const status = statusCode >= 400 ? "failed" : "completed"
    const base = {
      generationId: null,
      statusCode,
      status,
      type: fallback.type ?? null,
      model: fallback.model ?? null,
      prompt: fallback.prompt ?? null,
      url: null,
      raw: body,
    }
    return {
      ...base,
      settings: buildSettings(fallback.model ?? null, fallback.prompt ?? null, null, 1),
      items: [generationToMediaItem(base)],
    }
  }

  const generationId =
    stringOrNull(body.generationId) ||
    stringOrNull(body.id) ||
    (Array.isArray(body.generationIds) ? body.generationIds[0] : null)

  const url =
    stringOrNull(body.videoUrl) ||
    (isPlainObject(body.image) ? stringOrNull(body.image.url) : null) ||
    (isPlainObject(body.video) ? stringOrNull(body.video.url) : null) ||
    (isPlainObject(body.audio) ? stringOrNull(body.audio.url) : null) ||
    (Array.isArray(body.images) && isPlainObject(body.images[0]) ? stringOrNull(body.images[0].url) : null)

  const status = stringOrNull(body.status) || (statusCode >= 400 ? "failed" : statusCode === 202 ? "pending" : "completed")
  const type = inferResponseType(body) || fallback.type || null
  const model = stringOrNull(body.model) || (isPlainObject(body.usage) ? stringOrNull(body.usage.modelId) : null) || fallback.model || null
  const prompt = stringOrNull(body.prompt) || fallback.prompt || null
  const generationIds = Array.isArray(body.generationIds) ? body.generationIds : generationId ? [generationId] : []
  const mediaItems = extractMediaItems(body, {
    generationId,
    generationIds,
    status,
    type,
    model,
    prompt,
    url,
    error: stringOrNull(body.error) || stringOrNull(body.message),
  })

  return {
    statusCode,
    generationId,
    mediaId: generationId ? mediaIdFor("generation", generationId) : null,
    generationIds,
    status,
    type,
    model,
    prompt,
    url,
    createdAt: stringOrNull(body.createdAt),
    error: stringOrNull(body.error) || stringOrNull(body.message),
    settings: buildSettings(model, prompt, optionsFromBody(body), mediaItems.length || 1),
    items: mediaItems,
    result: body,
  }
}

function extractMediaItems(
  body: JsonObject,
  fallback: {
    generationId: string | null
    generationIds: unknown[]
    status: string
    type: string | null
    model: string | null
    prompt: string | null
    url: string | null
    error: string | null
  },
) {
  const items: JsonObject[] = []
  const images = Array.isArray(body.images) ? body.images : []
  images.forEach((image, index) => {
    const imageUrl = isPlainObject(image) ? stringOrNull(image.url) : stringOrNull(image)
    items.push(buildMediaItem({
      id: stringOrNull(fallback.generationIds[index]) || fallback.generationId,
      status: fallback.status,
      type: "image",
      url: imageUrl,
      model: fallback.model,
      prompt: fallback.prompt,
      error: fallback.error,
      createdAt: stringOrNull(body.createdAt),
    }))
  })

  if (items.length === 0) {
    items.push(buildMediaItem({
      id: fallback.generationId,
      status: fallback.status,
      type: fallback.type,
      url: fallback.url,
      model: fallback.model,
      prompt: fallback.prompt,
      error: fallback.error,
      createdAt: stringOrNull(body.createdAt),
    }))
  }

  return items
}

function buildMediaItem(input: {
  id: string | null
  status: string
  type: string | null
  url: string | null
  model: string | null
  prompt: string | null
  error: string | null
  createdAt: string | null
}) {
  const kind = input.type || "image"
  return {
    id: input.id,
    generationId: input.id,
    mediaId: input.id ? mediaIdFor("generation", input.id) : null,
    status: input.status,
    kind,
    type: kind,
    mediaUrl: input.url,
    thumbnailUrl: input.url,
    downloadUrl: input.url,
    mimeType: mimeTypeForKind(kind),
    model: input.model,
    prompt: input.prompt,
    error: input.error,
    createdAt: input.createdAt,
  }
}

function buildSettings(model: string | null, prompt: string | null, options: JsonObject | null, count: number) {
  void prompt
  return {
    model,
    aspectRatio: stringOrNull(options?.aspect_ratio) || stringOrNull(options?.aspectRatio),
    quality: stringOrNull(options?.quality) || stringOrNull(options?.resolution),
    count,
  }
}

function optionsFromBody(body: JsonObject) {
  if (isPlainObject(body.options)) return body.options
  if (isPlainObject(body.input)) return body.input
  return body
}

async function safeJson(response: Response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

function requireServiceRole() {
  const supabase = createServiceRoleClient()
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for MCP")
  return supabase
}

function generationListSchema(options: { includeSearch?: boolean } = {}) {
  return {
    type: "object",
    properties: {
      ...(options.includeSearch ? { search: { type: "string" } } : {}),
      type: { type: "string", enum: ["image", "video", "audio"] },
      model: { type: "string" },
      status: { type: "string" },
      tool: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 50 },
      offset: { type: "integer", minimum: 0 },
    },
    additionalProperties: false,
  }
}

function mediaSearchSchema() {
  return {
    type: "object",
    properties: {
      search: { type: "string", description: "Words from an asset title, description, generation prompt, or model." },
      type: { type: "string", enum: ["image", "video", "audio"] },
      source: { type: "string", enum: ["asset", "generation"] },
      limit: { type: "integer", minimum: 1, maximum: 40 },
    },
    additionalProperties: false,
  }
}

function generateImageSchema() {
  return {
    type: "object",
    properties: {
      prompt: { type: "string" },
      model: { type: "string" },
      referenceImageUrls: { type: "array", items: { type: "string" } },
      sourceGenerationId: { type: "string" },
      referenceMedia: mediaReferenceSchema(),
      options: { type: "object", additionalProperties: true },
    },
    required: ["prompt"],
    additionalProperties: false,
  }
}

function generateVideoSchema() {
  return {
    type: "object",
    properties: {
      prompt: { type: "string" },
      model: { type: "string" },
      image: { type: "string" },
      first_frame_image: { type: "string" },
      last_frame_image: { type: "string" },
      video: { type: "string" },
      reference_video: { type: "string" },
      sourceGenerationId: { type: "string" },
      referenceMedia: mediaReferenceSchema(),
      options: { type: "object", additionalProperties: true },
    },
    required: ["model"],
    additionalProperties: false,
  }
}

function generateAudioSchema() {
  return {
    type: "object",
    properties: {
      text: { type: "string" },
      provider: { type: "string" },
      model: { type: "string" },
      voice: { type: "string" },
      stylePrompt: { type: "string" },
      languageCode: { type: "string" },
      referenceMedia: mediaReferenceSchema(),
      options: { type: "object", additionalProperties: true },
    },
    required: ["text"],
    additionalProperties: false,
  }
}

function accountOutputSchema() {
  return {
    type: "object",
    properties: {
      account: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: ["string", "null"] },
          credits: { type: ["number", "null"] },
          isPro: { type: "boolean" },
        },
        required: ["id", "email", "credits", "isPro"],
        additionalProperties: false,
      },
    },
    required: ["account"],
    additionalProperties: false,
  }
}

function modelsOutputSchema() {
  return {
    type: "object",
    properties: {
      total: { type: "integer" },
      groups: {
        type: "object",
        additionalProperties: { type: "integer" },
      },
      models: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {},
            identifier: { type: "string" },
            label: { type: "string" },
            name: { type: "string" },
            description: { type: ["string", "null"] },
            kind: { type: "string" },
            type: { type: "string" },
            provider: { type: ["string", "null"] },
            badges: { type: "array", items: { type: "string" } },
            modelCost: { type: ["number", "null"] },
            modelCostPerSecond: { type: ["number", "null"] },
            supportsReferenceImage: { type: "boolean" },
            supportsReferenceVideo: { type: "boolean" },
            supportsReferenceAudio: { type: "boolean" },
            supportsFirstFrame: { type: "boolean" },
            supportsLastFrame: { type: "boolean" },
            aspectRatios: { type: "array", items: { type: "string" } },
            defaultAspectRatio: { type: ["string", "null"] },
            durationOptions: {},
            maxImages: {},
            parameters: {},
            defaultSettings: {
              type: "object",
              properties: {
                aspectRatio: { type: ["string", "null"] },
              },
              required: ["aspectRatio"],
              additionalProperties: false,
            },
          },
          required: [
            "id",
            "identifier",
            "label",
            "name",
            "description",
            "kind",
            "type",
            "provider",
            "badges",
            "modelCost",
            "modelCostPerSecond",
            "supportsReferenceImage",
            "supportsReferenceVideo",
            "supportsReferenceAudio",
            "supportsFirstFrame",
            "supportsLastFrame",
            "aspectRatios",
            "defaultAspectRatio",
            "durationOptions",
            "maxImages",
            "parameters",
            "defaultSettings",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["models", "total", "groups"],
    additionalProperties: false,
  }
}

function generationListOutputSchema() {
  return {
    type: "object",
    properties: {
      generations: {
        type: "array",
        items: generationSchema(),
      },
      items: {
        type: "array",
        items: mediaItemSchema(),
      },
      pagination: {
        type: "object",
        properties: {
          limit: { type: "integer" },
          offset: { type: "integer" },
          returned: { type: "integer" },
          hasMore: { type: "boolean" },
        },
        required: ["limit", "offset", "returned", "hasMore"],
        additionalProperties: false,
      },
    },
    required: ["generations", "items", "pagination"],
    additionalProperties: false,
  }
}

function mediaSearchOutputSchema() {
  return {
    type: "object",
    properties: {
      media: {
        type: "array",
        items: {
          type: "object",
          properties: {
            mediaId: { type: "string" },
            source: { type: "string", enum: ["asset", "generation"] },
            type: { type: "string", enum: ["image", "video", "audio"] },
            status: { type: "string" },
            title: { type: "string" },
            description: { type: ["string", "null"] },
            tags: { type: "array" },
            createdAt: { type: ["string", "null"] },
          },
          required: ["mediaId", "source", "type", "status", "title", "description", "tags", "createdAt"],
          additionalProperties: false,
        },
      },
    },
    required: ["media"],
    additionalProperties: false,
  }
}

function generationOutputSchema() {
  return {
    type: "object",
    properties: {
      generation: generationSchema(),
      items: { type: "array", items: mediaItemSchema() },
      prompt: { type: ["string", "null"] },
      model: { type: ["string", "null"] },
      status: { type: ["string", "null"] },
    },
    required: ["generation", "items", "prompt", "model", "status"],
    additionalProperties: false,
  }
}

function generatedMediaOutputSchema() {
  return {
    type: "object",
    properties: {
      statusCode: { type: "integer" },
      generationId: { type: ["string", "null"] },
      mediaId: { type: ["string", "null"] },
      generationIds: { type: "array" },
      status: { type: "string" },
      type: { type: ["string", "null"] },
      model: { type: ["string", "null"] },
      prompt: { type: ["string", "null"] },
      url: { type: ["string", "null"] },
      createdAt: { type: ["string", "null"] },
      error: { type: ["string", "null"] },
      settings: settingsSchema(),
      items: { type: "array", items: mediaItemSchema() },
      result: {},
      raw: {},
    },
    required: ["statusCode", "status", "type", "model", "prompt", "items", "settings"],
    additionalProperties: true,
  }
}

function generationSchema() {
  return {
    type: "object",
    properties: {
      generationId: {},
      status: {},
      type: {},
      model: {},
      prompt: {},
      url: { type: ["string", "null"] },
      storagePath: { type: ["string", "null"] },
      tool: {},
      createdAt: {},
      finishedAt: {},
      error: {},
      referenceImageStoragePaths: {},
      referenceVideoStoragePaths: {},
      predictionId: {},
    },
    required: [
      "generationId",
      "mediaId",
      "status",
      "type",
      "model",
      "prompt",
      "url",
      "storagePath",
      "tool",
      "createdAt",
      "finishedAt",
      "error",
      "referenceImageStoragePaths",
      "referenceVideoStoragePaths",
      "predictionId",
    ],
    additionalProperties: false,
  }
}

function mediaItemSchema() {
  return {
    type: "object",
    properties: {
      id: { type: ["string", "null"] },
      generationId: { type: ["string", "null"] },
      mediaId: { type: ["string", "null"] },
      status: { type: "string" },
      kind: { type: "string" },
      type: { type: "string" },
      mediaUrl: { type: ["string", "null"] },
      thumbnailUrl: { type: ["string", "null"] },
      downloadUrl: { type: ["string", "null"] },
      mimeType: { type: ["string", "null"] },
      model: { type: ["string", "null"] },
      prompt: { type: ["string", "null"] },
      error: { type: ["string", "null"] },
      createdAt: { type: ["string", "null"] },
    },
    required: [
      "id",
      "generationId",
      "mediaId",
      "status",
      "kind",
      "type",
      "mediaUrl",
      "thumbnailUrl",
      "downloadUrl",
      "mimeType",
      "model",
      "prompt",
      "error",
      "createdAt",
    ],
    additionalProperties: false,
  }
}

function settingsSchema() {
  return {
    type: "object",
    properties: {
      model: { type: ["string", "null"] },
      aspectRatio: { type: ["string", "null"] },
      quality: { type: ["string", "null"] },
      count: { type: "integer" },
    },
    required: ["model", "aspectRatio", "quality", "count"],
    additionalProperties: false,
  }
}

function mediaReferenceSchema() {
  return {
    type: "array",
    items: {
      type: "object",
      properties: {
        mediaId: { type: "string", description: "Stable media ID returned by search_media or a generation result." },
        role: { type: "string", enum: ["reference_image", "first_frame", "last_frame", "reference_video", "reference_audio"] },
      },
      required: ["mediaId", "role"],
      additionalProperties: false,
    },
  }
}

function readOnlyAnnotations() {
  return {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  }
}

function billableGenerationAnnotations() {
  return {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: false,
    idempotentHint: false,
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

function isMediaType(value: unknown): value is "image" | "video" | "audio" {
  return value === "image" || value === "video" || value === "audio"
}

function isMediaReferenceRole(value: string): value is MediaReferenceRole {
  return ["reference_image", "first_frame", "last_frame", "reference_video", "reference_audio"].includes(value)
}

function mediaIdFor(source: "asset" | "generation", id: string) {
  return `med_${source}_${id}`
}

function parseMediaId(value: string): { source: "asset" | "generation"; id: string } | null {
  const match = /^med_(asset|generation)_([a-zA-Z0-9-]+)$/.exec(value)
  if (!match) return null
  return { source: match[1] as "asset" | "generation", id: match[2] }
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`).replace(/[,()]/g, " ")
}

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null
}

function appendString(form: FormData, key: string, value: unknown) {
  if (typeof value === "string" && value.length > 0) {
    form.set(key, value)
  }
}

function appendOptionsToForm(form: FormData, options: unknown) {
  if (!isPlainObject(options)) return
  for (const [key, value] of Object.entries(options)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      form.set(key, String(value))
    }
  }
}

function copyString(source: JsonObject, target: JsonObject, key: string) {
  if (typeof source[key] === "string" && String(source[key]).length > 0) {
    target[key] = source[key]
  }
}

function collectStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

function groupCounts(values: string[]) {
  return values.reduce<Record<string, number>>((groups, value) => {
    groups[value] = (groups[value] || 0) + 1
    return groups
  }, {})
}

function mimeTypeForKind(kind: string) {
  if (kind === "video") return "video/mp4"
  if (kind === "audio") return "audio/mpeg"
  if (kind === "image") return "image/png"
  return null
}

function inferResponseType(body: JsonObject) {
  if (body.image || body.images) return "image"
  if (body.video || body.videoUrl) return "video"
  if (body.audio) return "audio"
  return null
}
