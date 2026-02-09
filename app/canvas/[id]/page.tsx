"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  useOnSelectionChange,
  useUpdateNodeInternals,
  type Connection,
  type Node,
  type Edge,
  ReactFlowProvider,
  BackgroundVariant,
  Panel,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { CanvasHeader } from "@/components/canvas/canvas-header"
import { CanvasSidebar } from "@/components/canvas/canvas-sidebar"
import { CanvasToolbar } from "@/components/canvas/canvas-toolbar"
import { CanvasSelectionActionBar } from "@/components/canvas/canvas-selection-action-bar"
import { CanvasContextMenu } from "@/components/canvas/canvas-context-menu"
import { SaveWorkflowDialog } from "@/components/canvas/save-workflow-dialog"
import { EditWorkflowDialog } from "@/components/canvas/edit-workflow-dialog"
import { TextNodeComponent } from "@/components/canvas/nodes/text-node"
import { UploadNodeComponent } from "@/components/canvas/nodes/upload-node"
import { ImageGenNodeComponent } from "@/components/canvas/nodes/image-gen-node"
import { VideoGenNodeComponent } from "@/components/canvas/nodes/video-gen-node"
import { AudioNodeComponent } from "@/components/canvas/nodes/audio-node"
import { GroupNodeComponent } from "@/components/canvas/nodes/group-node"
import { NodeToNodeEdge } from "@/components/canvas/edges/node-to-node-edge"
import {
  createTextNodeData,
  createUploadNodeData,
  createImageGenNodeData,
  createVideoGenNodeData,
  createAudioNodeData,
  type CanvasNodeType,
  type CanvasNodeData,
  type GroupNodeData,
} from "@/lib/canvas/types"
import { fetchCanvas, saveCanvasClient } from "@/lib/canvas/database"
import { generateAndUploadThumbnail } from "@/lib/canvas/thumbnails"
import { executeWorkflow } from "@/lib/canvas/execution"
import { instantiateWorkflow } from "@/lib/workflows/utils"
import type { Workflow } from "@/lib/workflows/database-server"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"

// Register custom node types - MUST be outside component for stable reference
const nodeTypes = {
  "text": TextNodeComponent,
  "upload": UploadNodeComponent,
  "image-gen": ImageGenNodeComponent,
  "video-gen": VideoGenNodeComponent,
  "audio": AudioNodeComponent,
  "group": GroupNodeComponent,
}

// Register custom edge types - MUST be outside component for stable reference
const edgeTypes = {
  "node-to-node": NodeToNodeEdge,
}

function CanvasContent() {
  const params = useParams()
  const router = useRouter()
  const canvasId = params.id as string
  
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const { screenToFlowPosition } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const [workflowName, setWorkflowName] = React.useState("Canvas")
  const [isExecuting, setIsExecuting] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedNodes, setSelectedNodes] = React.useState<Node[]>([])
  const [userId, setUserId] = React.useState<string>("")
  const [saveWorkflowDialogOpen, setSaveWorkflowDialogOpen] = React.useState(false)
  const [editWorkflowDialogOpen, setEditWorkflowDialogOpen] = React.useState(false)
  const [editingWorkflow, setEditingWorkflow] = React.useState<Workflow | null>(null)
  const [contextMenuPosition, setContextMenuPosition] = React.useState<{ x: number; y: number } | null>(null)
  const [clickedNode, setClickedNode] = React.useState<Node | null>(null)
  const [hasClipboard, setHasClipboard] = React.useState(false)
  
  const canvasRef = React.useRef<HTMLDivElement>(null)
  const reactFlowInstance = useReactFlow()
  const [isDraggingFile, setIsDraggingFile] = React.useState(false)
  const dragCounter = React.useRef(0)
  const pendingUploadsRef = React.useRef(0)
  const uploadWaitersRef = React.useRef<Array<() => void>>([])
  const uploadErrorsRef = React.useRef(0)

  const incrementPendingUploads = React.useCallback(() => {
    pendingUploadsRef.current += 1
  }, [])

  const decrementPendingUploads = React.useCallback(() => {
    pendingUploadsRef.current = Math.max(0, pendingUploadsRef.current - 1)
    if (pendingUploadsRef.current === 0) {
      const waiters = uploadWaitersRef.current
      uploadWaitersRef.current = []
      waiters.forEach(resolve => resolve())
    }
  }, [])

  const waitForUploads = React.useCallback(() => {
    if (pendingUploadsRef.current === 0) return Promise.resolve()
    return new Promise<void>((resolve) => {
      uploadWaitersRef.current.push(resolve)
    })
  }, [])

  // Track selection changes
  useOnSelectionChange({
    onChange: React.useCallback(({ nodes }) => {
      setSelectedNodes(nodes)
    }, []),
  })

  // Check if a single group node is selected
  const selectedGroupNode = React.useMemo(() => {
    if (selectedNodes.length === 1 && selectedNodes[0].type === 'group') {
      return selectedNodes[0]
    }
    return null
  }, [selectedNodes])

  // Node counter for unique IDs
  const nodeCounter = React.useRef(0)

  // Check if clipboard has data on mount
  React.useEffect(() => {
    const clipboard = localStorage.getItem('rf-clipboard')
    setHasClipboard(!!clipboard)
  }, [])

  // Memoized callback for nodes to update their own data using React Flow's updateNodeData
  // This is more efficient than mapping through all nodes
  // Use useCallback with empty deps to ensure stable reference that never changes
  const handleNodeDataChange = React.useCallback(
    (nodeId: string, updates: Record<string, unknown>) => {
      reactFlowInstance.updateNodeData(nodeId, updates)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // Load canvas on mount
  React.useEffect(() => {
    async function loadCanvas() {
      try {
        setIsLoading(true)
        const canvas = await fetchCanvas(canvasId)
        
        // Set canvas data
        setWorkflowName(canvas.name)
        
        // Inject onDataChange callback to all nodes
        // Properly restore nodes for React Flow
        const nodesWithCallbacks = canvas.nodes.map(node => {
          // Create a clean node object with all necessary React Flow properties
          const restoredNode: Node = {
            id: node.id,
            type: node.type || 'text',
            position: node.position,
            data: {
              ...node.data,
              onDataChange: handleNodeDataChange,
            },
          }
          
          // Preserve optional properties if they exist
          if (node.width !== undefined) restoredNode.width = node.width
          if (node.height !== undefined) restoredNode.height = node.height
          if (node.selected !== undefined) restoredNode.selected = node.selected
          if (node.dragging !== undefined) restoredNode.dragging = node.dragging
          if (node.parentId !== undefined) restoredNode.parentId = node.parentId
          if (node.zIndex !== undefined) restoredNode.zIndex = node.zIndex
          if (node.extent !== undefined) restoredNode.extent = node.extent
          if (node.style !== undefined) restoredNode.style = node.style
          if (node.className !== undefined) restoredNode.className = node.className
          
          return restoredNode
        })
        
        // Properly restore edges for React Flow with all connection details
        const edgesWithType = canvas.edges.map(edge => {
          // Build edge object without handle properties if they're null
          const restoredEdge: Edge = {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: edge.type || 'node-to-node',
          }
          
          // Only include handle properties if they have actual values (not null or "null" string)
          // Only add handle properties if they're valid strings (not null, undefined, or "null")
          const isValidHandle = (handle: unknown): handle is string => {
            return (
              handle != null && // not null or undefined
              handle !== 'null' && // not the string "null"
              typeof handle === 'string' &&
              handle.trim().length > 0 // not empty string
            )
          }
          
          // Use saved handle IDs if valid, otherwise use defaults for backward compatibility
          if (isValidHandle(edge.sourceHandle)) {
            restoredEdge.sourceHandle = edge.sourceHandle
          } else {
            restoredEdge.sourceHandle = 'output' // Default source handle ID
          }
          
          if (isValidHandle(edge.targetHandle)) {
            restoredEdge.targetHandle = edge.targetHandle
          } else {
            restoredEdge.targetHandle = 'input' // Default target handle ID
          }
          
          // Preserve other edge properties
          if (edge.animated !== undefined) restoredEdge.animated = edge.animated
          if (edge.style) restoredEdge.style = edge.style
          if (edge.className) restoredEdge.className = edge.className
          if (edge.label) restoredEdge.label = edge.label
          
          return restoredEdge
        })
        
        // Set nodes and edges together
        // React Flow will handle measuring nodes and rendering edges
        setNodes(nodesWithCallbacks)
        setEdges(edgesWithType)
        
        // Update node internals after setting nodes to ensure handle positions are calculated
        // This is critical for edges to connect properly after async loading
        setTimeout(() => {
          nodesWithCallbacks.forEach(node => {
            updateNodeInternals(node.id)
          })
        }, 0)
        
        // Extract userId from canvas
        setUserId(canvas.user_id)
        
        // Update node counter to avoid ID conflicts
        const maxId = canvas.nodes.reduce((max, node) => {
          const match = node.id.match(/-(\d+)$/)
          if (match) {
            return Math.max(max, parseInt(match[1]))
          }
          return max
        }, 0)
        nodeCounter.current = maxId
        
      } catch (error) {
        console.error("Error loading canvas:", error)
        toast.error("Failed to load canvas")
        router.push("/canvases")
      } finally {
        setIsLoading(false)
      }
    }

    loadCanvas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, router])

  // Add beforeunload event listener to warn users before closing
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Modern browsers require returnValue to be set
      e.preventDefault()
      // Chrome requires returnValue to be set
      e.returnValue = ''
      // Some browsers display this message, others show a generic message
      return ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // Drag and drop file handlers using React Flow API
  const onDragOver = React.useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    
    // Check if dragging files from outside
    if (event.dataTransfer.types.includes('Files')) {
      if (!isDraggingFile) {
        setIsDraggingFile(true)
      }
    }
  }, [isDraggingFile])

  const onDragEnter = React.useCallback((event: React.DragEvent) => {
    event.preventDefault()
    
    if (event.dataTransfer.types.includes('Files')) {
      dragCounter.current += 1
      setIsDraggingFile(true)
    }
  }, [])

  const onDragLeave = React.useCallback((event: React.DragEvent) => {
    event.preventDefault()
    
    dragCounter.current -= 1
    if (dragCounter.current === 0) {
      setIsDraggingFile(false)
    }
  }, [])

  const onDrop = React.useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      dragCounter.current = 0
      setIsDraggingFile(false)

      const files = Array.from(event.dataTransfer?.files || [])

      if (files.length === 0) return

      // Filter for images, videos, and audio
      const validFiles = files.filter(
        (file) =>
          file.type.startsWith('image/') ||
          file.type.startsWith('video/') ||
          file.type.startsWith('audio/')
      )

      if (validFiles.length === 0) {
        toast.error('Please drop image, video, or audio files')
        return
      }

      // Convert screen position to flow position
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      // Create upload nodes for each file
      const newNodes: Node[] = []
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i]
        nodeCounter.current += 1
        const id = `upload-${nodeCounter.current}`

        // Create object URL for the file
        const fileUrl = URL.createObjectURL(file)
        
        // Determine file type
        let fileType: "image" | "video" | "audio" | null = null
        if (file.type.startsWith('image/')) fileType = 'image'
        else if (file.type.startsWith('video/')) fileType = 'video'
        else if (file.type.startsWith('audio/')) fileType = 'audio'

        const newNode: Node = {
          id,
          type: 'upload',
          position: {
            x: position.x + i * 50, // Offset each node slightly
            y: position.y + i * 50,
          },
          data: {
            ...createUploadNodeData(),
            fileUrl,
            fileType,
            fileName: file.name,
            onDataChange: handleNodeDataChange,
          },
        }

        newNodes.push(newNode)

        incrementPendingUploads()
        uploadFileToSupabase(file, 'uploads')
          .then((uploadResult) => {
            if (!uploadResult) {
              uploadErrorsRef.current += 1
              return
            }

            setNodes((nds) =>
              nds.map((n) =>
                n.id === id
                  ? {
                      ...n,
                      data: {
                        ...n.data,
                        fileUrl: uploadResult.url,
                        fileType: uploadResult.fileType,
                        fileName: uploadResult.fileName,
                      },
                    }
                  : n
              )
            )
            URL.revokeObjectURL(fileUrl)
          })
          .catch(() => {
            uploadErrorsRef.current += 1
          })
          .finally(() => {
            decrementPendingUploads()
          })
      }

      setNodes((nds) => [...nds, ...newNodes])
      toast.success(
        `Added ${validFiles.length} file${validFiles.length > 1 ? 's' : ''} to canvas`
      )
    },
    [screenToFlowPosition, handleNodeDataChange, setNodes]
  )

  // Add a new node
  const handleAddNode = React.useCallback(
    (type: CanvasNodeType, initialData?: Partial<CanvasNodeData>, screenPosition?: { x: number; y: number }) => {
      nodeCounter.current += 1
      const id = `${type}-${nodeCounter.current}`

      let flowPosition: { x: number; y: number }

      if (screenPosition) {
        flowPosition = screenToFlowPosition(screenPosition)
      } else {
        const selectedNode = nodes.find((node) => node.selected)

        if (selectedNode) {
          const nodeWidth = selectedNode.width || 300
          const gap = 30

          flowPosition = {
            x: selectedNode.position.x + nodeWidth + gap,
            y: selectedNode.position.y,
          }
        } else {
        const centerX = window.innerWidth / 2
        const centerY = window.innerHeight / 2
        flowPosition = screenToFlowPosition({
          x: centerX,
          y: centerY,
        })
        }
      }

      let data: CanvasNodeData

      switch (type) {
        case "text":
          data = createTextNodeData()
          break
        case "upload":
          data = createUploadNodeData()
          break
        case "image-gen":
          data = createImageGenNodeData()
          break
        case "video-gen":
          data = createVideoGenNodeData()
          break
        case "audio":
          data = createAudioNodeData()
          break
        default:
          return
      }

      // Merge initial data if provided
      if (initialData) {
        data = { ...data, ...initialData }
      }

      data.onDataChange = handleNodeDataChange

      let nodeWidth = 280
      let nodeHeight = 280
      
      if (type === "image-gen") {
        nodeWidth = 280
        nodeHeight = 280
      }

      const newNode: Node<CanvasNodeData> = {
        id,
        type,
        position: flowPosition,
        data,
        selected: true,
        width: nodeWidth,
        height: nodeHeight,
      }

      setNodes((nds) => [
        ...nds.map((node) => ({ ...node, selected: false })),
        newNode,
      ])
    },
    [screenToFlowPosition, handleNodeDataChange, setNodes, nodes]
  )

  // Handle edge connection
  const onConnect = React.useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, type: 'node-to-node' }, eds))
    },
    [setEdges]
  )

  // Ungroup a group node
  const handleUngroup = React.useCallback((groupId: string) => {
    setNodes((nds) => {
      const groupNode = nds.find(n => n.id === groupId)
      
      if (!groupNode) return nds

      const updatedNodes = nds.map((node) => {
        if (node.parentId === groupId) {
          return {
            ...node,
            position: {
              x: node.position.x + groupNode.position.x,
              y: node.position.y + groupNode.position.y,
            },
            parentId: undefined,
            extent: undefined,
          }
        }
        return node
      }).filter(n => n.id !== groupId)

      return updatedNodes
    })

    toast.success("Group ungrouped")
  }, [setNodes])

  // Group selected nodes
  const handleGroup = React.useCallback(() => {
    if (selectedNodes.length < 2) {
      toast.error("Select at least 2 nodes to group")
      return
    }

    const nodesToGroup = selectedNodes
    
    nodeCounter.current += 1
    const groupId = `group-${nodeCounter.current}`

    const minX = Math.min(...nodesToGroup.map(n => n.position.x))
    const minY = Math.min(...nodesToGroup.map(n => n.position.y))
    const maxX = Math.max(...nodesToGroup.map(n => n.position.x + (n.width || 280)))
    const maxY = Math.max(...nodesToGroup.map(n => n.position.y + (n.height || 280)))
    
    const padding = 50
    const groupWidth = maxX - minX + padding
    const groupHeight = maxY - minY + padding

    const groupData: GroupNodeData = {
      label: "Group",
      backgroundColor: "#f0f0f0",
      onDataChange: handleNodeDataChange,
    }

    const groupNode: Node = {
      id: groupId,
      type: "group",
      position: { x: minX - padding/2, y: minY - padding/2 },
      data: groupData,
      style: {
        width: groupWidth,
        height: groupHeight,
      },
      zIndex: 0, // Group node stays in background
    }

    setNodes((nds) => {
      const updatedNodes = nds.map((node) => {
        if (nodesToGroup.some(n => n.id === node.id)) {
          return {
            ...node,
            position: {
              x: node.position.x - groupNode.position.x,
              y: node.position.y - groupNode.position.y,
            },
            parentId: groupId,
            extent: 'parent' as const,
            selected: false,
            zIndex: 1, // Child nodes appear above group
          }
        }
        return node
      })

      // Parent node MUST come before children in the array
      return [groupNode, ...updatedNodes]
    })

    toast.success(`Grouped ${nodesToGroup.length} nodes`)
  }, [selectedNodes, handleNodeDataChange, setNodes])

  // Copy selected nodes and edges to clipboard
  const handleCopy = React.useCallback(() => {
    if (selectedNodes.length === 0) return

    const selectedNodeIds = new Set(selectedNodes.map(n => n.id))
    const nodesToCopy = nodes.filter(n => selectedNodeIds.has(n.id))
    const edgesToCopy = edges.filter(e => 
      selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
    )

    const clipboard = {
      nodes: nodesToCopy,
      edges: edgesToCopy,
    }

    localStorage.setItem('rf-clipboard', JSON.stringify(clipboard))
    setHasClipboard(true)
    toast.success(`Copied ${nodesToCopy.length} node${nodesToCopy.length > 1 ? 's' : ''}`)
  }, [selectedNodes, nodes, edges])

  // Paste nodes from clipboard at cursor position
  const handlePaste = React.useCallback((position: { x: number; y: number }) => {
    const clipboardData = localStorage.getItem('rf-clipboard')
    if (!clipboardData) return

    try {
      const clipboard = JSON.parse(clipboardData)
      const flowPosition = screenToFlowPosition(position)
      
      // Check if clipboard contains a group workflow or individual nodes
      const hasGroupNode = clipboard.nodes.some((n: Node) => n.type === 'group')
      
      let newNodes: Node[]
      let newEdges: Edge[]
      
      if (hasGroupNode) {
        // Use instantiateWorkflow for grouped nodes
        const result = instantiateWorkflow(
          clipboard.nodes,
          clipboard.edges,
          flowPosition
        )
        newNodes = result.nodes
        newEdges = result.edges
      } else {
        // Handle individual nodes without group
        // Create ID mapping for all nodes
        const idMap = new Map<string, string>()
        clipboard.nodes.forEach((node: Node) => {
          idMap.set(node.id, `${node.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
        })
        
        // Calculate bounds of selected nodes
        const minX = Math.min(...clipboard.nodes.map((n: Node) => n.position.x))
        const minY = Math.min(...clipboard.nodes.map((n: Node) => n.position.y))
        
        // Offset to paste at cursor position
        const offsetX = flowPosition.x - minX
        const offsetY = flowPosition.y - minY
        
        // Clone nodes with new IDs and adjusted positions
        newNodes = clipboard.nodes.map((node: Node) => ({
          ...node,
          id: idMap.get(node.id)!,
          position: {
            x: node.position.x + offsetX,
            y: node.position.y + offsetY,
          },
          selected: false,
        }))
        
        // Clone edges with new node ID references
        newEdges = clipboard.edges.map((edge: Edge) => ({
          ...edge,
          id: `${idMap.get(edge.source)}-${edge.sourceHandle || "default"}-${idMap.get(edge.target)}-${edge.targetHandle || "default"}`,
          source: idMap.get(edge.source)!,
          target: idMap.get(edge.target)!,
          selected: false,
        }))
      }

      // Inject onDataChange callback to all new nodes (preserve existing data)
      const nodesWithCallbacks = newNodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          onDataChange: handleNodeDataChange,
        },
      }))

      setNodes((nds) => [
        ...nds.map(n => ({ ...n, selected: false })),
        ...nodesWithCallbacks.map(n => ({ ...n, selected: true }))
      ])
      setEdges((eds) => [...eds, ...newEdges])
      
      toast.success(`Pasted ${newNodes.length} node${newNodes.length > 1 ? 's' : ''}`)
    } catch (error) {
      console.error('Failed to paste:', error)
      toast.error('Failed to paste from clipboard')
    }
  }, [screenToFlowPosition, handleNodeDataChange, setNodes, setEdges])

  // Duplicate selected nodes with offset
  const handleDuplicate = React.useCallback(() => {
    // Use reactFlowInstance to get current nodes and edges for fresh state
    const currentNodes = reactFlowInstance.getNodes()
    const currentEdges = reactFlowInstance.getEdges()
    const selectedNodesList = currentNodes.filter(n => n.selected)
    
    if (selectedNodesList.length === 0) return

    const selectedNodeIds = new Set(selectedNodesList.map(n => n.id))
    const nodesToDuplicate = selectedNodesList
    const edgesToDuplicate = currentEdges.filter(e => 
      selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
    )

    // Check if selection contains a group workflow or individual nodes
    const hasGroupNode = nodesToDuplicate.some(n => n.type === 'group')
    
    let newNodes: Node[]
    let newEdges: Edge[]
    
    if (hasGroupNode) {
      // Calculate center of selection
      const centerX = nodesToDuplicate.reduce((sum, n) => sum + n.position.x, 0) / nodesToDuplicate.length
      const centerY = nodesToDuplicate.reduce((sum, n) => sum + n.position.y, 0) / nodesToDuplicate.length
      
      // Offset by 50px
      const offsetPosition = { x: centerX + 50, y: centerY + 50 }
      
      // Use instantiateWorkflow for grouped nodes
      const result = instantiateWorkflow(
        nodesToDuplicate,
        edgesToDuplicate,
        offsetPosition
      )
      newNodes = result.nodes
      newEdges = result.edges
    } else {
      // Handle individual nodes without group
      // Create ID mapping for all nodes
      const idMap = new Map<string, string>()
      nodesToDuplicate.forEach(node => {
        idMap.set(node.id, `${node.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
      })
      
      // Offset by 50px
      const offsetX = 50
      const offsetY = 50
      
      // Clone nodes with new IDs and adjusted positions
      newNodes = nodesToDuplicate.map(node => ({
        ...node,
        id: idMap.get(node.id)!,
        position: {
          x: node.position.x + offsetX,
          y: node.position.y + offsetY,
        },
        selected: false,
      }))
      
      // Clone edges with new node ID references
      newEdges = edgesToDuplicate.map(edge => ({
        ...edge,
        id: `${idMap.get(edge.source)}-${edge.sourceHandle || "default"}-${idMap.get(edge.target)}-${edge.targetHandle || "default"}`,
        source: idMap.get(edge.source)!,
        target: idMap.get(edge.target)!,
        selected: false,
      }))
    }

    // Inject onDataChange callback to all new nodes
    const nodesWithCallbacks = newNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onDataChange: handleNodeDataChange,
      },
    }))

    setNodes((nds) => [
      ...nds.map(n => ({ ...n, selected: false })),
      ...nodesWithCallbacks.map(n => ({ ...n, selected: true }))
    ])
    setEdges((eds) => [...eds, ...newEdges])
    
    toast.success(`Duplicated ${newNodes.length} node${newNodes.length > 1 ? 's' : ''}`)
  }, [reactFlowInstance, handleNodeDataChange, setNodes, setEdges])

  // Delete selected nodes and edges
  const handleDelete = React.useCallback(() => {
    // Use reactFlowInstance to get current nodes for fresh state
    const currentNodes = reactFlowInstance.getNodes()
    const selectedNodesList = currentNodes.filter(n => n.selected)
    
    if (selectedNodesList.length === 0) return

    const selectedNodeIds = new Set(selectedNodesList.map(n => n.id))
    
    setNodes((nds) => nds.filter(n => !selectedNodeIds.has(n.id)))
    setEdges((eds) => eds.filter(e => 
      !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)
    ))
    
    toast.success(`Deleted ${selectedNodesList.length} node${selectedNodesList.length > 1 ? 's' : ''}`)
  }, [reactFlowInstance, setNodes, setEdges])

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      
      // Don't trigger shortcuts when typing in inputs or contenteditable elements
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return
      }

      const isMod = event.ctrlKey || event.metaKey

      if (isMod && event.key === 'c') {
        event.preventDefault()
        event.stopPropagation()
        handleCopy()
      } else if (isMod && event.key === 'v') {
        event.preventDefault()
        event.stopPropagation()
        // Paste at viewport center
        const viewportCenter = {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        }
        handlePaste(viewportCenter)
      } else if (isMod && event.key === 'd') {
        event.preventDefault()
        event.stopPropagation()
        handleDuplicate()
      }
    }

    // Attach to document to ensure it captures all keyboard events
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [handleCopy, handlePaste, handleDuplicate])

  // Instantiate a saved workflow on the canvas
  const handleInstantiateWorkflow = React.useCallback((workflow: Workflow) => {
    try {
      // Calculate center position of viewport
      const viewport = reactFlowInstance.getViewport()
      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom

      // Instantiate workflow with new IDs and positions
      const { nodes: newNodes, edges: newEdges } = instantiateWorkflow(
        workflow.nodes,
        workflow.edges,
        { x: centerX, y: centerY }
      )

      // Inject onDataChange callback to all new nodes
      const nodesWithCallbacks = newNodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          onDataChange: handleNodeDataChange,
        },
      }))

      // Add to canvas
      setNodes((nds) => [...nds, ...nodesWithCallbacks])
      setEdges((eds) => [...eds, ...newEdges])

      toast.success(`Added workflow: ${workflow.name}`)
    } catch (error) {
      console.error("Error instantiating workflow:", error)
      toast.error(error instanceof Error ? error.message : "Failed to add workflow")
    }
  }, [reactFlowInstance, handleNodeDataChange, setNodes, setEdges])

  // Open edit workflow dialog
  const handleEditWorkflow = React.useCallback((workflow: Workflow) => {
    setEditingWorkflow(workflow)
    setEditWorkflowDialogOpen(true)
  }, [])

  // Save workflow to database
  const handleSave = React.useCallback(async () => {
    setIsSaving(true)
    try {
      uploadErrorsRef.current = 0

      // Generate and upload thumbnail
      let thumbnailUrl: string | null = null
      if (canvasRef.current) {
        const flowElement = canvasRef.current.querySelector('.react-flow') as HTMLElement
        if (flowElement) {
          thumbnailUrl = await generateAndUploadThumbnail(flowElement, canvasId, userId)
        }
      }

      // Ensure uploads are completed before saving
      await waitForUploads()
      if (uploadErrorsRef.current > 0) {
        toast.error("Some uploads failed. Please retry before saving.")
        return
      }

      // Use React Flow's toObject to get properly serialized flow state
      const flow = reactFlowInstance.toObject()
      
      // Avoid persisting transient local URLs by clearing them during save.
      // This keeps saving unblocked while uploads are still in progress.
      let transientMediaCount = 0
      const nodesForSave = flow.nodes.map((node) => {
        if (node.type !== "upload") return node
        const nodeData = node.data as Partial<CanvasNodeData> | null
        const url = typeof nodeData?.fileUrl === "string" ? nodeData.fileUrl : null
        const isTransientUrl = !!url && (url.startsWith("blob:") || url.startsWith("data:"))
        if (!isTransientUrl) return node

        transientMediaCount += 1
        return {
          ...node,
          data: {
            ...node.data,
            fileUrl: null,
          },
        }
      })
      
      console.log('[handleSave] Flow from toObject:', {
        nodesCount: flow.nodes.length,
        edgesCount: flow.edges.length,
        edges: flow.edges,
      })
      
      // Save canvas to database
      await saveCanvasClient(canvasId, {
        name: workflowName,
        nodes: nodesForSave,
        edges: flow.edges,
        thumbnail_url: thumbnailUrl || undefined,
      })
      
      if (transientMediaCount > 0) {
        toast.warning(
          `Saved while ${transientMediaCount} media upload${transientMediaCount > 1 ? "s were" : " was"} still in progress.`
        )
      }
      toast.success("Canvas saved")
    } catch (error) {
      console.error("Save error:", error)
      toast.error("Failed to save canvas")
    } finally {
      setIsSaving(false)
    }
  }, [canvasId, workflowName, userId, reactFlowInstance, waitForUploads, setNodes])

  // Execute workflow
  const handleExecute = React.useCallback(async () => {
    if (nodes.length === 0) {
      toast.error("Add nodes to the canvas first")
      return
    }

    setIsExecuting(true)
    try {
      await executeWorkflow(nodes, edges, {
        onNodeStart: (nodeId) => {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId
                ? { ...n, data: { ...n.data, isGenerating: true, error: null } }
                : n
            )
          )
        },
        onNodeComplete: (nodeId, output) => {
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id !== nodeId) return n
              const updates: Record<string, unknown> = {
                isGenerating: false,
                error: null,
              }
              if (output.imageUrl) {
                const existingImageUrls = Array.isArray((n.data as { generatedImageUrls?: unknown }).generatedImageUrls)
                  ? ((n.data as { generatedImageUrls?: unknown }).generatedImageUrls as unknown[])
                      .filter((url): url is string => typeof url === "string" && url.length > 0)
                  : []
                const fallbackSingle = typeof (n.data as { generatedImageUrl?: unknown }).generatedImageUrl === "string"
                  ? [(n.data as { generatedImageUrl: string }).generatedImageUrl]
                  : []
                const currentImageUrls = existingImageUrls.length > 0 ? existingImageUrls : fallbackSingle
                const maxGeneratedImages = 20
                const nextImageUrls = [...currentImageUrls, output.imageUrl].slice(-maxGeneratedImages)
                const nextActiveIndex = nextImageUrls.length - 1

                updates.generatedImageUrls = nextImageUrls
                updates.activeImageIndex = nextActiveIndex
                updates.generatedImageUrl = nextImageUrls[nextActiveIndex] ?? null
              }
              if (output.videoUrl) updates.generatedVideoUrl = output.videoUrl
              if (output.audioUrl) updates.generatedAudioUrl = output.audioUrl
              return { ...n, data: { ...n.data, ...updates } }
            })
          )
        },
        onNodeError: (nodeId, error) => {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId
                ? { ...n, data: { ...n.data, isGenerating: false, error } }
                : n
            )
          )
        },
      })
      toast.success("Workflow execution complete")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Workflow execution failed"
      )
    } finally {
      setIsExecuting(false)
    }
  }, [nodes, edges, setNodes])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" ref={canvasRef}>
      <CanvasHeader
        name={workflowName}
        onNameChange={setWorkflowName}
        onSave={handleSave}
        onExecute={handleExecute}
        isSaving={isSaving}
        isExecuting={isExecuting}
      />
      
      <div className="flex-1 relative h-full w-full">
        {/* Drag and Drop Overlay */}
        {isDraggingFile && (
          <div 
            className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm pointer-events-none"
            aria-live="polite"
            role="status"
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="text-2xl font-semibold text-foreground">
                Drop images or videos here to upload
              </div>
              <div className="text-sm text-muted-foreground">
                Supported formats: Images (JPG, PNG, GIF, WebP) and Videos (MP4, WebM, MOV)
              </div>
            </div>
          </div>
        )}
        
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onDragOver={onDragOver}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onNodeContextMenu={(event, node) => {
            event.preventDefault()
            setClickedNode(node)
            setContextMenuPosition({ x: event.clientX, y: event.clientY })
            
            // Select the node if it's not already selected
            if (!node.selected) {
              setNodes((nds) =>
                nds.map((n) => ({
                  ...n,
                  selected: n.id === node.id,
                }))
              )
            }
          }}
          onPaneContextMenu={(event) => {
            event.preventDefault()
            setClickedNode(null)
            setContextMenuPosition({ x: event.clientX, y: event.clientY })
          }}
          onPaneClick={() => {
            setContextMenuPosition(null)
          }}
          fitView
          minZoom={0.1}
          maxZoom={4}
          deleteKeyCode={["Backspace", "Delete"]}
          elevateNodesOnSelect={false}
          style={{ width: '100%', height: '100%' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          
          <Panel position="center-left" className="ml-4">
            <CanvasSidebar 
              onAddNode={handleAddNode}
              onInstantiateWorkflow={handleInstantiateWorkflow}
              onEditWorkflow={handleEditWorkflow}
            />
          </Panel>
            
          <Panel position="bottom-left" className="m-4">
            <CanvasToolbar />
          </Panel>

          {selectedNodes.length >= 2 && !selectedGroupNode && (
            <Panel position="top-center" className="mt-4">
              <CanvasSelectionActionBar
                selectedCount={selectedNodes.length}
                onGroup={handleGroup}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            </Panel>
          )}

          {/* Single group selected - show action bar with ungroup + save workflow */}
          {selectedGroupNode && (
            <Panel position="top-center" className="mt-4">
              <CanvasSelectionActionBar
                selectedCount={1}
                selectedGroupId={selectedGroupNode.id}
                onGroup={() => {}}
                onUngroup={() => handleUngroup(selectedGroupNode.id)}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onSaveWorkflow={() => setSaveWorkflowDialogOpen(true)}
              />
            </Panel>
          )}
        </ReactFlow>

        {/* Context Menu */}
        <CanvasContextMenu
          position={contextMenuPosition}
          selectedNodes={selectedNodes}
          clickedNode={clickedNode}
          hasClipboard={hasClipboard}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onGroup={handleGroup}
          onUngroup={() => selectedGroupNode && handleUngroup(selectedGroupNode.id)}
          onAddNode={handleAddNode}
          onClose={() => setContextMenuPosition(null)}
        />
      </div>

      {/* Save Workflow Dialog */}
      <SaveWorkflowDialog
        groupId={selectedGroupNode?.id || null}
        open={saveWorkflowDialogOpen}
        onOpenChange={setSaveWorkflowDialogOpen}
      />

      {/* Edit Workflow Dialog */}
      <EditWorkflowDialog
        workflow={editingWorkflow}
        open={editWorkflowDialogOpen}
        onOpenChange={setEditWorkflowDialogOpen}
      />
    </div>
  )
}

export default function CanvasPage() {
  return (
    <ReactFlowProvider>
      <CanvasContent />
    </ReactFlowProvider>
  )
}
