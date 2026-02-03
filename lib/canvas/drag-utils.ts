/**
 * Utility for making canvas nodes draggable to external targets (like AI chat)
 */

import type { Node } from "@xyflow/react"

/**
 * Creates a drag start handler that exports node data for external drop targets
 * @param id - The node ID
 * @param type - The node type
 * @param data - The node data
 */
export function createNodeDragHandler(id: string, type: string, data: any) {
  return (e: React.DragEvent<HTMLDivElement>) => {
    // Only set drag data if not dragging within canvas (React Flow handles that)
    // This allows dragging to external targets like the AI chat
    const nodeData = {
      id,
      type,
      data
    }
    
    e.dataTransfer.setData('application/reactflow-node', JSON.stringify(nodeData))
    e.dataTransfer.effectAllowed = 'copy'
  }
}

/**
 * Extract asset URL from a canvas node based on its type
 * @param nodeData - The parsed node data from drag event
 * @returns Asset URL and type, or null if no asset found
 */
export function extractAssetFromNode(nodeData: any): { url: string; type: 'image' | 'video' | 'audio' } | null {
  if (!nodeData || !nodeData.type || !nodeData.data) return null

  let assetUrl: string | null = null
  let assetType: 'image' | 'video' | 'audio' | null = null

  switch (nodeData.type) {
    case 'upload':
      if (nodeData.data.fileUrl) {
        assetUrl = nodeData.data.fileUrl
        assetType = nodeData.data.fileType || 'image'
      }
      break
    
    case 'image-gen':
      if (nodeData.data.generatedImageUrl) {
        assetUrl = nodeData.data.generatedImageUrl
        assetType = 'image'
      }
      break
    
    case 'video-gen':
      if (nodeData.data.generatedVideoUrl) {
        assetUrl = nodeData.data.generatedVideoUrl
        assetType = 'video'
      }
      break
    
    case 'audio':
      if (nodeData.data.generatedAudioUrl) {
        assetUrl = nodeData.data.generatedAudioUrl
        assetType = 'audio'
      }
      break
  }

  if (assetUrl && assetType) {
    return { url: assetUrl, type: assetType }
  }

  return null
}
