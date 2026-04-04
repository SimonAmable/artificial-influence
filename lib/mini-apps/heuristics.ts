import type { Edge, Node } from "@xyflow/react"
import type {
  MiniAppDraft,
  MiniAppNodeConfig,
  MiniAppNodeConfigMap,
} from "@/lib/mini-apps/types"

const POSITIVE_INPUT_TERMS = [
  "input",
  "upload",
  "photo",
  "reference",
  "prompt",
  "suggestion",
  "suggestions",
  "thumbnail",
  "image",
]

const OPTIONAL_INPUT_TERMS = ["optional", "suggestion", "suggestions", "hint", "notes", "note"]
const INTERNAL_TERMS = ["do not edit", "internal", "system", "locked", "hidden", "template"]
const OUTPUT_TERMS = ["output", "result", "final", "thumbnail", "image", "variation"]

function getNodeLabel(node: Node): string {
  const data = (node.data ?? {}) as Record<string, unknown>
  if (typeof data.label === "string" && data.label.trim().length > 0) return data.label.trim()
  return node.type ?? "Node"
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function titleMatches(label: string, terms: string[]): boolean {
  const normalized = normalizeText(label)
  return terms.some((term) => normalized.includes(term))
}

function isUploadWithPrefilledAsset(node: Node): boolean {
  if (node.type !== "upload") return false
  const data = (node.data ?? {}) as Record<string, unknown>
  return typeof data.fileUrl === "string" && data.fileUrl.trim().length > 0
}

function getAbsolutePosition(node: Node, nodeMap: Map<string, Node>): { x: number; y: number } {
  let x = node.position.x
  let y = node.position.y
  let currentParentId = node.parentId

  while (currentParentId) {
    const parentNode = nodeMap.get(currentParentId)
    if (!parentNode) break
    x += parentNode.position.x
    y += parentNode.position.y
    currentParentId = parentNode.parentId
  }

  return { x, y }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "mini-app"
}

interface NodeHeuristic {
  node: Node
  config: MiniAppNodeConfig
  inputScore: number
  outputScore: number
  outputPriority: number
}

export function deriveMiniAppDraft({
  workflowName,
  workflowDescription,
  thumbnailUrl,
  nodes,
  edges,
}: {
  workflowName: string
  workflowDescription?: string | null
  thumbnailUrl?: string | null
  nodes: Node[]
  edges: Edge[]
}): MiniAppDraft {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const candidateNodes = nodes.filter((node) => node.type !== "group")
  const outgoingCounts = new Map<string, number>()

  for (const edge of edges) {
    outgoingCounts.set(edge.source, (outgoingCounts.get(edge.source) ?? 0) + 1)
  }

  const absolutePositions = new Map(
    candidateNodes.map((node) => [node.id, getAbsolutePosition(node, nodeMap)])
  )
  const maxX = Math.max(...candidateNodes.map((node) => absolutePositions.get(node.id)?.x ?? 0), 0)

  const heuristics: NodeHeuristic[] = candidateNodes.map((node) => {
    const label = getNodeLabel(node)
    const isInternalTitle = titleMatches(label, INTERNAL_TERMS)
    const isOptionalInput = titleMatches(label, OPTIONAL_INPUT_TERMS)
    const isPositiveInput = titleMatches(label, POSITIVE_INPUT_TERMS)
    const isOutputTitle = titleMatches(label, OUTPUT_TERMS)
    const hasOutgoingEdges = (outgoingCounts.get(node.id) ?? 0) > 0
    const isSinkNode = !hasOutgoingEdges
    const position = absolutePositions.get(node.id) ?? { x: 0, y: 0 }
    const isRightMost = maxX > 0 && position.x >= maxX - 120
    const hasPrefilledAsset = isUploadWithPrefilledAsset(node)

    let inputScore = 0
    let outputScore = 0

    if (node.type === "upload") inputScore += 2
    if (node.type === "text") inputScore += 2
    if (node.type === "image-gen" || node.type === "video-gen") outputScore += 2

    if (node.type === "upload" && !hasPrefilledAsset) inputScore += 6
    if (node.type === "upload" && hasPrefilledAsset) inputScore -= 6
    if (node.type === "upload" && hasPrefilledAsset) outputScore -= 4

    if (isPositiveInput) inputScore += 3
    if (isOutputTitle) outputScore += 3
    if (isInternalTitle) {
      inputScore -= 6
      outputScore -= 6
    }

    if ((node.type === "text" || node.type === "upload") && hasOutgoingEdges) inputScore += 2
    if ((node.type === "image-gen" || node.type === "video-gen") && isSinkNode) outputScore += 6
    if ((node.type === "image-gen" || node.type === "video-gen") && isRightMost) outputScore += 2

    const role = outputScore > inputScore ? "output" : "input"
    const showInMiniApp = !isInternalTitle && !(node.type === "upload" && hasPrefilledAsset)
    const userCanEdit = role === "input" && showInMiniApp && !(node.type === "upload" && hasPrefilledAsset)
    const required = role === "input" && userCanEdit && !isOptionalInput
    const outputPriority = outputScore + (isRightMost ? 2 : 0) - position.y / 10000

    return {
      node,
      inputScore,
      outputScore,
      outputPriority,
      config: {
        node_id: node.id,
        show_in_mini_app: showInMiniApp,
        user_can_edit: userCanEdit,
        required,
        role,
      },
    }
  })

  const outputCandidates = heuristics
    .filter((item) => item.config.show_in_mini_app && item.config.role === "output")
    .sort((a, b) => b.outputPriority - a.outputPriority)

  const featuredOutput = outputCandidates[0]?.node.id ?? null
  const nodeConfig = heuristics.reduce<MiniAppNodeConfigMap>((acc, item) => {
    acc[item.node.id] = item.config
    return acc
  }, {})

  return {
    name: workflowName.trim() || "Mini App",
    slug: slugify(workflowName),
    description: workflowDescription?.trim() || "",
    thumbnail_url: thumbnailUrl ?? null,
    featured_output_node_id: featuredOutput,
    node_config: nodeConfig,
  }
}

export function buildMiniAppSlug(name: string): string {
  return slugify(name)
}

export function getMiniAppVisibleNodes(
  nodes: Node[],
  nodeConfig: MiniAppNodeConfigMap,
  role: "input" | "output"
): Node[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  return nodes
    .filter((node) => {
      const config = nodeConfig[node.id]
      return node.type !== "group" && !!config && config.show_in_mini_app && config.role === role
    })
    .sort((a, b) => {
      const aPos = getAbsolutePosition(a, nodeMap)
      const bPos = getAbsolutePosition(b, nodeMap)
      if (Math.abs(aPos.y - bPos.y) > 16) return aPos.y - bPos.y
      return aPos.x - bPos.x
    })
}
