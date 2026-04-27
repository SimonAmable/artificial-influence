"use client"

import * as React from "react"
import type { Node } from "@xyflow/react"
import {
  ArrowSquareOut,
  CircleNotch,
  DownloadSimple,
  Sparkle,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { executeWorkflow } from "@/lib/canvas/execution"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import type { MiniApp } from "@/lib/mini-apps/types"
import { getMiniAppVisibleNodes } from "@/lib/mini-apps/heuristics"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useLayoutMode } from "@/components/shared/layout/layout-mode-context"
import { GeneratorLayout } from "@/components/shared/layout/generator-layout"
import { ImageGrid, type GridItem } from "@/components/shared/display/image-grid"
import { VideoGrid, type VideoGridItem } from "@/components/shared/display/video-grid"

interface MiniAppRuntimeProps {
  miniApp: MiniApp
}

interface UploadInputValue {
  file: File | null
  previewUrl: string | null
}

function getNodeLabel(node: Node): string {
  const data = (node.data ?? {}) as Record<string, unknown>
  if (typeof data.label === "string" && data.label.trim().length > 0) {
    return data.label.trim()
  }
  return node.type ?? "Node"
}

function getNodeLabelDisplay(node: Node): string {
  return getNodeLabel(node).toUpperCase()
}

function getPromptPlaceholder(node: Node, required: boolean): string {
  const label = getNodeLabelDisplay(node)
  const hint = required ? "REQUIRED" : "OPTIONAL"
  return `${label}, ENTER YOUR INSTRUCTIONS (${hint})`
}

function getUploadButtonText(): string {
  return "UPLOAD FILE"
}

function getUploadButtonDescription(label: string): string {
  return label.replace(/\s+\*$/, "")
}

function getTextNodeValue(node: Node): string {
  const data = (node.data ?? {}) as Record<string, unknown>
  if (typeof data.text === "string") return data.text
  if (typeof data.promptInput === "string") return data.promptInput
  return ""
}

function getNodeOutputType(node: Node): "image" | "video" | "audio" | null {
  const data = (node.data ?? {}) as Record<string, unknown>

  if (node.type === "image-gen") return "image"
  if (node.type === "video-gen") return "video"
  if (node.type === "audio") return "audio"
  if (node.type === "upload" && typeof data.fileType === "string") {
    if (data.fileType === "image" || data.fileType === "video" || data.fileType === "audio") {
      return data.fileType
    }
  }

  return null
}

function getNodeOutputUrl(node: Node): string | null {
  const data = (node.data ?? {}) as Record<string, unknown>

  if (node.type === "image-gen") {
    const generatedImageUrls = Array.isArray(data.generatedImageUrls)
      ? data.generatedImageUrls.filter((value): value is string => typeof value === "string")
      : []
    const activeImageIndex =
      typeof data.activeImageIndex === "number" ? data.activeImageIndex : generatedImageUrls.length - 1
    return (
      generatedImageUrls[activeImageIndex] ??
      (typeof data.generatedImageUrl === "string" ? data.generatedImageUrl : null)
    )
  }

  if (node.type === "video-gen") {
    return typeof data.generatedVideoUrl === "string" ? data.generatedVideoUrl : null
  }

  if (node.type === "audio") {
    return typeof data.generatedAudioUrl === "string" ? data.generatedAudioUrl : null
  }

  if (node.type === "upload") {
    return typeof data.fileUrl === "string" ? data.fileUrl : null
  }

  return null
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)))
}

function getNodeImageOutputUrls(node: Node): string[] {
  const data = (node.data ?? {}) as Record<string, unknown>

  if (node.type === "image-gen") {
    const generatedImageUrls = Array.isArray(data.generatedImageUrls)
      ? data.generatedImageUrls.filter((value): value is string => typeof value === "string" && value.length > 0)
      : []
    const generatedImageUrl =
      typeof data.generatedImageUrl === "string" && data.generatedImageUrl.length > 0
        ? data.generatedImageUrl
        : null

    return dedupeStrings([...generatedImageUrls, ...(generatedImageUrl ? [generatedImageUrl] : [])])
  }

  if (node.type === "upload" && data.fileType === "image" && typeof data.fileUrl === "string") {
    return [data.fileUrl]
  }

  return []
}

function isNodeGenerating(node: Node): boolean {
  return Boolean((node.data as Record<string, unknown> | undefined)?.isGenerating)
}

function getMediaGridPrompt(node: Node): string | null {
  const data = (node.data ?? {}) as Record<string, unknown>
  const promptParts = [data.connectedPrompt, data.prompt, data.text].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  )

  return promptParts.length > 0 ? promptParts.join(" ").trim() : null
}

function getMediaGridModel(node: Node): string | null {
  const model = (node.data as Record<string, unknown> | undefined)?.model
  return typeof model === "string" && model.length > 0 ? model : null
}

function getInitialGridColumnCount(outputCount: number, maxColumns: number): number {
  return Math.min(Math.max(outputCount, 1), maxColumns)
}

function clearCurrentOutputData(node: Node): Node {
  const data = (node.data ?? {}) as Record<string, unknown>
  const nextData: Record<string, unknown> = {
    ...data,
    isGenerating: false,
    error: null,
  }

  if (node.type === "image-gen") {
    nextData.generatedImageUrls = []
    nextData.generatedImageUrl = null
    nextData.activeImageIndex = 0
    nextData.pendingGenerationCount = 0
  }

  if (node.type === "video-gen") {
    nextData.generatedVideoUrl = null
  }

  if (node.type === "audio") {
    nextData.generatedAudioUrl = null
  }

  if (node.type === "upload") {
    nextData.fileUrl = null
    nextData.fileType = null
    nextData.fileName = null
  }

  return { ...node, data: nextData }
}

async function downloadUrl(url: string, fileName: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error("Failed to fetch file")
    const blob = await response.blob()
    const objectUrl = window.URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = objectUrl
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.URL.revokeObjectURL(objectUrl)
  } catch {
    window.open(url, "_blank", "noopener,noreferrer")
  }
}

function MiniAppShowcaseCard({
  miniApp,
}: {
  miniApp: MiniApp
}) {
  return (
    <div className="h-[50vh] md:h-[60vh] pt-0 px-4 flex flex-col gap-3">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold leading-tight">
          {miniApp.name}
        </h1>
        {miniApp.description ? (
          <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto">
            {miniApp.description}
          </p>
        ) : null}
      </div>

      <div className="flex-1 flex items-center justify-center px-4 min-h-0">
        <div className="w-full h-full max-w-4xl">
          {miniApp.thumbnail_url ? (
            <img
              src={miniApp.thumbnail_url}
              alt={miniApp.name}
              className="w-full h-full object-contain rounded-lg"
            />
          ) : (
            <div className="w-full h-full rounded-lg border border-white/10 bg-zinc-950/50 flex items-center justify-center">
              <p className="text-sm text-zinc-500">No showcase thumbnail yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MiniAppUploadField({
  label,
  value,
  onChange,
  className,
}: {
  label: string
  value: UploadInputValue
  onChange: (nextValue: UploadInputValue) => void
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Button variant="outline" className="h-auto min-h-0 w-full py-2.5" asChild>
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*,video/*,audio/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              if (!file) return
              onChange({
                file,
                previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
              })
            }}
          />
          {value.previewUrl ? (
            <div className="flex w-full items-center gap-2.5">
              <img
                src={value.previewUrl}
                alt=""
                className="size-11 shrink-0 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-xs font-medium text-foreground">{value.file?.name}</p>
                <p className="text-[10px] text-muted-foreground">Tap to replace</p>
              </div>
            </div>
          ) : value.file ? (
            <div className="flex w-full items-center gap-2.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-medium text-muted-foreground uppercase">
                File
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-xs font-medium text-foreground">{value.file.name}</p>
                <p className="text-[10px] text-muted-foreground">Tap to replace</p>
              </div>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-0.5 text-center">
              <span className="text-xs font-medium tracking-[0.12em] uppercase">
                {getUploadButtonText()}
              </span>
              <span className="text-xs font-normal tracking-[0.16em] text-muted-foreground uppercase">
                {getUploadButtonDescription(label)}
              </span>
            </div>
          )}
        </label>
      </Button>
    </div>
  )
}

function MiniAppOutputCard({
  node,
  featured = false,
}: {
  node: Node
  featured?: boolean
}) {
  const url = getNodeOutputUrl(node)
  const type = getNodeOutputType(node)
  const label = getNodeLabel(node)

  return (
    <Card
      className={cn(
        "overflow-hidden border-white/10 bg-zinc-950/60",
        featured ? "min-h-[420px]" : "min-h-[180px]"
      )}
    >
      <CardContent className="flex h-full flex-col p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-100">{label}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{type ?? "output"}</p>
          </div>
          {url ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
              >
                <ArrowSquareOut className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => downloadUrl(url, `${label.replace(/\s+/g, "-").toLowerCase()}.png`)}
              >
                <DownloadSimple className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-black/30 p-3">
          {!url ? (
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-200">No output yet</p>
              <p className="mt-1 text-xs text-zinc-500">Run the mini app to generate this slot.</p>
            </div>
          ) : type === "image" ? (
            <img
              src={url}
              alt={label}
              className="max-h-full w-full rounded-xl object-contain"
            />
          ) : type === "video" ? (
            <video
              src={url}
              controls
              className="max-h-full w-full rounded-xl"
            />
          ) : type === "audio" ? (
            <audio src={url} controls className="w-full" />
          ) : (
            <a href={url} target="_blank" rel="noreferrer" className="text-sm text-zinc-200 underline">
              Open output
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function MiniAppInputPanel({
  nodeConfig,
  visibleInputs,
  textInputs,
  setTextInputs,
  uploadInputs,
  setUploadInputs,
  isRunning,
  onGenerate,
  isRowLayout,
}: {
  nodeConfig: MiniApp["node_config"]
  visibleInputs: Node[]
  textInputs: Record<string, string>
  setTextInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>
  uploadInputs: Record<string, UploadInputValue>
  setUploadInputs: React.Dispatch<React.SetStateAction<Record<string, UploadInputValue>>>
  isRunning: boolean
  onGenerate: () => void
  isRowLayout: boolean
}) {
  const textInputNodes = visibleInputs.filter((node) => node.type === "text")
  const mediaInputNodes = visibleInputs.filter((node) => node.type === "upload")

  return (
    <Card className="border-white/10 bg-zinc-950/70 w-full max-w-sm sm:max-w-lg lg:max-w-4xl">
      <CardContent className="p-5">
        <div className="space-y-3">
          {textInputNodes.length > 0 ? (
            <div className="space-y-2">
              {textInputNodes.map((node) => {
                const config = nodeConfig[node.id]
                return (
                  <div key={node.id} className="grid gap-0">
                    <Textarea
                      id={`mini-app-input-${node.id}`}
                      rows={3}
                      value={textInputs[node.id] ?? ""}
                      onChange={(event) =>
                        setTextInputs((current) => ({
                          ...current,
                          [node.id]: event.target.value,
                        }))
                      }
                      placeholder={getPromptPlaceholder(node, Boolean(config?.required))}
                      className="min-h-[84px]"
                    />
                  </div>
                )
              })}
            </div>
          ) : null}

          {mediaInputNodes.length > 0 ? (
            <div
              className={cn(
                "gap-2.5",
                isRowLayout
                  ? "flex flex-wrap items-start"
                  : "space-y-3"
              )}
            >
              {mediaInputNodes.map((node) => {
                const config = nodeConfig[node.id]
                const labelDisplay = getNodeLabelDisplay(node)

                return (
                  <MiniAppUploadField
                    key={node.id}
                    label={`${labelDisplay}${config?.required ? " *" : ""}`}
                    value={uploadInputs[node.id] ?? { file: null, previewUrl: null }}
                    className={cn(isRowLayout ? "min-w-[220px] flex-1 basis-[240px]" : "w-full")}
                    onChange={(nextValue) =>
                      setUploadInputs((current) => {
                        const previousPreviewUrl = current[node.id]?.previewUrl
                        if (previousPreviewUrl && previousPreviewUrl !== nextValue.previewUrl) {
                          URL.revokeObjectURL(previousPreviewUrl)
                        }
                        return {
                          ...current,
                          [node.id]: nextValue,
                        }
                      })
                    }
                  />
                )
              })}
            </div>
          ) : null}

          {visibleInputs
            .filter((node) => node.type !== "text" && node.type !== "upload")
            .map((node) => {
            const labelDisplay = getNodeLabelDisplay(node)
            return (
              <div key={node.id} className="grid gap-2">
                <Label className="text-sm text-zinc-200">{labelDisplay}</Label>
                <Input value="Unsupported input type" disabled />
              </div>
            )
          })}
        </div>

        <Button className="mt-5 w-full" onClick={onGenerate} disabled={isRunning}>
          {isRunning ? (
            <CircleNotch className="mr-2 h-4 w-4 animate-spin" weight="bold" />
          ) : (
            <Sparkle className="mr-2 h-4 w-4" weight="fill" />
          )}
          {isRunning ? "Generating..." : "Generate"}
        </Button>
      </CardContent>
    </Card>
  )
}

export function MiniAppRuntime({ miniApp }: MiniAppRuntimeProps) {
  const layoutModeContext = useLayoutMode()

  if (!layoutModeContext) {
    throw new Error("MiniAppRuntime must be used within LayoutModeProvider")
  }

  const { layoutMode } = layoutModeContext
  const isRowLayout = layoutMode === "row"

  const [nodes, setNodes] = React.useState<Node[]>(miniApp.snapshot_nodes)
  const [isRunning, setIsRunning] = React.useState(false)
  const [hasRun, setHasRun] = React.useState(false)
  const [textInputs, setTextInputs] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      miniApp.snapshot_nodes
        .filter(
          (node) =>
            miniApp.node_config[node.id]?.show_in_mini_app &&
            miniApp.node_config[node.id]?.role === "input" &&
            node.type === "text"
        )
        .map((node) => [node.id, getTextNodeValue(node)])
    )
  )
  const [uploadInputs, setUploadInputs] = React.useState<Record<string, UploadInputValue>>({})

  React.useEffect(() => {
    return () => {
      Object.values(uploadInputs).forEach((value) => {
        if (value.previewUrl) URL.revokeObjectURL(value.previewUrl)
      })
    }
  }, [uploadInputs])

  const visibleInputs = React.useMemo(
    () => getMiniAppVisibleNodes(nodes, miniApp.node_config, "input"),
    [miniApp.node_config, nodes]
  )
  const visibleOutputs = React.useMemo(
    () => getMiniAppVisibleNodes(nodes, miniApp.node_config, "output"),
    [miniApp.node_config, nodes]
  )

  const hasAnyRenderedOutput = hasRun && visibleOutputs.some((node) => getNodeOutputUrl(node))
  const imageOutputs = React.useMemo(
    () => visibleOutputs.filter((node) => getNodeOutputType(node) === "image"),
    [visibleOutputs]
  )
  const videoOutputs = React.useMemo(
    () => visibleOutputs.filter((node) => getNodeOutputType(node) === "video"),
    [visibleOutputs]
  )
  const otherOutputs = React.useMemo(
    () =>
      visibleOutputs.filter((node) => {
        const type = getNodeOutputType(node)
        return type !== "image" && type !== "video"
      }),
    [visibleOutputs]
  )

  const imageGridItems = React.useMemo((): GridItem[] => {
    const generating: GridItem[] = imageOutputs
      .filter((node) => isRunning || isNodeGenerating(node))
      .map((node) => ({ type: "generating", id: `mini-app-image-generating-${node.id}` }))
    const completed: GridItem[] = hasRun
      ? imageOutputs.flatMap((node) =>
          getNodeImageOutputUrls(node).map((url, index) => ({
            type: "image" as const,
            data: {
              id: `${node.id}-${index}`,
              url,
              model: getMediaGridModel(node),
              prompt: getMediaGridPrompt(node),
              tool: "mini-app",
              type: "image",
            },
          }))
        )
      : []

    return [...generating, ...completed]
  }, [hasRun, imageOutputs, isRunning])

  const videoGridItems = React.useMemo((): VideoGridItem[] => {
    const generating: VideoGridItem[] = videoOutputs
      .filter((node) => isRunning || isNodeGenerating(node))
      .map((node) => ({ type: "generating", id: `mini-app-video-generating-${node.id}` }))
    const completed: VideoGridItem[] = hasRun
      ? videoOutputs.flatMap((node) => {
          const url = getNodeOutputUrl(node)
          if (!url) return []

          return [
            {
              type: "video" as const,
              data: {
                id: node.id,
                url,
                model: getMediaGridModel(node),
                prompt: getMediaGridPrompt(node),
                tool: "mini-app",
              },
            },
          ]
        })
      : []

    return [...generating, ...completed]
  }, [hasRun, isRunning, videoOutputs])

  const handleGenerate = async () => {
    try {
      setIsRunning(true)
      setHasRun(true)
      setNodes((current) =>
        current.map((node) => {
          const config = miniApp.node_config[node.id]
          return config?.show_in_mini_app && config.role === "output"
            ? clearCurrentOutputData(node)
            : node
        })
      )

      const nextNodes = await Promise.all(
        miniApp.snapshot_nodes.map(async (node) => {
          const config = miniApp.node_config[node.id]
          if (config?.show_in_mini_app && config.role === "output") {
            return clearCurrentOutputData(node)
          }

          if (!config?.show_in_mini_app || !config.user_can_edit || config.role !== "input") {
            return node
          }

          if (node.type === "text") {
            return {
              ...node,
              data: {
                ...node.data,
                text: textInputs[node.id] ?? "",
              },
            }
          }

          if (node.type === "upload") {
            const inputValue = uploadInputs[node.id]
            if (!inputValue?.file) {
              if (config.required) {
                throw new Error(`${getNodeLabel(node)} is required`)
              }
              return {
                ...node,
                data: {
                  ...node.data,
                  fileUrl: null,
                  fileType: null,
                  fileName: null,
                },
              }
            }

            const uploaded = await uploadFileToSupabase(inputValue.file, "mini-app-inputs")
            if (!uploaded) {
              throw new Error(`Failed to upload ${getNodeLabel(node)}`)
            }

            return {
              ...node,
              data: {
                ...node.data,
                fileUrl: uploaded.url,
                fileType: uploaded.fileType === "other" ? null : uploaded.fileType,
                fileName: uploaded.fileName,
              },
            }
          }

          return node
        })
      )

      setNodes(nextNodes)

      const executionNodes = nextNodes.filter((node) => node.type !== "group")
      const executionNodeIds = new Set(executionNodes.map((node) => node.id))
      const executionEdges = miniApp.snapshot_edges.filter(
        (edge) => executionNodeIds.has(edge.source) && executionNodeIds.has(edge.target)
      )
      const inputEdges = miniApp.snapshot_edges.filter((edge) => executionNodeIds.has(edge.target))

      await executeWorkflow(
        executionNodes,
        executionEdges,
        {
          onNodeStart: (nodeId) => {
            setNodes((current) =>
              current.map((node) =>
                node.id === nodeId
                  ? { ...node, data: { ...node.data, isGenerating: true, error: null } }
                  : node
              )
            )
          },
          onNodeComplete: (nodeId, output) => {
            setNodes((current) =>
              current.map((node) => {
                if (node.id !== nodeId) return node

                const nextData: Record<string, unknown> = {
                  ...(node.data as Record<string, unknown>),
                  isGenerating: false,
                  error: null,
                }

                if (typeof output.text === "string") nextData.text = output.text
                const outputImageUrls = dedupeStrings([
                  ...(Array.isArray(output.imageUrls)
                    ? output.imageUrls.filter((value): value is string => typeof value === "string")
                    : []),
                  ...(typeof output.imageUrl === "string" ? [output.imageUrl] : []),
                ])
                if (outputImageUrls.length > 0) {
                  nextData.generatedImageUrls = outputImageUrls
                  nextData.activeImageIndex = 0
                  nextData.generatedImageUrl = outputImageUrls[0] ?? null
                }
                if (typeof output.videoUrl === "string") nextData.generatedVideoUrl = output.videoUrl
                if (typeof output.audioUrl === "string") nextData.generatedAudioUrl = output.audioUrl

                return {
                  ...node,
                  data: nextData,
                }
              })
            )
          },
          onNodeError: (nodeId, error) => {
            setNodes((current) =>
              current.map((node) =>
                node.id === nodeId
                  ? { ...node, data: { ...node.data, isGenerating: false, error } }
                  : node
              )
            )
          },
        },
        {
          inputEdges,
          fallbackNodes: nextNodes,
        }
      )

      toast.success("Mini app run complete")
    } catch (error) {
      console.error("Mini app execution error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to run mini app")
    } finally {
      setIsRunning(false)
    }
  }

  const inputBox = (
    <MiniAppInputPanel
      nodeConfig={miniApp.node_config}
      visibleInputs={visibleInputs}
      textInputs={textInputs}
      setTextInputs={setTextInputs}
      uploadInputs={uploadInputs}
      setUploadInputs={setUploadInputs}
      isRunning={isRunning}
      onGenerate={handleGenerate}
      isRowLayout={isRowLayout}
    />
  )

  const renderShowcase = () => {
    const hasMediaGridItems = imageGridItems.length > 0 || videoGridItems.length > 0

    if (!hasAnyRenderedOutput && !isRunning && !hasMediaGridItems) {
      return <MiniAppShowcaseCard miniApp={miniApp} />
    }

    return (
      <div className="flex h-full min-h-0 w-full flex-col gap-5 px-2 sm:px-0">
        {imageGridItems.length > 0 ? (
          <div className={cn("min-h-0 w-full", videoGridItems.length > 0 || otherOutputs.length > 0 ? "min-h-[420px] flex-1" : "h-full")}>
            <ImageGrid
              items={imageGridItems}
              basicActionsOnly
              initialColumnCount={getInitialGridColumnCount(imageOutputs.length, 6)}
            />
          </div>
        ) : null}

        {videoGridItems.length > 0 ? (
          <div className={cn("min-h-0 w-full", imageGridItems.length > 0 || otherOutputs.length > 0 ? "min-h-[420px] flex-1" : "h-full")}>
            <VideoGrid
              items={videoGridItems}
              showNativeControlsOnHoverOnly
              initialColumnCount={getInitialGridColumnCount(videoOutputs.length, 4)}
            />
          </div>
        ) : null}

        {otherOutputs.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {otherOutputs.map((node) => (
              <MiniAppOutputCard key={node.id} node={node} />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn("min-h-screen bg-background flex flex-col", isRowLayout ? "p-0" : "p-4 sm:p-6 md:p-12")}>
      <div className={cn("mx-auto flex-1 flex flex-col", isRowLayout ? "w-full pt-10" : "max-w-7xl pt-12")}>
        <GeneratorLayout layoutMode={layoutMode} className="h-full flex-1 min-h-0">
          {isRowLayout ? (
            <>
              <div className="flex-1 w-full h-full overflow-auto pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {renderShowcase()}
              </div>
              <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
                <div className="max-w-7xl mx-auto flex justify-center">{inputBox}</div>
              </div>
            </>
          ) : (
            <>
              <div className="w-full flex-1 min-h-0 lg:pb-0">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 sm:gap-6 lg:gap-12 h-full">
                  <div className="hidden lg:block lg:sticky lg:top-0 h-fit">
                    <div className="flex justify-center">{inputBox}</div>
                  </div>
                  <div className="w-full h-full overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {renderShowcase()}
                  </div>
                </div>
              </div>
              <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 lg:hidden">
                <div className="max-w-7xl mx-auto flex justify-center">{inputBox}</div>
              </div>
            </>
          )}
        </GeneratorLayout>
      </div>
    </div>
  )
}
