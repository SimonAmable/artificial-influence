import type { Edge, Node } from "@xyflow/react"
import {
  DEFAULT_IMAGE_MODEL_IDENTIFIER,
  getModelByIdentifier,
} from "@/lib/constants/models"
import { resolveAspectRatioForRequest } from "@/lib/utils/aspect-ratios"
import type { ExecutionCallbacks, NodeOutput } from "./types"

export interface WorkflowExecutionOptions {
  inputEdges?: Edge[]
  fallbackNodes?: Node[]
}

export interface WorkflowExecutionRuntime {
  generateText(input: {
    prompt: string
    currentText: string
    images?: Array<{ url: string; mediaType: string }>
  }): Promise<{ text: string }>
  generateImage(input: {
    prompt: string
    modelIdentifier: string
    aspectRatio: string
    enhancePrompt: boolean
    referenceImageUrls: string[]
  }): Promise<{ imageUrl: string; imageUrls?: string[] }>
  generateVideo(input: {
    imageUrl: string
    videoUrl: string
    prompt: string
    mode: string
  }): Promise<{ videoUrl: string }>
  generateAudio(input: {
    text: string
    provider: string
    voice: string
    model: string
    stylePrompt?: string
    languageCode?: string
  }): Promise<{ audioUrl: string }>
}

function getExecutionOrder(nodes: Node[], edges: Edge[]): string[] {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) {
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }

  for (const edge of edges) {
    const prev = inDegree.get(edge.target) ?? 0
    inDegree.set(edge.target, prev + 1)
    adjacency.get(edge.source)?.push(edge.target)
  }

  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }

  const order: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    order.push(id)
    for (const neighbor of adjacency.get(id) ?? []) {
      const next = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, next)
      if (next === 0) queue.push(neighbor)
    }
  }

  if (order.length !== nodes.length) {
    throw new Error("Workflow contains a cycle - cannot execute")
  }

  return order
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)))
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : []
}

function getOutputImageUrls(output: NodeOutput): string[] {
  return dedupeStrings([
    ...getStringArray(output.imageUrls),
    ...(typeof output.imageUrl === "string" && output.imageUrl.length > 0
      ? [output.imageUrl]
      : []),
  ])
}

function joinPromptParts(parts: Array<unknown>): string {
  return parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim())
    .join(" ")
}

function hasPromptInput(data: Record<string, unknown>): boolean {
  return typeof data.promptInput === "string" && data.promptInput.trim().length > 0
}

function collectInputs(
  targetId: string,
  edges: Edge[],
  outputs: Map<string, NodeOutput>,
  fallbackNodes: Map<string, Node>,
): NodeOutput {
  const merged: NodeOutput = {}
  const textParts: string[] = []
  const imageUrls: string[] = []

  for (const edge of edges) {
    if (edge.target !== targetId) continue

    const sourceOutput =
      outputs.get(edge.source) ?? getPersistedNodeOutput(fallbackNodes.get(edge.source))

    if (!sourceOutput) continue

    if (typeof sourceOutput.text === "string" && sourceOutput.text.trim().length > 0) {
      textParts.push(sourceOutput.text.trim())
    }

    for (const imageUrl of getOutputImageUrls(sourceOutput)) {
      imageUrls.push(imageUrl)
    }

    Object.assign(merged, sourceOutput)
  }

  if (textParts.length > 0) {
    merged.text = textParts.join(" ")
  }

  const uniqueImageUrls = dedupeStrings(imageUrls)
  if (uniqueImageUrls.length > 0) {
    merged.imageUrls = uniqueImageUrls
  }

  return merged
}

function getPersistedNodeOutput(node: Node | undefined): NodeOutput | undefined {
  if (!node) return undefined

  const data = node.data as Record<string, unknown>

  switch (node.type) {
    case "text":
      return { text: (data.text as string) || "" }

    case "upload": {
      const fileUrl = (data.fileUrl as string) || undefined
      const fileType = (data.fileType as string) || undefined

      return {
        fileUrl,
        fileType,
        imageUrl: fileType === "image" ? fileUrl : undefined,
        imageUrls: fileType === "image" && fileUrl ? [fileUrl] : undefined,
        videoUrl: fileType === "video" ? fileUrl : undefined,
        audioUrl: fileType === "audio" ? fileUrl : undefined,
      }
    }

    case "image-gen": {
      const generatedImageUrls = Array.isArray(data.generatedImageUrls)
        ? data.generatedImageUrls.filter(
            (url): url is string => typeof url === "string" && url.length > 0,
          )
        : []
      const activeImageIndex =
        typeof data.activeImageIndex === "number"
          ? data.activeImageIndex
          : generatedImageUrls.length - 1
      const generatedImageUrl =
        generatedImageUrls[activeImageIndex] ||
        (typeof data.generatedImageUrl === "string" ? data.generatedImageUrl : undefined)

      return generatedImageUrl
        ? { imageUrl: generatedImageUrl, imageUrls: [generatedImageUrl] }
        : undefined
    }

    case "video-gen":
      return typeof data.generatedVideoUrl === "string"
        ? { videoUrl: data.generatedVideoUrl }
        : undefined

    case "audio":
      return typeof data.generatedAudioUrl === "string"
        ? { audioUrl: data.generatedAudioUrl }
        : undefined

    default:
      return undefined
  }
}

async function executeNode(
  node: Node,
  inputs: NodeOutput,
  runtime: WorkflowExecutionRuntime,
): Promise<NodeOutput> {
  const type = node.type
  const data = node.data as Record<string, unknown>

  switch (type) {
    case "text": {
      const currentText = (data.text as string) || ""
      const promptInput =
        typeof data.promptInput === "string" ? data.promptInput.trim() : ""

      if (!promptInput) {
        return { text: currentText }
      }

      const referenceImageUrls = dedupeStrings([
        ...getOutputImageUrls(inputs),
        ...getStringArray(data.connectedImageUrls),
        ...(typeof data.connectedImageUrl === "string" && data.connectedImageUrl.length > 0
          ? [data.connectedImageUrl]
          : []),
      ])
      const images =
        referenceImageUrls.length > 0
          ? referenceImageUrls.map((url) => ({
              url,
              mediaType: "image/*",
            }))
          : undefined

      const result = await runtime.generateText({
        prompt: promptInput,
        currentText,
        images,
      })

      return { text: result.text || currentText }
    }

    case "upload":
      return {
        fileUrl: (data.fileUrl as string) || undefined,
        fileType: (data.fileType as string) || undefined,
        imageUrl: data.fileType === "image" ? (data.fileUrl as string) : undefined,
        imageUrls:
          data.fileType === "image" && typeof data.fileUrl === "string"
            ? [data.fileUrl]
            : undefined,
        videoUrl: data.fileType === "video" ? (data.fileUrl as string) : undefined,
        audioUrl: data.fileType === "audio" ? (data.fileUrl as string) : undefined,
      }

    case "image-gen": {
      const prompt = joinPromptParts([inputs.text, data.prompt])
      if (!prompt) {
        throw new Error("Image generation requires a prompt")
      }

      const modelIdentifier = (data.model as string) || DEFAULT_IMAGE_MODEL_IDENTIFIER
      const referenceImageUrls = dedupeStrings([
        ...getOutputImageUrls(inputs),
        ...getStringArray(data.connectedImageUrls),
        ...getStringArray(data.manualImageUrls),
      ])
      const aspectRatio = resolveAspectRatioForRequest({
        model: getModelByIdentifier(modelIdentifier) ?? null,
        selectedAspectRatio: (data.aspectRatio as string) || "",
        hasReferenceImages: referenceImageUrls.length > 0,
      })

      const result = await runtime.generateImage({
        prompt,
        modelIdentifier,
        aspectRatio,
        enhancePrompt: Boolean(data.enhancePrompt),
        referenceImageUrls,
      })

      return { imageUrl: result.imageUrl, imageUrls: result.imageUrls ?? [result.imageUrl] }
    }

    case "video-gen": {
      const imageUrl = inputs.imageUrl || (data.imageUrl as string) || ""
      const videoUrl = inputs.videoUrl || (data.videoUrl as string) || ""

      if (!imageUrl || !videoUrl) {
        throw new Error("Video generation requires image and video inputs")
      }

      const result = await runtime.generateVideo({
        imageUrl,
        videoUrl,
        prompt: inputs.text || (data.prompt as string) || "",
        mode: (data.mode as string) || "pro",
      })

      return { videoUrl: result.videoUrl }
    }

    case "audio": {
      const text = joinPromptParts([inputs.text, data.text])
      if (!text.trim()) {
        throw new Error("Audio generation requires text input")
      }

      const result = await runtime.generateAudio({
        text: text.trim(),
        provider: (data.provider as string) || "inworld",
        voice: (data.voice as string) || "",
        model: (data.model as string) || "",
        stylePrompt: (data.stylePrompt as string) || "",
        languageCode: (data.languageCode as string) || "",
      })

      return { audioUrl: result.audioUrl }
    }

    default:
      return {}
  }
}

export async function executeWorkflowWithRuntime(
  nodes: Node[],
  edges: Edge[],
  callbacks: ExecutionCallbacks,
  runtime: WorkflowExecutionRuntime,
  options: WorkflowExecutionOptions = {},
): Promise<void> {
  const order = getExecutionOrder(nodes, edges)
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const fallbackNodes = new Map((options.fallbackNodes ?? nodes).map((node) => [node.id, node]))
  const outputs = new Map<string, NodeOutput>()
  const inputEdges = options.inputEdges ?? edges

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId)
    if (!node) continue

    const isGenerative =
      ["image-gen", "video-gen", "audio"].includes(node.type ?? "") ||
      (node.type === "text" && hasPromptInput((node.data as Record<string, unknown>) ?? {}))

    if (isGenerative) {
      callbacks.onNodeStart(nodeId)
    }

    try {
      const inputs = collectInputs(nodeId, inputEdges, outputs, fallbackNodes)
      const output = await executeNode(node, inputs, runtime)
      outputs.set(nodeId, output)

      if (isGenerative) {
        callbacks.onNodeComplete(nodeId, output)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      callbacks.onNodeError(nodeId, message)
    }
  }
}
