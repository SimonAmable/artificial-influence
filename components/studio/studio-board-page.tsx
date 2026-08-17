"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  InfluencerInputBox,
  type InfluencerInputSnapshot,
} from "@/components/tools/influencer"
import { ImageStudioToolInput } from "@/components/tools/image-studio"
import { VideoInputBox } from "@/components/tools/video/video-input-box"
import type { MultiShotItem } from "@/components/tools/video/multi-shot-editor"
import { HeroToolTabs, type HeroToolTabId } from "@/components/dashboard/hero-tool-tabs"
import { StudioInfiniteCanvas, type StudioInfiniteCanvasHandle } from "@/components/studio/studio-infinite-canvas"
import { StudioTileCard } from "@/components/studio/studio-tile-card"
import { ImageEditorDialog } from "@/components/image-editor/image-editor-dialog"
import {
  FullscreenMediaViewer,
  type FullscreenMediaViewerAction,
} from "@/components/shared/display/fullscreen-media-viewer"
import { copyMediaToClipboard, downloadMediaFile } from "@/components/shared/display/media-viewer-utils"
import { ArrowsClockwise, Copy, DotsThree, DownloadSimple, ImageSquare, PencilSimple, Trash } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ImageUpload } from "@/components/shared/upload/photo-upload"
import type { AudioUploadValue } from "@/components/shared/upload/audio-upload"
import { useDefaultEnhancePrompt } from "@/hooks/use-default-enhance-prompt"
import { useModels } from "@/hooks/use-models"
import {
  buildStudioToolGenerationRequest,
  getStudioToolByUiModel,
  useEffectiveImageModels,
  validateDualReferenceSwapState,
} from "@/lib/image/studio-tools"
import { DEFAULT_IMAGE_MODEL_IDENTIFIER, isSeedanceVideoModelIdentifier, usesFalMultimodalVideoInputs } from "@/lib/constants/models"
import { appendImageReferencesToFormData } from "@/lib/image/append-references-to-form-data"
import { resolveReferenceImageForGeneration } from "@/lib/image/resolve-reference-for-generation"
import { appendStudioBoardFieldsToFormData } from "@/lib/studio/form-data"
import {
  fetchStudioProject,
  updateGenerationStudioLayout,
  updateStudioProjectClient,
} from "@/lib/studio/database"
import {
  findNeighborPlacement,
  findOpenPlacement,
  packStudioTiles,
  relayoutOriginStackedTiles,
  tileFromGeneration,
  tileSizeForAspectRatio,
  tileSizeFromPixelRatio,
} from "@/lib/studio/placement"
import { buildStudioVideoGenerationBody } from "@/lib/studio/build-video-generation-body"
import {
  animateViewport,
  boundingRect,
  viewportToCenterRect,
  viewportToFitRect,
  viewportToResetZoom,
} from "@/lib/studio/camera"
import type { StudioProject, StudioTile, StudioViewport } from "@/lib/studio/types"
import {
  generateImageAndWait,
  isInsufficientCreditsError,
  isInsufficientCreditsMessage,
  type GenerateImageAcceptedPayload,
} from "@/lib/generate-image-client"
import { generateVideoAndWait } from "@/lib/generate-video-client"
import {
  toUserFacingGenerationError,
  tryShowContentModerationToast,
} from "@/lib/content-moderation-toast"
import { showCreditsUpsellToast } from "@/lib/pricing-upsell"
import { buildPromptWithRefs } from "@/lib/commands/build-prompt"
import {
  brandRefsOnly,
  getImageAssetUrlsFromRefChips,
  hasVideoOrAudioAssetRefs,
} from "@/lib/commands/ref-image-pipeline"
import { validateVideoAttachedRefs } from "@/lib/commands/validate-video-refs"
import type { AttachedRef } from "@/lib/commands/types"
import {
  getDefaultAspectRatioForModel,
  getSupportedAspectRatios,
  pickRetainedAspectRatio,
  resolveAspectRatioForRequest,
} from "@/lib/utils/aspect-ratios"
import { getDefaultImageModelParameters } from "@/lib/pricing-parameter-ui"
import { buildVideoModelParameters } from "@/lib/utils/video-model-parameters"
import { resolveVideoPricingQuote } from "@/lib/video-pricing"
import type { Model, ModelInputValues, ParameterDefinition, StringParameterDefinition } from "@/lib/types/models"
import { useAIChatDockInsetRight } from "@/components/ai-chat"
import { dispatchChatAddAsset, dispatchChatRemoveAsset } from "@/lib/chat/chat-add-asset"

function createClientRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function mapStudioGenerationRow(generation: Record<string, unknown>): StudioTile {
  return tileFromGeneration({
    id: String(generation.id),
    url: typeof generation.url === "string" ? generation.url : null,
    prompt: typeof generation.prompt === "string" ? generation.prompt : null,
    model: typeof generation.model === "string" ? generation.model : null,
    type: typeof generation.type === "string" ? generation.type : null,
    aspect_ratio:
      typeof generation.aspect_ratio === "string" ? generation.aspect_ratio : null,
    status: typeof generation.status === "string" ? generation.status : null,
    reference_image_urls: Array.isArray(generation.reference_image_urls)
      ? (generation.reference_image_urls as string[])
      : [],
    studio_x: typeof generation.studio_x === "number" ? generation.studio_x : null,
    studio_y: typeof generation.studio_y === "number" ? generation.studio_y : null,
    studio_width:
      typeof generation.studio_width === "number" ? generation.studio_width : null,
    studio_height:
      typeof generation.studio_height === "number" ? generation.studio_height : null,
    created_at:
      typeof generation.created_at === "string" ? generation.created_at : null,
  })
}

const STUDIO_CHROME =
  "rounded-full border border-border/70 bg-background/90 shadow-sm backdrop-blur"

function tileMatchesSelection(tile: StudioTile, selectedIds: string[]) {
  return selectedIds.includes(tile.id) || Boolean(tile.generationId && selectedIds.includes(tile.generationId))
}

function measureImagePixelSize(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new window.Image()
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        resolve(null)
        return
      }
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => resolve(null)
    image.src = url
  })
}

interface StudioBoardPageProps {
  projectId: string
}

export function StudioBoardPage({ projectId }: StudioBoardPageProps) {
  const { models: effectiveImageModels } = useEffectiveImageModels()
  const { models: videoModels, isLoading: videoModelsLoading } = useModels("video")
  const { defaultEnhancePrompt, isReady: defaultEnhancePromptReady } = useDefaultEnhancePrompt()
  const chatDockInsetRight = useAIChatDockInsetRight()
  const promptPanelStyle = React.useMemo(
    () => ({ right: chatDockInsetRight }),
    [chatDockInsetRight],
  )

  const [project, setProject] = React.useState<StudioProject | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [tiles, setTiles] = React.useState<StudioTile[]>([])
  const [selectedTileIds, setSelectedTileIds] = React.useState<string[]>([])
  const [viewport, setViewport] = React.useState<StudioViewport>({ x: 0, y: 0, zoom: 1 })
  const [projectName, setProjectName] = React.useState("")
  const [studioMode, setStudioMode] = React.useState<HeroToolTabId>("image")
  const [prompt, setPrompt] = React.useState("")
  const [attachedCommandRefs, setAttachedCommandRefs] = React.useState<AttachedRef[]>([])
  const [referenceImages, setReferenceImages] = React.useState<ImageUpload[]>([])
  const [enhancePrompt, setEnhancePrompt] = React.useState(false)
  const [selectedModel, setSelectedModel] = React.useState("")
  const [selectedAspectRatio, setSelectedAspectRatio] = React.useState("1:1")
  const [selectedNumImages, setSelectedNumImages] = React.useState(1)
  const [selectedModelParameters, setSelectedModelParameters] =
    React.useState<ModelInputValues>({})
  const [studioToolSourceImage, setStudioToolSourceImage] = React.useState<ImageUpload | null>(null)
  const [studioToolSceneImage, setStudioToolSceneImage] = React.useState<ImageUpload | null>(null)
  const [studioToolAdditionalInstructions, setStudioToolAdditionalInstructions] =
    React.useState("")
  const [pendingCount, setPendingCount] = React.useState(0)
  const [fullscreenTile, setFullscreenTile] = React.useState<StudioTile | null>(null)
  const [editorTile, setEditorTile] = React.useState<StudioTile | null>(null)
  const [copiedPromptKey, setCopiedPromptKey] = React.useState<string | null>(null)
  const [videoPrompt, setVideoPrompt] = React.useState("")
  const [videoNegativePrompt, setVideoNegativePrompt] = React.useState("")
  const [selectedVideoModel, setSelectedVideoModel] = React.useState<Model | null>(null)
  const [videoInputImage, setVideoInputImage] = React.useState<ImageUpload | null>(null)
  const [videoLastFrameImage, setVideoLastFrameImage] = React.useState<ImageUpload | null>(null)
  const [videoInputVideo, setVideoInputVideo] = React.useState<ImageUpload | null>(null)
  const [videoInputAudio, setVideoInputAudio] = React.useState<AudioUploadValue | null>(null)
  const [videoParameters, setVideoParameters] = React.useState<Record<string, unknown>>({})
  const [videoMultiShotMode, setVideoMultiShotMode] = React.useState(false)
  const [videoMultiShotShots, setVideoMultiShotShots] = React.useState<MultiShotItem[]>([])
  const [videoReferenceImages, setVideoReferenceImages] = React.useState<ImageUpload[]>([])
  const [videoAttachedRefs, setVideoAttachedRefs] = React.useState<AttachedRef[]>([])
  const enhanceSeededRef = React.useRef(false)
  const prevVideoModelIdForParamsRef = React.useRef<string | null>(null)
  const boardOpenedAtRef = React.useRef(Date.now() - 5000)
  const inferredGenerationIdsRef = React.useRef(new Set<string>())
  const viewportSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const canvasRef = React.useRef<StudioInfiniteCanvasHandle>(null)
  const cameraAnimCancelRef = React.useRef<(() => void) | null>(null)
  const skipViewportPersistRef = React.useRef(false)
  const viewportRef = React.useRef(viewport)
  const tilesRef = React.useRef(tiles)
  const editorTileRef = React.useRef<StudioTile | null>(null)
  const hasLoadedRef = React.useRef(false)
  const previousStudioModeRef = React.useRef(false)

  React.useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  React.useEffect(() => {
    tilesRef.current = tiles
  }, [tiles])

  const selectedModelObject = React.useMemo(
    () => effectiveImageModels.find((model) => model.identifier === selectedModel) ?? null,
    [effectiveImageModels, selectedModel],
  )
  const selectedStudioTool = React.useMemo(
    () => getStudioToolByUiModel(selectedModel),
    [selectedModel],
  )

  const selectedTiles = React.useMemo(
    () =>
      selectedTileIds
        .map((id) => tiles.find((tile) => tile.id === id || tile.generationId === id))
        .filter((tile): tile is StudioTile => Boolean(tile)),
    [selectedTileIds, tiles],
  )
  const selectedTile = selectedTiles[selectedTiles.length - 1] ?? null

  React.useEffect(() => {
    const isStudioMode = Boolean(selectedStudioTool)
    const wasStudioMode = previousStudioModeRef.current

    if (isStudioMode && !wasStudioMode) {
      const incoming = [...referenceImages]
      if (incoming.length > 0) {
        setStudioToolSourceImage(incoming[0] ?? null)
        setStudioToolSceneImage(incoming[1] ?? null)
        setReferenceImages(incoming.slice(2))
      }
    } else if (!isStudioMode && wasStudioMode) {
      const outgoing = [studioToolSourceImage, studioToolSceneImage].filter(
        (image): image is ImageUpload => Boolean(image),
      )
      if (outgoing.length > 0) {
        setReferenceImages((current) => [...outgoing, ...current])
      }
      setStudioToolSourceImage(null)
      setStudioToolSceneImage(null)
      setStudioToolAdditionalInstructions("")
    }

    previousStudioModeRef.current = isStudioMode
  }, [referenceImages, selectedStudioTool, studioToolSceneImage, studioToolSourceImage])

  React.useEffect(() => {
    if (!defaultEnhancePromptReady || enhanceSeededRef.current) return
    setEnhancePrompt(defaultEnhancePrompt)
    enhanceSeededRef.current = true
  }, [defaultEnhancePrompt, defaultEnhancePromptReady])

  React.useEffect(() => {
    if (!selectedModel && effectiveImageModels.length > 0) {
      const preferred =
        effectiveImageModels.find((m) => m.identifier === DEFAULT_IMAGE_MODEL_IDENTIFIER) ??
        effectiveImageModels[0]
      setSelectedModel(preferred.identifier)
      setSelectedModelParameters(getDefaultImageModelParameters(preferred))
      setSelectedAspectRatio(getDefaultAspectRatioForModel(preferred))
    }
  }, [effectiveImageModels, selectedModel])

  React.useEffect(() => {
    if (!selectedModelObject) return
    const supported = getSupportedAspectRatios(selectedModelObject)
    setSelectedAspectRatio((current) =>
      pickRetainedAspectRatio(current, supported) ?? getDefaultAspectRatioForModel(selectedModelObject),
    )
    setSelectedModelParameters(getDefaultImageModelParameters(selectedModelObject))
  }, [selectedModelObject])

  React.useEffect(() => {
    if (videoModels.length === 0 || selectedVideoModel) return
    const first = videoModels[0]
    setSelectedVideoModel({
      ...first,
      parameters: { parameters: buildVideoModelParameters(first) },
    })
  }, [selectedVideoModel, videoModels])

  React.useEffect(() => {
    if (!selectedVideoModel) return
    const modelId = selectedVideoModel.identifier
    const prevModelId = prevVideoModelIdForParamsRef.current
    prevVideoModelIdForParamsRef.current = modelId
    const paramList = selectedVideoModel.parameters.parameters

    setVideoParameters((prev) => {
      const next: Record<string, unknown> = {}
      paramList.forEach((param: ParameterDefinition) => {
        next[param.name] = param.default
      })

      const aspectParam = paramList.find(
        (param): param is StringParameterDefinition =>
          (param.name === "aspect_ratio" || param.name === "aspectRatio") &&
          param.type === "string" &&
          Array.isArray(param.enum) &&
          param.enum.length > 0,
      )

      if (!aspectParam?.enum?.length || prevModelId === null) {
        return next
      }

      const supported = aspectParam.enum.map(String)
      const prevAspectRaw = prev.aspect_ratio ?? prev.aspectRatio
      if (prevAspectRaw === undefined || prevAspectRaw === null) {
        return next
      }

      const kept = pickRetainedAspectRatio(String(prevAspectRaw), supported)
      if (kept) {
        next[aspectParam.name] = kept
      }

      return next
    })
  }, [selectedVideoModel])

  const videoModelSupportsImage = React.useMemo(() => {
    return (
      selectedVideoModel?.parameters.parameters?.some(
        (param) =>
          param.name === "image" ||
          param.name === "first_frame_image" ||
          param.name === "start_image",
      ) ?? false
    )
  }, [selectedVideoModel])

  const videoModelSupportsLastFrame = React.useMemo(() => {
    return (
      selectedVideoModel?.parameters.parameters?.some(
        (param) => param.name === "last_frame" || param.name === "last_frame_image",
      ) ?? false
    )
  }, [selectedVideoModel])

  const videoModelSupportsExtraImageRefs = React.useMemo(() => {
    if (!selectedVideoModel) return false
    return (
      selectedVideoModel.identifier === "kwaivgi/kling-v3-omni-video" ||
      isSeedanceVideoModelIdentifier(selectedVideoModel.identifier) ||
      usesFalMultimodalVideoInputs(selectedVideoModel.identifier)
    )
  }, [selectedVideoModel])

  const applyVideoRefsFromTiles = React.useCallback(
    (incoming: StudioTile[], options?: { toggle?: boolean }) => {
      const toggle = options?.toggle ?? false
      let start = videoInputImage
      let last = videoLastFrameImage
      let video = videoInputVideo
      let extras = [...videoReferenceImages]

      const imageAlreadyUsed = (url: string) =>
        start?.url === url || last?.url === url || extras.some((image) => image.url === url)

      for (const tile of incoming) {
        if (!tile.url || tile.status !== "completed") continue
        const url = tile.url

        if (tile.kind === "video") {
          if (toggle && video?.url === url) {
            video = null
            continue
          }
          if (!toggle && video?.url === url) continue
          video = { url }
          continue
        }

        if (toggle && imageAlreadyUsed(url)) {
          if (start?.url === url) start = null
          else if (last?.url === url) last = null
          else extras = extras.filter((image) => image.url !== url)
          continue
        }

        if (imageAlreadyUsed(url)) continue

        if (videoModelSupportsImage && !start) {
          start = { url }
        } else if (videoModelSupportsLastFrame && !last) {
          last = { url }
        } else if (videoModelSupportsExtraImageRefs) {
          extras = [...extras, { url }]
        } else if (videoModelSupportsImage) {
          start = { url }
        } else {
          extras = [...extras, { url }]
        }
      }

      setVideoInputImage(start)
      setVideoLastFrameImage(last)
      setVideoInputVideo(video)
      setVideoReferenceImages(extras)
    },
    [
      videoInputImage,
      videoInputVideo,
      videoLastFrameImage,
      videoModelSupportsExtraImageRefs,
      videoModelSupportsImage,
      videoModelSupportsLastFrame,
      videoReferenceImages,
    ],
  )

  const previousStudioTabRef = React.useRef(studioMode)

  React.useEffect(() => {
    const previousTab = previousStudioTabRef.current
    previousStudioTabRef.current = studioMode

    if (studioMode === "agent") {
      window.dispatchEvent(new CustomEvent("chat-open"))
      if (previousTab !== "agent") {
        for (const tile of selectedTiles) {
          if (tile.url && (tile.kind === "image" || tile.kind === "video")) {
            dispatchChatAddAsset(tile.url, tile.kind)
          }
        }
      }
      return
    }

    if (studioMode === "video" && previousTab !== "video") {
      applyVideoRefsFromTiles(selectedTiles)
    }
  }, [applyVideoRefsFromTiles, selectedTiles, studioMode])

  const fetchProjectTiles = React.useCallback(async () => {
    const response = await fetch(
      `/api/generations?studioProjectId=${encodeURIComponent(projectId)}&includePending=true&excludeFailed=false&limit=100`,
    )
    if (!response.ok) {
      throw new Error("Failed to load studio generations")
    }
    const payload = (await response.json()) as {
      generations: Array<Record<string, unknown>>
    }
    return (payload.generations ?? [])
      .filter((generation) => generation.type !== "audio")
      .map(mapStudioGenerationRow)
  }, [projectId])

  const loadBoard = React.useCallback(async () => {
    try {
      setLoading(true)
      setLoadError(null)
      const loaded = await fetchStudioProject(projectId)
      setProject(loaded)
      setProjectName(loaded.name)
      if (!hasLoadedRef.current) {
        setViewport(loaded.viewport)
        hasLoadedRef.current = true
      }
      setTiles(await fetchProjectTiles())
    } catch (error) {
      console.error(error)
      setLoadError(error instanceof Error ? error.message : "Could not load studio project")
      toast.error("Could not load studio project")
    } finally {
      setLoading(false)
    }
  }, [fetchProjectTiles, projectId])

  React.useEffect(() => {
    void loadBoard()
  }, [loadBoard])

  const persistViewport = React.useCallback(
    (next: StudioViewport, options?: { persist?: boolean }) => {
      cameraAnimCancelRef.current?.()
      cameraAnimCancelRef.current = null
      setViewport(next)
      if (options?.persist === false || skipViewportPersistRef.current) return
      if (viewportSaveTimer.current) clearTimeout(viewportSaveTimer.current)
      viewportSaveTimer.current = setTimeout(() => {
        void updateStudioProjectClient(projectId, { viewport: next }).catch((error) => {
          console.error("Failed to save viewport", error)
        })
      }, 400)
    },
    [projectId],
  )

  const cameraInset = React.useMemo(
    () => ({
      top: 112,
      bottom: studioMode === "agent" ? 140 : 280,
      right: typeof chatDockInsetRight === "number" ? chatDockInsetRight : 0,
    }),
    [chatDockInsetRight, studioMode],
  )

  const flyToViewport = React.useCallback(
    (to: StudioViewport) => {
      const from = viewportRef.current
      cameraAnimCancelRef.current?.()
      skipViewportPersistRef.current = true
      cameraAnimCancelRef.current = animateViewport(from, to, 420, setViewport, () => {
        skipViewportPersistRef.current = false
        cameraAnimCancelRef.current = null
        void updateStudioProjectClient(projectId, { viewport: to }).catch(() => undefined)
      })
    },
    [projectId],
  )

  const panToTiles = React.useCallback(
    (targets: Array<{ x: number; y: number; width: number; height: number }>) => {
      const bounds = boundingRect(targets)
      const size = canvasRef.current?.getSize()
      if (!bounds || !size || size.width < 8 || size.height < 8) return
      flyToViewport(viewportToCenterRect(bounds, size, viewportRef.current.zoom, cameraInset))
    },
    [cameraInset, flyToViewport],
  )

  const mergeServerTiles = React.useCallback(
    (serverTiles: StudioTile[], options?: { panToNew?: boolean }) => {
      const previousIds = new Set(tilesRef.current.map((tile) => tile.generationId ?? tile.id))
      const { tiles: laidOut, moved } = relayoutOriginStackedTiles(serverTiles, {
        createdAfter: boardOpenedAtRef.current,
      })

      for (const tile of moved) {
        if (!tile.generationId) continue
        void updateGenerationStudioLayout({
          generationId: tile.generationId,
          x: tile.x,
          y: tile.y,
          width: tile.width,
          height: tile.height,
          projectId,
        }).catch(() => undefined)
      }

      setTiles((prev) => {
        const inFlight = prev.filter(
          (tile) =>
            tile.status === "pending" &&
            !laidOut.some(
              (server) => server.id === tile.generationId || server.id === tile.id,
            ),
        )
        return [...inFlight, ...laidOut]
      })

      setSelectedTileIds((current) => {
        if (current.length === 0) return current
        const previous = tilesRef.current
        return current.map((id) => {
          const fromServer = laidOut.find((tile) => tile.id === id || tile.generationId === id)
          if (fromServer) return fromServer.id
          const fromPrevious = previous.find((tile) => tile.id === id || tile.generationId === id)
          if (fromPrevious?.url) {
            const byUrl = laidOut.find((tile) => tile.url === fromPrevious.url)
            if (byUrl) return byUrl.id
          }
          return id
        })
      })

      if (!options?.panToNew) return
      const newcomers = laidOut.filter((tile) => !previousIds.has(tile.generationId ?? tile.id))
      if (newcomers.length > 0) {
        panToTiles(newcomers)
      }
    },
    [panToTiles, projectId],
  )

  const inferUnattachedAgentGenerations = React.useCallback(async () => {
    const response = await fetch(
      `/api/generations?includePending=true&excludeFailed=false&limit=30`,
    )
    if (!response.ok) return
    const payload = (await response.json()) as {
      generations: Array<Record<string, unknown>>
    }
    const openedAt = boardOpenedAtRef.current
    const candidates = (payload.generations ?? []).filter((generation) => {
      const id = typeof generation.id === "string" ? generation.id : null
      const tool = typeof generation.tool === "string" ? generation.tool : ""
      const type = typeof generation.type === "string" ? generation.type : "image"
      const createdAt =
        typeof generation.created_at === "string" ? Date.parse(generation.created_at) : 0
      if (!id || inferredGenerationIdsRef.current.has(id)) return false
      if (generation.studio_project_id) return false
      if (!tool.startsWith("chat-")) return false
      if (type === "audio") return false
      if (!Number.isFinite(createdAt) || createdAt < openedAt) return false
      return true
    })

    if (candidates.length === 0) return

    const occupied = tilesRef.current.map((item) => ({
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    }))

    for (const generation of candidates) {
      const id = String(generation.id)
      inferredGenerationIdsRef.current.add(id)
      const tile = mapStudioGenerationRow(generation)
      const [placement] = findOpenPlacement({
        existing: occupied,
        width: tile.width,
        height: tile.height,
      })
      const x = placement?.x ?? 0
      const y = placement?.y ?? 0
      occupied.push({
        x,
        y,
        width: tile.width,
        height: tile.height,
      })
      await updateGenerationStudioLayout({
        generationId: id,
        x,
        y,
        width: tile.width,
        height: tile.height,
        projectId,
      }).catch(() => undefined)
    }
  }, [projectId])

  const syncBoardTiles = React.useCallback(async () => {
    try {
      await inferUnattachedAgentGenerations()
      const serverTiles = await fetchProjectTiles()
      mergeServerTiles(serverTiles, { panToNew: true })
    } catch (error) {
      console.error("Failed to sync studio board", error)
    }
  }, [fetchProjectTiles, inferUnattachedAgentGenerations, mergeServerTiles])

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void syncBoardTiles()
    }, 2500)
    return () => window.clearInterval(timer)
  }, [syncBoardTiles])

  const handleFitAll = React.useCallback(() => {
    const bounds = boundingRect(tiles)
    const size = canvasRef.current?.getSize()
    if (!bounds || !size || size.width < 8 || size.height < 8) return
    flyToViewport(viewportToFitRect(bounds, size, cameraInset))
  }, [cameraInset, flyToViewport, tiles])

  const handleResetZoom = React.useCallback(() => {
    const size = canvasRef.current?.getSize()
    if (!size || size.width < 8 || size.height < 8) return
    flyToViewport(viewportToResetZoom(viewportRef.current, size, cameraInset))
  }, [cameraInset, flyToViewport])

  const handleOrganize = React.useCallback(() => {
    if (tiles.length === 0) return
    const size = canvasRef.current?.getSize()
    const viewWidth = size
      ? Math.max(1, size.width - cameraInset.right - 96)
      : 1200
    const organized = packStudioTiles(tiles, {
      maxRowWidth: Math.max(640, viewWidth),
    })
    setTiles(organized)
    for (const tile of organized) {
      if (!tile.generationId) continue
      const previous = tiles.find((item) => item.id === tile.id)
      if (
        previous &&
        Math.abs(previous.x - tile.x) < 0.5 &&
        Math.abs(previous.y - tile.y) < 0.5
      ) {
        continue
      }
      void updateGenerationStudioLayout({
        generationId: tile.generationId,
        x: tile.x,
        y: tile.y,
        width: tile.width,
        height: tile.height,
      }).catch((error) => {
        console.error("Failed to persist organized tile", error)
      })
    }
    const bounds = boundingRect(organized)
    if (bounds && size && size.width >= 8 && size.height >= 8) {
      flyToViewport(viewportToFitRect(bounds, size, cameraInset))
    }
  }, [cameraInset, flyToViewport, tiles])

  const handleRename = React.useCallback(async () => {
    const nextName = projectName.trim() || "Untitled Studio"
    setProjectName(nextName)
    try {
      const updated = await updateStudioProjectClient(projectId, { name: nextName })
      setProject(updated)
    } catch (error) {
      console.error(error)
      toast.error("Could not rename project")
    }
  }, [projectId, projectName])

  const handleDeselect = React.useCallback(() => {
    setSelectedTileIds((currentIds) => {
      if (currentIds.length === 0) return currentIds
      const selected = tiles.filter((tile) => tileMatchesSelection(tile, currentIds))
      const selectedUrls = new Set(
        selected.map((tile) => tile.url).filter((url): url is string => Boolean(url)),
      )
      if (selectedUrls.size > 0) {
        setReferenceImages((current) => current.filter((image) => !image.url || !selectedUrls.has(image.url)))
        setVideoInputImage((current) => (current?.url && selectedUrls.has(current.url) ? null : current))
        setVideoLastFrameImage((current) => (current?.url && selectedUrls.has(current.url) ? null : current))
        setVideoInputVideo((current) => (current?.url && selectedUrls.has(current.url) ? null : current))
        setVideoReferenceImages((current) =>
          current.filter((image) => !image.url || !selectedUrls.has(image.url)),
        )
        for (const tile of selected) {
          if (tile.url) dispatchChatRemoveAsset(tile.url)
        }
      }
      return []
    })
  }, [tiles])

  const handleOpenTile = React.useCallback((tile: StudioTile) => {
    if (!tile.url || tile.status !== "completed") return
    setFullscreenTile(tile)
  }, [])

  const handleEditTile = React.useCallback((tile: StudioTile) => {
    if (tile.kind !== "image" || !tile.url || tile.status !== "completed") return
    setFullscreenTile(null)
    editorTileRef.current = tile
    setEditorTile(tile)
  }, [])

  const handleSaveEditedImage = React.useCallback(
    async (imageUrl: string, details?: { generationId?: string }) => {
      const source = editorTileRef.current
      editorTileRef.current = null
      setEditorTile(null)
      if (!imageUrl || !source) return

      const pixelSize = await measureImagePixelSize(imageUrl)
      const size = pixelSize
        ? tileSizeFromPixelRatio(pixelSize.width / pixelSize.height)
        : { width: source.width, height: source.height }
      const placement = findNeighborPlacement({
        existing: tilesRef.current.map((tile) => ({
          x: tile.x,
          y: tile.y,
          width: tile.width,
          height: tile.height,
        })),
        width: size.width,
        height: size.height,
        source,
      })

      const generationId = details?.generationId ?? null
      const newTile: StudioTile = {
        id: generationId ?? `edit-${Date.now()}`,
        clientKey: generationId ?? `edit-${Date.now()}`,
        generationId,
        url: imageUrl,
        kind: "image",
        status: "completed",
        prompt: source.prompt ?? "Edited image",
        model: source.model,
        aspectRatio: source.aspectRatio,
        referenceImageUrls: source.url ? [source.url] : [],
        x: placement.x,
        y: placement.y,
        width: size.width,
        height: size.height,
        createdAt: new Date().toISOString(),
      }

      setTiles((prev) => [newTile, ...prev])
      tilesRef.current = [newTile, ...tilesRef.current]
      panToTiles([newTile])
      toast.success("Edit saved to the board")

      if (generationId) {
        void updateGenerationStudioLayout({
          generationId,
          x: placement.x,
          y: placement.y,
          width: size.width,
          height: size.height,
          projectId,
        }).catch((error) => {
          console.error("Failed to attach edited image to studio project", error)
        })
      }

      void updateStudioProjectClient(projectId, {
        thumbnail_url: imageUrl,
      }).catch(() => undefined)
    },
    [panToTiles, projectId],
  )

  const handleRecreateTile = React.useCallback((tile: StudioTile) => {
    if (tile.kind === "video") {
      setStudioMode("video")
      if (tile.prompt?.trim()) {
        setVideoPrompt(tile.prompt)
        setVideoAttachedRefs([])
      }
      const startUrl = tile.referenceImageUrls[0] ?? null
      if (startUrl) {
        setVideoInputImage({ url: startUrl })
      }
      toast.success("Prompt copied to video input")
      return
    }

    setStudioMode("image")
    if (tile.prompt?.trim()) {
      setPrompt(tile.prompt)
      setAttachedCommandRefs([])
    }
    const refUrls =
      tile.referenceImageUrls.length > 0
        ? tile.referenceImageUrls
        : tile.url
          ? [tile.url]
          : []
    setReferenceImages(refUrls.map((url) => ({ url })))
    if (tile.url) {
      setSelectedTileIds([tile.id])
    }
    toast.success("Prompt and references copied to input")
  }, [])

  const handleCopyImage = React.useCallback(async (tile: StudioTile) => {
    if (!tile.url) return
    try {
      const result = await copyMediaToClipboard({ url: tile.url, kind: tile.kind })
      toast.success(
        result === "url"
          ? tile.kind === "video"
            ? "Video URL copied"
            : "Image URL copied"
          : tile.kind === "video"
            ? "Video copied"
            : "Image copied",
      )
    } catch {
      toast.error(tile.kind === "video" ? "Could not copy video" : "Could not copy image")
    }
  }, [])

  const handleCopyPrompt = React.useCallback(async (promptText: string, key: string) => {
    try {
      await navigator.clipboard.writeText(promptText)
      setCopiedPromptKey(key)
      toast.success("Prompt copied")
      window.setTimeout(() => {
        setCopiedPromptKey((current) => (current === key ? null : current))
      }, 1600)
    } catch {
      toast.error("Could not copy prompt")
    }
  }, [])

  const handleDownloadTile = React.useCallback(async (tile: StudioTile) => {
    if (!tile.url) return
    try {
      await downloadMediaFile({
        url: tile.url,
        kind: tile.kind,
        filenamePrefix: tile.kind === "video" ? "studio-video" : "studio-image",
      })
    } catch {
      toast.error(tile.kind === "video" ? "Could not download video" : "Could not download image")
    }
  }, [])

  const handleDeleteTile = React.useCallback(async (tile: StudioTile) => {
    const generationId = tile.generationId ?? (tile.id.includes("-") ? null : tile.id)
    if (!generationId) {
      setTiles((prev) => prev.filter((item) => item.clientKey !== tile.clientKey))
      setSelectedTileIds((ids) => ids.filter((id) => id !== tile.id))
      if (fullscreenTile?.id === tile.id) setFullscreenTile(null)
      return
    }
    try {
      const response = await fetch(`/api/generations/${generationId}`, { method: "DELETE" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to delete image")
      }
      setTiles((prev) => prev.filter((item) => item.id !== tile.id && item.generationId !== generationId))
      setSelectedTileIds((ids) => ids.filter((id) => id !== tile.id))
      if (tile.url) {
        setReferenceImages((current) => current.filter((image) => image.url !== tile.url))
      }
      if (fullscreenTile?.id === tile.id) setFullscreenTile(null)
      toast.success(tile.kind === "video" ? "Video deleted" : "Image deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete")
    }
  }, [fullscreenTile?.id])

  const tileActions = React.useMemo(
    () => ({
      onOpen: handleOpenTile,
      onEdit: handleEditTile,
      onRecreate: handleRecreateTile,
      onCopyImage: handleCopyImage,
      onDownload: handleDownloadTile,
      onDelete: handleDeleteTile,
    }),
    [
      handleCopyImage,
      handleDeleteTile,
      handleDownloadTile,
      handleEditTile,
      handleOpenTile,
      handleRecreateTile,
    ],
  )

  const handleSelectTile = React.useCallback((tile: StudioTile) => {
    const alreadySelected = tileMatchesSelection(tile, selectedTileIds)
    const nextSelected = alreadySelected
      ? selectedTileIds.filter((id) => id !== tile.id && id !== tile.generationId)
      : [...selectedTileIds, tile.id]

    setSelectedTileIds(nextSelected)

    if (tile.status !== "completed" || !tile.url) return

    if (studioMode === "agent") {
      if (alreadySelected) {
        dispatchChatRemoveAsset(tile.url)
      } else {
        dispatchChatAddAsset(tile.url, tile.kind)
      }
      return
    }

    if (studioMode === "video") {
      applyVideoRefsFromTiles([tile], { toggle: true })
      return
    }

    if (tile.kind !== "image") return

    if (selectedStudioTool) {
      if (alreadySelected) return
      setStudioToolSourceImage((source) => {
        if (!source?.url) return { url: tile.url as string }
        setStudioToolSceneImage((scene) => {
          if (!scene?.url) return { url: tile.url as string }
          return scene
        })
        return source
      })
      return
    }

    setReferenceImages((current) => {
      if (alreadySelected) {
        return current.filter((image) => image.url !== tile.url)
      }
      return current.some((image) => image.url === tile.url)
        ? current
        : [...current, { url: tile.url }]
    })
  }, [applyVideoRefsFromTiles, selectedStudioTool, selectedTileIds, studioMode])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (fullscreenTile) {
        setFullscreenTile(null)
        return
      }
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return
      handleDeselect()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [fullscreenTile, handleDeselect])

  const handleMoveEnd = React.useCallback(
    (tile: StudioTile, next: { x: number; y: number }) => {
      setTiles((prev) =>
        prev.map((item) =>
          item.id === tile.id ? { ...item, x: next.x, y: next.y } : item,
        ),
      )
      if (!tile.generationId) return
      void updateGenerationStudioLayout({
        generationId: tile.generationId,
        x: next.x,
        y: next.y,
        width: tile.width,
        height: tile.height,
      }).catch((error) => {
        console.error("Failed to persist tile position", error)
      })
    },
    [],
  )

  const handleNaturalSize = React.useCallback((tile: StudioTile, pixels: { width: number; height: number }) => {
    const next = tileSizeFromPixelRatio(pixels.width / pixels.height)
    if (Math.abs(next.width - tile.width) < 4) return

    setTiles((prev) =>
      prev.map((item) =>
        item.id === tile.id ? { ...item, width: next.width, height: next.height } : item,
      ),
    )
    if (!tile.generationId) return
    void updateGenerationStudioLayout({
      generationId: tile.generationId,
      x: tile.x,
      y: tile.y,
      width: next.width,
      height: next.height,
    }).catch(() => undefined)
  }, [])

  const handleGenerate = React.useCallback(
    async (promptOverride?: string, inputSnapshot?: InfluencerInputSnapshot) => {
      const attachedRefsForRequest = inputSnapshot?.attachedRefs ?? attachedCommandRefs
      const referenceImagesForRequest =
        inputSnapshot?.referenceImages ?? referenceImages

      if (!selectedStudioTool && hasVideoOrAudioAssetRefs(attachedRefsForRequest)) {
        toast.error("Video and audio assets can't be used as references for image generation.")
        return
      }

      const promptForRequest = promptOverride ?? prompt
      const mergedPrompt = buildPromptWithRefs(
        promptForRequest,
        brandRefsOnly(attachedRefsForRequest),
      )
      const chipImageUrls = getImageAssetUrlsFromRefChips(attachedRefsForRequest)

      let studioToolPayload: ReturnType<typeof buildStudioToolGenerationRequest> | null = null
      let resolvedStudioSceneImage = studioToolSceneImage

      if (selectedStudioTool) {
        let resolvedStudioSourceImage = studioToolSourceImage
        try {
          resolvedStudioSourceImage = await resolveReferenceImageForGeneration(studioToolSourceImage)
          resolvedStudioSceneImage = await resolveReferenceImageForGeneration(studioToolSceneImage)
        } catch (resolveError) {
          toast.error(
            resolveError instanceof Error
              ? resolveError.message
              : "Could not prepare reference images",
          )
          return
        }

        const validationError = validateDualReferenceSwapState(selectedStudioTool, {
          sourceImage: resolvedStudioSourceImage,
          sceneImage: resolvedStudioSceneImage,
        })
        if (validationError) {
          toast.error(validationError.message)
          return
        }

        studioToolPayload = buildStudioToolGenerationRequest(selectedStudioTool, {
          sourceImage: resolvedStudioSourceImage,
          sceneImage: resolvedStudioSceneImage,
          additionalInstructions: studioToolAdditionalInstructions,
        })
      } else if (!mergedPrompt.trim() && chipImageUrls.length === 0 && referenceImagesForRequest.length === 0) {
        toast.error("Please enter a prompt")
        return
      }

      const capturedPrompt = studioToolPayload
        ? studioToolPayload.prompt
        : mergedPrompt.trim()
      const capturedModel = studioToolPayload?.model ?? selectedModel
      const capturedTool = studioToolPayload?.tool ?? "image"
      const capturedRefUrls = studioToolPayload
        ? studioToolPayload.referenceImages
            .map((image) => image.url)
            .filter((url): url is string => Boolean(url))
        : ([
            ...referenceImagesForRequest.map((image) => image.url).filter(Boolean),
            ...chipImageUrls,
          ] as string[])
      const capturedAspectRatio = studioToolPayload
        ? studioToolPayload.aspectRatio
        : resolveAspectRatioForRequest({
            model: selectedModelObject,
            selectedAspectRatio,
            hasReferenceImages:
              referenceImagesForRequest.length > 0 || chipImageUrls.length > 0,
          })
      const size = tileSizeForAspectRatio(capturedAspectRatio)
      const numImages = studioToolPayload
        ? Math.max(1, studioToolPayload.numImages)
        : Math.max(1, selectedNumImages)
      const placements = findOpenPlacement({
        existing: tilesRef.current.map((tile) => ({
          x: tile.x,
          y: tile.y,
          width: tile.width,
          height: tile.height,
        })),
        width: size.width,
        height: size.height,
        anchor: selectedTile,
        count: numImages,
      })

      const clientRequestId = createClientRequestId()
      const optimisticTiles: StudioTile[] = placements.map((placement, index) => ({
        id: `${clientRequestId}-${index}`,
        clientKey: `${clientRequestId}-${index}`,
        generationId: null,
        url: null,
        kind: "image",
        status: "pending",
        prompt: capturedPrompt || null,
        model: selectedModel,
        aspectRatio: capturedAspectRatio,
        referenceImageUrls: capturedRefUrls,
        x: placement.x,
        y: placement.y,
        width: size.width,
        height: size.height,
        createdAt: new Date().toISOString(),
      }))

      setTiles((prev) => [...optimisticTiles, ...prev])
      tilesRef.current = [...optimisticTiles, ...tilesRef.current]
      setPendingCount((count) => count + 1)
      panToTiles(optimisticTiles)

      try {
        if (selectedStudioTool?.requiresReferenceAnalysis && studioToolPayload && resolvedStudioSceneImage) {
          const analysisData = new FormData()
          if (resolvedStudioSceneImage.file) {
            analysisData.append("reference", resolvedStudioSceneImage.file)
          } else if (resolvedStudioSceneImage.url) {
            analysisData.append("referenceUrl", resolvedStudioSceneImage.url)
          }

          const analysisResponse = await fetch("/api/image/shot-recreate-analysis", {
            method: "POST",
            body: analysisData,
          })
          const analysisResult = (await analysisResponse.json()) as {
            shotRecipe?: Record<string, string>
            error?: string
          }
          if (!analysisResponse.ok || !analysisResult.shotRecipe) {
            throw new Error(analysisResult.error || "Could not analyze this shot")
          }
          studioToolPayload.prompt =
            `${studioToolPayload.prompt} Structured shot recipe JSON: ` +
            JSON.stringify(analysisResult.shotRecipe)
        }

        const baseRefImages = studioToolPayload
          ? studioToolPayload.referenceImages
          : referenceImagesForRequest
        const manualUrlSet = new Set(
          baseRefImages
            .map((image) => image.url)
            .filter((url): url is string => Boolean(url)),
        )
        const extraFromAssetChips: ImageUpload[] = studioToolPayload
          ? []
          : chipImageUrls
              .filter((url) => !manualUrlSet.has(url))
              .map((url) => ({ url }))
        const imagesToUpload = [...baseRefImages, ...extraFromAssetChips]
        const resolvedRefs = (
          await Promise.all(imagesToUpload.map((image) => resolveReferenceImageForGeneration(image)))
        ).filter((image): image is ImageUpload => image != null)

        const formData = new FormData()
        formData.append("prompt", studioToolPayload ? studioToolPayload.prompt : mergedPrompt)
        formData.append("model", capturedModel)
        formData.append("tool", capturedTool)
        formData.append(
          "enhancePrompt",
          String(studioToolPayload ? studioToolPayload.enhancePrompt : enhancePrompt),
        )
        formData.append("aspectRatio", capturedAspectRatio)
        formData.append("aspect_ratio", capturedAspectRatio)
        formData.append("n", String(numImages))
        if (studioToolPayload?.resolution) {
          formData.set("resolution", studioToolPayload.resolution)
        }
        for (const [key, value] of Object.entries(selectedModelParameters)) {
          if (value == null || value === "") continue
          formData.append(key, String(value))
        }
        appendImageReferencesToFormData(formData, resolvedRefs)
        appendStudioBoardFieldsToFormData(formData, {
          studio_project_id: projectId,
          studio_x: placements[0]?.x ?? 0,
          studio_y: placements[0]?.y ?? 0,
          studio_width: size.width,
          studio_height: size.height,
        })

        const result = await generateImageAndWait(formData, {
          onAccepted: (accepted: GenerateImageAcceptedPayload) => {
            if (!accepted.generationId) return
            setTiles((prev) =>
              prev.map((tile) =>
                tile.clientKey === `${clientRequestId}-0`
                  ? { ...tile, generationId: accepted.generationId ?? null, id: accepted.generationId ?? tile.id }
                  : tile,
              ),
            )
          },
        })

        const resultUrls: string[] = []
        if (Array.isArray(result.images)) {
          for (const image of result.images) {
            if (image?.url) resultUrls.push(image.url)
          }
        } else if (result.image?.url) {
          resultUrls.push(result.image.url)
        }

        setTiles((prev) => {
          const withoutOptimistic = prev.filter(
            (tile) => !tile.clientKey.startsWith(`${clientRequestId}-`),
          )
          const completed = resultUrls.map((url, index) => {
            const placement = placements[index] ?? placements[0]
            return {
              id: `${clientRequestId}-done-${index}`,
              clientKey: `${clientRequestId}-done-${index}`,
              generationId: null,
              url,
              kind: "image" as const,
              status: "completed" as const,
              prompt: (studioToolPayload ? studioToolPayload.prompt : mergedPrompt).trim() || null,
              model: selectedModel,
              aspectRatio: capturedAspectRatio,
              referenceImageUrls: capturedRefUrls,
              x: placement?.x ?? 0,
              y: placement?.y ?? 0,
              width: size.width,
              height: size.height,
              createdAt: new Date().toISOString(),
            }
          })
          return [...completed, ...withoutOptimistic]
        })

        if (resultUrls[0]) {
          void updateStudioProjectClient(projectId, {
            thumbnail_url: resultUrls[0],
          }).catch(() => undefined)
        }

        void fetchProjectTiles()
          .then((serverTiles) => {
            mergeServerTiles(serverTiles)
          })
          .catch(() => undefined)
      } catch (error) {
        setTiles((prev) =>
          prev.map((tile) =>
            tile.clientKey.startsWith(`${clientRequestId}-`)
              ? { ...tile, status: "failed" }
              : tile,
          ),
        )
        const message =
          error instanceof Error ? error.message : "Image generation failed"
        if (isInsufficientCreditsError(error) || isInsufficientCreditsMessage(message)) {
          showCreditsUpsellToast(message)
        } else if (!tryShowContentModerationToast(message)) {
          toast.error(toUserFacingGenerationError(message))
        }
      } finally {
        setPendingCount((count) => Math.max(0, count - 1))
      }
    },
    [
      attachedCommandRefs,
      enhancePrompt,
      fetchProjectTiles,
      mergeServerTiles,
      panToTiles,
      projectId,
      prompt,
      referenceImages,
      selectedAspectRatio,
      selectedModel,
      selectedModelObject,
      selectedModelParameters,
      selectedNumImages,
      selectedStudioTool,
      selectedTile,
      studioToolAdditionalInstructions,
      studioToolSceneImage,
      studioToolSourceImage,
    ],
  )

  const estimatedVideoCredits = React.useMemo(() => {
    if (!selectedVideoModel) return null
    return resolveVideoPricingQuote({
      modelIdentifier: selectedVideoModel.identifier,
      modelCost: selectedVideoModel.model_cost,
      modelCostPerSecond: selectedVideoModel.model_cost_per_second,
      pricingConfig: selectedVideoModel.pricing_config,
      duration: videoParameters.duration as number | string | undefined,
      resolution: typeof videoParameters.resolution === "string" ? videoParameters.resolution : null,
      draft: videoParameters.draft as boolean | undefined,
      mode: typeof videoParameters.mode === "string" ? videoParameters.mode : null,
      generateAudio:
        typeof videoParameters.generate_audio === "boolean"
          ? videoParameters.generate_audio
          : typeof videoParameters.generateAudio === "boolean"
            ? videoParameters.generateAudio
            : null,
      characterOrientation:
        typeof videoParameters.character_orientation === "string"
          ? videoParameters.character_orientation
          : null,
      hasInputVideo: Boolean(videoInputVideo),
      hasReferenceVideo: Boolean(videoInputVideo),
    }).quotedCredits
  }, [selectedVideoModel, videoInputVideo, videoParameters])

  const handleGenerateVideo = React.useCallback(async () => {
    if (!selectedVideoModel) {
      toast.error("Select a video model")
      return
    }

    const refError = validateVideoAttachedRefs(videoAttachedRefs, selectedVideoModel)
    if (refError) {
      toast.error(refError)
      return
    }

    const mergedPrompt = buildPromptWithRefs(videoPrompt, brandRefsOnly(videoAttachedRefs))
    const selectedStartImage = selectedTiles.find((tile) => tile.kind === "image" && tile.url)
    const startImage =
      videoInputImage ??
      (selectedStartImage?.url ? { url: selectedStartImage.url } : null)

    if (!mergedPrompt.trim() && !startImage && !videoInputVideo) {
      toast.error("Please enter a prompt or add a start frame")
      return
    }

    const aspectRatio =
      typeof videoParameters.aspect_ratio === "string"
        ? videoParameters.aspect_ratio
        : typeof videoParameters.aspectRatio === "string"
          ? videoParameters.aspectRatio
          : "16:9"
    const size = tileSizeForAspectRatio(aspectRatio)
    const [placement] = findOpenPlacement({
      existing: tilesRef.current.map((tile) => ({
        x: tile.x,
        y: tile.y,
        width: tile.width,
        height: tile.height,
      })),
      width: size.width,
      height: size.height,
      anchor: selectedTile,
    })
    const clientRequestId = createClientRequestId()
    const optimisticTile: StudioTile = {
      id: clientRequestId,
      clientKey: clientRequestId,
      generationId: null,
      url: null,
      kind: "video",
      status: "pending",
      prompt: mergedPrompt.trim() || null,
      model: selectedVideoModel.identifier,
      aspectRatio,
      referenceImageUrls: startImage?.url ? [startImage.url] : [],
      x: placement?.x ?? 0,
      y: placement?.y ?? 0,
      width: size.width,
      height: size.height,
      createdAt: new Date().toISOString(),
    }

    setTiles((prev) => [optimisticTile, ...prev])
    tilesRef.current = [optimisticTile, ...tilesRef.current]
    setPendingCount((count) => count + 1)
    panToTiles([optimisticTile])

    try {
      const extraRefs = selectedTiles
        .filter(
          (tile) =>
            tile.kind === "image" &&
            tile.url &&
            tile.url !== startImage?.url,
        )
        .map((tile) => ({ url: tile.url as string }))
      const requestBody = await buildStudioVideoGenerationBody({
        modelIdentifier: selectedVideoModel.identifier,
        prompt: mergedPrompt,
        negativePrompt: videoNegativePrompt,
        parameters: videoParameters,
        inputImage: startImage,
        lastFrameImage: videoLastFrameImage,
        inputVideo: videoInputVideo,
        inputAudio: videoInputAudio,
        referenceImages: [...videoReferenceImages, ...extraRefs],
        studio: {
          studio_project_id: projectId,
          studio_x: placement?.x ?? 0,
          studio_y: placement?.y ?? 0,
          studio_width: size.width,
          studio_height: size.height,
        },
      })

      const result = await generateVideoAndWait("/api/generate-video-any-model", requestBody, {
        onAccepted: ({ generationId }) => {
          if (!generationId) return
          setTiles((prev) =>
            prev.map((tile) =>
              tile.clientKey === clientRequestId
                ? { ...tile, generationId, id: generationId }
                : tile,
            ),
          )
        },
      })

      const videoUrl =
        typeof result.video?.url === "string" ? result.video.url : null
      if (videoUrl) {
        setTiles((prev) =>
          prev.map((tile) =>
            tile.clientKey === clientRequestId
              ? { ...tile, url: videoUrl, status: "completed" }
              : tile,
          ),
        )
        void updateStudioProjectClient(projectId, { thumbnail_url: videoUrl }).catch(
          () => undefined,
        )
      }

      void fetchProjectTiles()
        .then((serverTiles) => mergeServerTiles(serverTiles))
        .catch(() => undefined)
    } catch (error) {
      setTiles((prev) =>
        prev.map((tile) =>
          tile.clientKey === clientRequestId ? { ...tile, status: "failed" } : tile,
        ),
      )
      const message = error instanceof Error ? error.message : "Video generation failed"
      if (isInsufficientCreditsError(error) || isInsufficientCreditsMessage(message)) {
        showCreditsUpsellToast(message)
      } else if (!tryShowContentModerationToast(message)) {
        toast.error(toUserFacingGenerationError(message))
      }
    } finally {
      setPendingCount((count) => Math.max(0, count - 1))
    }
  }, [
    fetchProjectTiles,
    mergeServerTiles,
    panToTiles,
    projectId,
    selectedTile,
    selectedTiles,
    selectedVideoModel,
    videoAttachedRefs,
    videoInputAudio,
    videoInputImage,
    videoInputVideo,
    videoLastFrameImage,
    videoNegativePrompt,
    videoParameters,
    videoPrompt,
    videoReferenceImages,
  ])

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadError || !project) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground">{loadError || "Studio project not found"}</p>
        <Button asChild>
          <Link href="/studio">Back to Studio</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-x-0 top-13 z-20 flex items-center gap-3 p-3"
        style={promptPanelStyle}
      >
        <div className="pointer-events-auto flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" className={STUDIO_CHROME} aria-label="Back to Studio">
            <Link href="/studio">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            onBlur={() => void handleRename()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur()
              }
            }}
            aria-label="Project name"
            className={`${STUDIO_CHROME} h-8 w-38 min-w-0 px-3 text-sm shadow-sm sm:w-48 focus-visible:border-border/70 focus-visible:ring-0`}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={STUDIO_CHROME}
                aria-label="Board controls"
              >
                <DotsThree className="size-5" weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-auto min-w-40">
              <DropdownMenuItem onSelect={handleFitAll} disabled={tiles.length === 0}>
                Fit all
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleResetZoom}>100%</DropdownMenuItem>
              <DropdownMenuItem onSelect={handleOrganize} disabled={tiles.length === 0}>
                Organize
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <StudioInfiniteCanvas
        ref={canvasRef}
        viewport={viewport}
        onViewportChange={persistViewport}
        onBackgroundClick={handleDeselect}
        className="absolute inset-0"
      >
        {tiles.map((tile) => (
          <StudioTileCard
            key={tile.clientKey}
            tile={tile}
            selected={tileMatchesSelection(tile, selectedTileIds)}
            selectionIndex={
              tileMatchesSelection(tile, selectedTileIds)
                ? selectedTileIds.findIndex((id) => id === tile.id || id === tile.generationId) + 1
                : null
            }
            zoom={viewport.zoom}
            onSelect={handleSelectTile}
            onMoveEnd={handleMoveEnd}
            onNaturalSize={handleNaturalSize}
            actions={tileActions}
          />
        ))}
      </StudioInfiniteCanvas>

      {tiles.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 top-13 bottom-36 z-10 flex items-center justify-center px-6">
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            Generate images, videos, or use the agent — they land on this board.
            <span className="mt-1 block text-xs">
              Click images to add them as references. Click the canvas to clear.
            </span>
          </p>
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute bottom-0 left-0 z-20 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
        style={promptPanelStyle}
      >
        <div className="pointer-events-auto flex w-full max-w-sm flex-col items-center gap-2 sm:max-w-lg lg:max-w-4xl">
          <HeroToolTabs
            value={studioMode}
            onChange={setStudioMode}
            aria-label="Studio creation tools"
          />
          {studioMode === "agent" ? (
            <p className="rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-center text-xs text-muted-foreground shadow-sm backdrop-blur">
              Click tiles to attach them to the agent. Generations land on this board.
            </p>
          ) : studioMode === "video" ? (
            selectedVideoModel ? (
              <VideoInputBox
                className="w-full"
                videoModels={videoModels}
                promptValue={videoPrompt}
                onPromptChange={setVideoPrompt}
                negativePromptValue={videoNegativePrompt}
                onNegativePromptChange={setVideoNegativePrompt}
                selectedModel={selectedVideoModel}
                onModelChange={setSelectedVideoModel}
                inputImage={videoInputImage}
                onInputImageChange={setVideoInputImage}
                lastFrameImage={videoLastFrameImage}
                onLastFrameChange={setVideoLastFrameImage}
                inputVideo={videoInputVideo}
                onInputVideoChange={setVideoInputVideo}
                inputAudio={videoInputAudio}
                onInputAudioChange={setVideoInputAudio}
                parameters={videoParameters}
                onParametersChange={setVideoParameters}
                estimatedCredits={estimatedVideoCredits}
                isGenerating={pendingCount > 0 || videoModelsLoading}
                activeGenerationCount={pendingCount}
                onGenerate={() => {
                  void handleGenerateVideo()
                }}
                allowConcurrent
                allowOptionsDuringGeneration
                multiShotMode={videoMultiShotMode}
                onMultiShotModeChange={setVideoMultiShotMode}
                multiShotShots={videoMultiShotShots}
                onMultiShotShotsChange={setVideoMultiShotShots}
                referenceImages={videoReferenceImages}
                onReferenceImagesChange={setVideoReferenceImages}
                attachedRefs={videoAttachedRefs}
                onAttachedRefsChange={setVideoAttachedRefs}
              />
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/90 px-4 py-3 text-sm text-muted-foreground shadow-sm backdrop-blur">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading video tools…
              </div>
            )
          ) : selectedStudioTool ? (
            <ImageStudioToolInput
              tool={selectedStudioTool}
              sourceImage={studioToolSourceImage}
              sceneImage={studioToolSceneImage}
              additionalInstructions={studioToolAdditionalInstructions}
              onAdditionalInstructionsChange={setStudioToolAdditionalInstructions}
              onSourceImageChange={setStudioToolSourceImage}
              onSceneImageChange={setStudioToolSceneImage}
              onGenerate={() => {
                void handleGenerate()
              }}
              isGenerating={pendingCount > 0}
              allowConcurrent
              allowOptionsDuringGeneration
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              models={effectiveImageModels}
              showModelSelector
            />
          ) : (
            <InfluencerInputBox
              generateButtonLayout="bar"
              showGenerateInBottomRow
              promptValue={prompt}
              onPromptChange={setPrompt}
              onAttachedRefsChange={setAttachedCommandRefs}
              referenceImages={referenceImages}
              onReferenceImagesChange={setReferenceImages}
              enhancePrompt={enhancePrompt}
              onEnhancePromptChange={setEnhancePrompt}
              isGenerating={pendingCount > 0}
              activeGenerationSlotCount={pendingCount}
              onGenerate={handleGenerate}
              allowConcurrent
              allowOptionsDuringGeneration
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              showModelSelector
              imageModels={effectiveImageModels}
              selectedAspectRatio={selectedAspectRatio}
              onAspectRatioChange={setSelectedAspectRatio}
              showAspectRatioSelector
              selectedNumImages={selectedNumImages}
              onNumImagesChange={setSelectedNumImages}
              showNumImagesSelector
              modelParameters={selectedModelParameters}
              onModelParametersChange={setSelectedModelParameters}
              allowedAssetTypes={["image"]}
            />
          )}
        </div>
      </div>

      <ImageEditorDialog
        open={Boolean(editorTile?.url)}
        onOpenChange={(open) => {
          if (!open) {
            editorTileRef.current = null
            setEditorTile(null)
          }
        }}
        initialImage={editorTile?.url ?? undefined}
        onSave={(imageUrl, details) => {
          void handleSaveEditedImage(imageUrl, details)
        }}
      />

      {fullscreenTile?.url ? (
        <FullscreenMediaViewer
          kind={fullscreenTile.kind}
          url={fullscreenTile.url}
          metadata={{
            id: fullscreenTile.generationId ?? fullscreenTile.id,
            model: fullscreenTile.model,
            prompt: fullscreenTile.prompt,
            tool: fullscreenTile.kind,
            aspectRatio: fullscreenTile.aspectRatio,
            type: fullscreenTile.kind,
            createdAt: fullscreenTile.createdAt,
          }}
          referenceImages={fullscreenTile.referenceImageUrls.map((imageUrl) => ({ imageUrl }))}
          onClose={() => setFullscreenTile(null)}
          actions={(): FullscreenMediaViewerAction[] => {
            const tile = fullscreenTile
            const actions: FullscreenMediaViewerAction[] = []
            if (tile.prompt?.trim()) {
              actions.push({
                id: "copy-prompt",
                label: copiedPromptKey === `${tile.id}-fs-prompt` ? "Prompt Copied" : "Copy Prompt",
                icon: <Copy className="size-4" />,
                onClick: () => {
                  void handleCopyPrompt(tile.prompt ?? "", `${tile.id}-fs-prompt`)
                },
              })
            }
            if (tile.kind === "image") {
              actions.push({
                id: "reference",
                label: "Use as Reference",
                icon: <ImageSquare className="size-4" />,
                onClick: () => {
                  if (tile.url) {
                    setSelectedTileIds((ids) => (ids.includes(tile.id) ? ids : [...ids, tile.id]))
                    if (studioMode === "video") {
                      setVideoInputImage({ url: tile.url })
                    } else if (selectedStudioTool) {
                      setStudioToolSourceImage((source) => {
                        if (!source?.url) return { url: tile.url as string }
                        setStudioToolSceneImage((scene) => scene ?? { url: tile.url as string })
                        return source
                      })
                    } else {
                      setReferenceImages((current) =>
                        current.some((image) => image.url === tile.url)
                          ? current
                          : [...current, { url: tile.url }],
                      )
                    }
                  }
                  setFullscreenTile(null)
                },
              })
              actions.push({
                id: "edit",
                label: "Edit image",
                icon: <PencilSimple className="size-4" />,
                onClick: () => {
                  handleEditTile(tile)
                },
              })
            }
            actions.push({
              id: "recreate",
              label: "Recreate",
              icon: <ArrowsClockwise className="size-4" />,
              onClick: () => {
                handleRecreateTile(tile)
                setFullscreenTile(null)
              },
            })
            actions.push({
              id: "copy",
              label: tile.kind === "video" ? "Copy Video" : "Copy Image",
              icon: <Copy className="size-4" />,
              onClick: () => {
                void handleCopyImage(tile)
              },
            })
            actions.push({
              id: "download",
              label: "Download",
              icon: <DownloadSimple className="size-4" />,
              onClick: () => {
                void handleDownloadTile(tile)
              },
            })
            actions.push({
              id: "delete",
              label: "Delete",
              icon: <Trash className="size-4" />,
              destructive: true,
              onClick: () => {
                void handleDeleteTile(tile)
              },
            })
            return actions
          }}
        />
      ) : null}
    </div>
  )
}
