import type { Node, Edge } from "@xyflow/react"

type ReactFlowInstanceLike = {
  getNode: (id: string) => Node | null | undefined
}

/**
 * Extract group node and all its children from the canvas
 */
export function extractGroupAsWorkflow(
  groupId: string,
  allNodes: Node[],
  allEdges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  // Find the group node
  const groupNode = allNodes.find((n) => n.id === groupId && n.type === "group")
  if (!groupNode) {
    throw new Error("Group node not found")
  }

  // Find all children of this group
  const childNodes = allNodes.filter((n) => n.parentId === groupId)
  
  if (childNodes.length === 0) {
    throw new Error("Group has no children")
  }

  // Collect all node IDs in this workflow
  const nodeIds = new Set([groupId, ...childNodes.map((n) => n.id)])

  // Find all edges that connect nodes within this group (internal edges)
  const internalEdges = allEdges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
  )

  // Return group node + children + internal edges
  return {
    nodes: [groupNode, ...childNodes],
    edges: internalEdges,
  }
}

/**
 * Instantiate a saved workflow on the canvas at a specific position
 * Generates new IDs for all nodes and edges to avoid conflicts
 */
export function instantiateWorkflow(
  savedNodes: Node[],
  savedEdges: Edge[],
  position: { x: number; y: number }
): { nodes: Node[]; edges: Edge[] } {
  // Find the group node to calculate offset
  const groupNode = savedNodes.find((n) => n.type === "group")
  if (!groupNode) {
    throw new Error("Workflow must contain a group node")
  }

  // Create ID mapping for all nodes
  const idMap = new Map<string, string>()
  savedNodes.forEach((node) => {
    idMap.set(node.id, `${node.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  })

  // Calculate position offset
  const offsetX = position.x - groupNode.position.x
  const offsetY = position.y - groupNode.position.y

  // Clone nodes with new IDs and adjusted positions
  const newNodes = savedNodes.map((node) => {
    const newId = idMap.get(node.id)!
    const newNode: Node = {
      ...node,
      id: newId,
      selected: false,
      // Only adjust position for the group node (children are relative)
      position: node.parentId
        ? node.position
        : {
            x: node.position.x + offsetX,
            y: node.position.y + offsetY,
          },
      // Update parentId reference if this is a child node
      parentId: node.parentId ? idMap.get(node.parentId) : undefined,
    }
    return newNode
  })

  // Clone edges with new node ID references
  const newEdges = savedEdges.map((edge) => {
    const newEdge: Edge = {
      ...edge,
      id: `${idMap.get(edge.source)}-${edge.sourceHandle || "default"}-${idMap.get(edge.target)}-${edge.targetHandle || "default"}`,
      source: idMap.get(edge.source)!,
      target: idMap.get(edge.target)!,
      selected: false,
    }
    return newEdge
  })

  return { nodes: newNodes, edges: newEdges }
}

/**
 * Generate a data URL screenshot of a group of nodes
 * This captures the visual representation for thumbnails
 */
export async function captureWorkflowScreenshot(
  groupId: string,
  reactFlowInstance: ReactFlowInstanceLike
): Promise<string> {
  try {
    // Get the group node to find its bounds
    const groupNode = reactFlowInstance.getNode(groupId)
    if (!groupNode) {
      throw new Error("Group node not found")
    }

    // Use html2canvas to capture the specific group area
    // Note: This requires html2canvas to be installed
    const { default: html2canvas } = await import("html2canvas")
    
    // Find the group DOM element
    const groupElement = document.querySelector(`[data-id="${groupId}"]`) as HTMLElement
    if (!groupElement) {
      throw new Error("Group element not found in DOM")
    }

    // Capture the element
    const canvas = await html2canvas(groupElement, {
      backgroundColor: "#1a1a1a",
      scale: 0.5, // Reduce size for thumbnail
      logging: false,
    })

    // Convert to data URL
    return canvas.toDataURL("image/png")
  } catch (error) {
    console.error("Error capturing workflow screenshot:", error)
    throw error
  }
}

/**
 * Convert data URL to File object for upload
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(",")
  const mime = arr[0].match(/:(.*?);/)![1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  
  return new File([u8arr], filename, { type: mime })
}
