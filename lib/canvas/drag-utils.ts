/**
 * Utility for making canvas nodes draggable to external targets (like AI chat)
 */
/**
 * Creates a drag start handler that exports node data for external drop targets
 * @param id - The node ID
 * @param type - The node type
 * @param data - The node data
 */
export function createNodeDragHandler(id: string, type: string, data: unknown) {
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
export function extractAssetFromNode(nodeData: unknown): { url: string; type: 'image' | 'video' | 'audio' } | null {
  if (!nodeData || typeof nodeData !== 'object') return null

  const parsed = nodeData as { type?: string; data?: Record<string, unknown> }
  if (!parsed.type || !parsed.data) return null

  let assetUrl: string | null = null
  let assetType: 'image' | 'video' | 'audio' | null = null

  switch (parsed.type) {
    case 'upload':
      if (typeof parsed.data.fileUrl === 'string') {
        assetUrl = parsed.data.fileUrl
        assetType = typeof parsed.data.fileType === 'string' ? (parsed.data.fileType as 'image' | 'video' | 'audio') : 'image'
      }
      break
    
    case 'image-gen':
      if (typeof parsed.data.generatedImageUrl === 'string') {
        assetUrl = parsed.data.generatedImageUrl
        assetType = 'image'
      }
      break
    
    case 'video-gen':
      if (typeof parsed.data.generatedVideoUrl === 'string') {
        assetUrl = parsed.data.generatedVideoUrl
        assetType = 'video'
      }
      break
    
    case 'audio':
      if (typeof parsed.data.generatedAudioUrl === 'string') {
        assetUrl = parsed.data.generatedAudioUrl
        assetType = 'audio'
      }
      break
  }

  if (assetUrl && assetType) {
    return { url: assetUrl, type: assetType }
  }

  return null
}
