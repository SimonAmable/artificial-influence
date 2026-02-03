import type { Node, Edge } from "@xyflow/react"
import type { ExecutionCallbacks, NodeOutput } from "./types"

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
    throw new Error("Workflow contains a cycle — cannot execute")
  }

  return order
}

/**
 * Collect outputs from upstream nodes connected to a given target node.
 */
function collectInputs(
  targetId: string,
  edges: Edge[],
  outputs: Map<string, NodeOutput>
): NodeOutput {
  const merged: NodeOutput = {}
  for (const edge of edges) {
    if (edge.target === targetId) {
      const sourceOutput = outputs.get(edge.source)
      if (sourceOutput) {
        // Merge all fields — later edges override earlier ones
        Object.assign(merged, sourceOutput)
      }
    }
  }
  return merged
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
      // Text nodes simply output their text content
      return { text: (data.text as string) || "" }
    }

    case "upload": {
      // Upload nodes output their file URL and type
      return {
        fileUrl: (data.fileUrl as string) || undefined,
        fileType: (data.fileType as string) || undefined,
        imageUrl: data.fileType === "image" ? (data.fileUrl as string) : undefined,
        videoUrl: data.fileType === "video" ? (data.fileUrl as string) : undefined,
        audioUrl: data.fileType === "audio" ? (data.fileUrl as string) : undefined,
      }
    }

    case "image-gen": {
      const prompt = inputs.text || (data.prompt as string) || ""
      if (!prompt.trim()) {
        throw new Error("Image generation requires a prompt")
      }

      const formData = new FormData()
      formData.append("prompt", prompt.trim())
      formData.append("model", (data.model as string) || "google/nano-banana")
      formData.append("enhancePrompt", String(data.enhancePrompt ?? false))
      const aspectRatio = (data.aspectRatio as string) || "1:1"
      formData.append("aspectRatio", aspectRatio)
      formData.append("aspect_ratio", aspectRatio)

      const response = await fetch("/api/generate-image", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || err.message || "Image generation failed")
      }

      const result = await response.json()
      let imageUrl: string | undefined

      if (result.images?.length > 0) {
        imageUrl = result.images[0].url
      } else if (result.image?.url) {
        imageUrl = result.image.url
      }

      if (!imageUrl) throw new Error("No image URL in response")
      return { imageUrl }
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
      const text = inputs.text || (data.text as string) || ""
      if (!text.trim()) {
        throw new Error("Audio generation requires text input")
      }

      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          voice: (data.voice as string) || "alloy",
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
  callbacks: ExecutionCallbacks
): Promise<void> {
  const order = getExecutionOrder(nodes, edges)
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const outputs = new Map<string, NodeOutput>()

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId)
    if (!node) continue

    // Skip non-generative nodes from callbacks (text, upload just pass data through)
    const isGenerative = ["image-gen", "video-gen", "audio"].includes(node.type ?? "")

    if (isGenerative) {
      callbacks.onNodeStart(nodeId)
    }

    try {
      const inputs = collectInputs(nodeId, edges, outputs)
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
