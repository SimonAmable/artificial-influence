import type { Node, Edge } from "@xyflow/react"
import {
  DEFAULT_IMAGE_MODEL_IDENTIFIER,
  getModelByIdentifier,
} from "@/lib/constants/models"
import {
  DEFAULT_INWORLD_TTS_MODEL,
  DEFAULT_INWORLD_VOICE_ID,
} from "@/lib/constants/inworld-tts"
import { resolveAspectRatioForRequest } from "@/lib/utils/aspect-ratios"
import type { ExecutionCallbacks, NodeOutput } from "./types"

interface ExecuteWorkflowOptions {
  inputEdges?: Edge[]
  fallbackNodes?: Node[]
}

/**
 * Topological sort using Kahn's algorithm.
 * Returns node IDs in execution order (sources first, sinks last).
 */
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

  // Start with nodes that have no incoming edges
  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const order: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    order.push(id)
    for (const neighbor of adjacency.get(id) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDeg)
      if (newDeg === 0) queue.push(neighbor)
    }
  }

  // If order doesn't contain all nodes, there's a cycle
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

async function appendReferenceImagesToFormData(
  formData: FormData,
  referenceImageUrls: string[]
): Promise<void> {
  for (let index = 0; index < referenceImageUrls.length; index += 1) {
    const referenceImageUrl = referenceImageUrls[index]

    try {
      const response = await fetch(referenceImageUrl)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const imageBlob = await response.blob()
      const imageType = imageBlob.type || "image/png"
      const imageExtension = imageType.split("/")[1] || "png"
      const imageFile = new File([imageBlob], `reference-${index}.${imageExtension}`, {
        type: imageType,
      })

      formData.append("referenceImages", imageFile)
    } catch (error) {
      console.error(`Error fetching workflow reference image ${index}:`, error)
    }
  }
}

/**
 * Collect outputs from upstream nodes connected to a given target node.
 */
function collectInputs(
  targetId: string,
  edges: Edge[],
  outputs: Map<string, NodeOutput>,
  fallbackNodes: Map<string, Node>
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

    // Merge scalar fields so type-specific values still flow through.
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
            (url): url is string => typeof url === "string" && url.length > 0
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

/**
 * Execute a single node based on its type and data.
 */
async function executeNode(
  node: Node,
  inputs: NodeOutput
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

      const response = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptInput,
          currentText,
          images,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || err.message || "Text generation failed")
      }

      const result = await response.json()
      const text =
        typeof result.text === "string" && result.text.length > 0
          ? result.text
          : currentText
      return { text }
    }

    case "upload": {
      // Upload nodes output their file URL and type
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

      const formData = new FormData()
      formData.append("prompt", prompt)
      formData.append("model", modelIdentifier)
      formData.append("enhancePrompt", String(data.enhancePrompt ?? false))
      formData.append("aspectRatio", aspectRatio)
      formData.append("aspect_ratio", aspectRatio)
      await appendReferenceImagesToFormData(formData, referenceImageUrls)

      const { generateImageAndWait } = await import("@/lib/generate-image-client")
      const result = await generateImageAndWait(formData)
      const imageUrl = result.image?.url ?? result.images?.[0]?.url
      if (!imageUrl) throw new Error("No image URL in response")
      return { imageUrl, imageUrls: [imageUrl] }
    }

    case "video-gen": {
      const imageUrl = inputs.imageUrl || (data.imageUrl as string) || ""
      const videoUrl = inputs.videoUrl || (data.videoUrl as string) || ""

      if (!imageUrl || !videoUrl) {
        throw new Error("Video generation requires image and video inputs")
      }

      const response = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          videoUrl,
          imageStoragePath: "",
          videoStoragePath: "",
          prompt: inputs.text || (data.prompt as string) || "",
          mode: (data.mode as string) || "pro",
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || err.message || "Video generation failed")
      }

      const result = await response.json()
      if (!result.video?.url) throw new Error("No video URL in response")
      return { videoUrl: result.video.url }
    }

    case "audio": {
      const text = joinPromptParts([inputs.text, data.text])
      if (!text.trim()) {
        throw new Error("Audio generation requires text input")
      }

      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          voice: (data.voice as string) || DEFAULT_INWORLD_VOICE_ID,
          model: (data.model as string) || DEFAULT_INWORLD_TTS_MODEL,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || err.message || "Audio generation failed")
      }

      const result = await response.json()
      const audioUrl = result.audio?.url || result.url
      if (!audioUrl) throw new Error("No audio URL in response")
      return { audioUrl }
    }

    default:
      return {}
  }
}

/**
 * Execute the entire workflow in dependency order.
 */
export async function executeWorkflow(
  nodes: Node[],
  edges: Edge[],
  callbacks: ExecutionCallbacks,
  options: ExecuteWorkflowOptions = {}
): Promise<void> {
  const order = getExecutionOrder(nodes, edges)
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const fallbackNodes = new Map((options.fallbackNodes ?? nodes).map((n) => [n.id, n]))
  const outputs = new Map<string, NodeOutput>()
  const inputEdges = options.inputEdges ?? edges

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId)
    if (!node) continue

    // Skip non-generative nodes from callbacks (text, upload just pass data through)
    const isGenerative =
      ["image-gen", "video-gen", "audio"].includes(node.type ?? "") ||
      (node.type === "text" && hasPromptInput((node.data as Record<string, unknown>) ?? {}))

    if (isGenerative) {
      callbacks.onNodeStart(nodeId)
    }

    try {
      const inputs = collectInputs(nodeId, inputEdges, outputs, fallbackNodes)
      const output = await executeNode(node, inputs)
      outputs.set(nodeId, output)

      if (isGenerative) {
        callbacks.onNodeComplete(nodeId, output)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      callbacks.onNodeError(nodeId, message)
      // Continue executing other nodes even if one fails
    }
  }
}
