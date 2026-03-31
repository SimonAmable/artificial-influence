"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Player, type PlayerRef } from "@remotion/player"
import { Loader2, Pause, Play, Plus, Scissors, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { EditorComposition } from "@/components/editor/editor-composition"
import {
  addAssetToProject,
  addTextOverlay,
  findItemById,
  moveTimelineItem,
  removeTimelineItem,
  setTimelineItemSpeed,
  splitTimelineItem,
  updateTimelineItem,
} from "@/lib/editor/commands"
import {
  createEditorRenderJobClient,
  fetchEditorProject,
  updateEditorProjectClient,
} from "@/lib/editor/database"
import {
  dispatchEditorRuntimeContext,
  EDITOR_PROJECT_SYNC_EVENT,
} from "@/lib/editor/runtime"
import type { EditorProject, TimelineItemType } from "@/lib/editor/types"
import { formatFramesToDuration, roundFrame } from "@/lib/editor/utils"

interface AssetCandidate {
  id: string
  type: "video" | "image" | "audio"
  title: string
  url: string
  source: "asset" | "generation"
}

type InteractionMode = "move" | "trim-start" | "trim-end"

interface TimelineInteraction {
  itemId: string
  mode: InteractionMode
  startX: number
  baseProject: EditorProject
}

const TRACK_COLORS: Record<string, string> = {
  overlay: "from-sky-500/70 to-cyan-400/70",
  video: "from-emerald-500/70 to-lime-400/70",
  audio: "from-amber-500/70 to-orange-400/70",
}

async function getMediaDurationInFrames(
  url: string,
  type: TimelineItemType,
  fps: number,
): Promise<number> {
  if (type === "image" || type === "text") {
    return 150
  }

  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(150)
      return
    }

    const element = document.createElement(type === "audio" ? "audio" : "video")
    element.preload = "metadata"
    element.onloadedmetadata = () => {
      const nextDuration = Math.max(1, Math.round(element.duration * fps))
      resolve(Number.isFinite(nextDuration) ? nextDuration : 150)
    }
    element.onerror = () => resolve(150)
    element.src = url
  })
}

function getAppendFrame(project: EditorProject): number {
  const end = project.timeline_state.tracks
    .flatMap((track) => track.items)
    .reduce((max, item) => {
      return Math.max(max, item.startFrame + item.durationInFrames)
    }, 0)

  return Math.max(0, end)
}

export function ProjectEditor({ projectId }: { projectId: string }) {
  const router = useRouter()
  const playerRef = React.useRef<PlayerRef>(null)
  const [project, setProject] = React.useState<EditorProject | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null)
  const [playheadFrame, setPlayheadFrame] = React.useState(0)
  const [zoom, setZoom] = React.useState(3)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [assetUrl, setAssetUrl] = React.useState("")
  const [assetType, setAssetType] = React.useState<"video" | "image" | "audio">("video")
  const [assetLibrary, setAssetLibrary] = React.useState<AssetCandidate[]>([])
  const [renderMessage, setRenderMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [historyPast, setHistoryPast] = React.useState<EditorProject[]>([])
  const [historyFuture, setHistoryFuture] = React.useState<EditorProject[]>([])
  const interactionRef = React.useRef<TimelineInteraction | null>(null)
  const saveSnapshotRef = React.useRef<string | null>(null)
  const saveTimeoutRef = React.useRef<number | null>(null)
  const deferredProject = React.useDeferredValue(project)

  const syncProjectFromServer = React.useCallback(async () => {
    const refreshed = await fetchEditorProject(projectId)
    setProject(refreshed)
    saveSnapshotRef.current = JSON.stringify({
      name: refreshed.name,
      description: refreshed.description,
      composition_settings: refreshed.composition_settings,
      timeline_state: refreshed.timeline_state,
      thumbnail_url: refreshed.thumbnail_url,
    })
  }, [projectId])

  React.useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)

        const [nextProject, assetsResponse, generationsResponse] = await Promise.all([
          fetchEditorProject(projectId),
          fetch("/api/assets?limit=12"),
          fetch("/api/generations?limit=12"),
        ])

        setProject(nextProject)
        saveSnapshotRef.current = JSON.stringify({
          name: nextProject.name,
          description: nextProject.description,
          composition_settings: nextProject.composition_settings,
          timeline_state: nextProject.timeline_state,
          thumbnail_url: nextProject.thumbnail_url,
        })

        const library: AssetCandidate[] = []

        if (assetsResponse.ok) {
          const assetJson = await assetsResponse.json()
          for (const asset of assetJson.assets ?? []) {
            library.push({
              id: asset.id,
              title: asset.title,
              type: asset.assetType,
              url: asset.url,
              source: "asset",
            })
          }
        }

        if (generationsResponse.ok) {
          const generationJson = await generationsResponse.json()
          for (const generation of generationJson.generations ?? []) {
            if (!generation.url || !generation.type) continue
            library.push({
              id: generation.id,
              title: generation.prompt || generation.model || generation.type,
              type: generation.type,
              url: generation.url,
              source: "generation",
            })
          }
        }

        setAssetLibrary(library)
      } catch (loadError) {
        console.error("Failed to load editor project:", loadError)
        setError("Failed to load editor project")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [projectId])

  React.useEffect(() => {
    const handleProjectSync = (event: Event) => {
      const customEvent = event as CustomEvent<string>
      if (customEvent.detail !== projectId) return

      void syncProjectFromServer().catch((syncError) => {
        console.error("Failed to sync project after agent update:", syncError)
      })
    }

    window.addEventListener(EDITOR_PROJECT_SYNC_EVENT, handleProjectSync as EventListener)
    return () => {
      window.removeEventListener(EDITOR_PROJECT_SYNC_EVENT, handleProjectSync as EventListener)
    }
  }, [projectId, syncProjectFromServer])

  React.useEffect(() => {
    if (!project) return

    dispatchEditorRuntimeContext({
      projectId: project.id,
      selectionItemIds: selectedItemId ? [selectedItemId] : [],
      playheadFrame,
      activeRoute: "editor",
    })

    return () => {
      dispatchEditorRuntimeContext({
        projectId: null,
        selectionItemIds: [],
        playheadFrame: 0,
        activeRoute: "other",
      })
    }
  }, [project, selectedItemId, playheadFrame])

  React.useEffect(() => {
    if (!project) return
    const serialized = JSON.stringify({
      name: project.name,
      description: project.description,
      composition_settings: project.composition_settings,
      timeline_state: project.timeline_state,
      thumbnail_url: project.thumbnail_url,
    })

    if (serialized === saveSnapshotRef.current) {
      return
    }

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        setSaving(true)
        const saved = await updateEditorProjectClient(project.id, {
          name: project.name,
          description: project.description,
          thumbnail_url: project.thumbnail_url,
          composition_settings: project.composition_settings,
          timeline_state: project.timeline_state,
        })
        saveSnapshotRef.current = JSON.stringify({
          name: saved.name,
          description: saved.description,
          composition_settings: saved.composition_settings,
          timeline_state: saved.timeline_state,
          thumbnail_url: saved.thumbnail_url,
        })
      } catch (saveError) {
        console.error("Failed to autosave project:", saveError)
      } finally {
        setSaving(false)
      }
    }, 900)

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [project])

  React.useEffect(() => {
    if (!isPlaying) return

    const id = window.setInterval(() => {
      const frame = playerRef.current?.getCurrentFrame() ?? 0
      setPlayheadFrame(frame)
      if (playerRef.current && !playerRef.current.isPlaying()) {
        setIsPlaying(false)
      }
    }, 80)

    return () => window.clearInterval(id)
  }, [isPlaying])

  React.useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const interaction = interactionRef.current
      if (!interaction) return

      const currentProject = interaction.baseProject
      const found = findItemById(currentProject.timeline_state, interaction.itemId)
      if (!found) return

      const pixelsPerFrame = zoom
      const deltaFrames = Math.round((event.clientX - interaction.startX) / pixelsPerFrame)
      const baseItem = found.item
      let nextProject = structuredClone(currentProject)

      try {
        if (interaction.mode === "move") {
          nextProject = moveTimelineItem(
            currentProject,
            baseItem.id,
            Math.max(0, baseItem.startFrame + deltaFrames),
          )
        } else if (interaction.mode === "trim-start") {
          const nextStart = Math.max(0, baseItem.startFrame + deltaFrames)
          const appliedDelta = nextStart - baseItem.startFrame
          const nextDuration = Math.max(1, baseItem.durationInFrames - appliedDelta)
          nextProject = updateTimelineItem(currentProject, baseItem.id, {
            startFrame: nextStart,
            durationInFrames: nextDuration,
            trimStartInFrames:
              baseItem.type === "audio" || baseItem.type === "video"
                ? baseItem.trimStartInFrames +
                  Math.round(appliedDelta * baseItem.playbackRate)
                : baseItem.trimStartInFrames,
          })
        } else if (interaction.mode === "trim-end") {
          const nextDuration = Math.max(1, baseItem.durationInFrames + deltaFrames)
          nextProject = updateTimelineItem(currentProject, baseItem.id, {
            durationInFrames: nextDuration,
            trimEndInFrames:
              baseItem.type === "audio" || baseItem.type === "video"
                ? baseItem.trimStartInFrames +
                  Math.round(nextDuration * baseItem.playbackRate)
                : baseItem.trimEndInFrames + deltaFrames,
          })
        }

        setProject(nextProject)
      } catch {
        // Ignore invalid drag states.
      }
    }

    const handleMouseUp = () => {
      const interaction = interactionRef.current
      if (!interaction) return
      setHistoryPast((prev) => [...prev.slice(-29), interaction.baseProject])
      setHistoryFuture([])
      interactionRef.current = null
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [zoom])

  const applyProjectChange = React.useCallback(
    (nextProject: EditorProject, pushHistory = true) => {
      if (!project) return
      if (pushHistory) {
        setHistoryPast((prev) => [...prev.slice(-29), project])
        setHistoryFuture([])
      }
      setProject(nextProject)
    },
    [project],
  )

  const handleUndo = React.useCallback(() => {
    const previous = historyPast[historyPast.length - 1]
    if (!previous || !project) return

    setHistoryPast((prev) => prev.slice(0, -1))
    setHistoryFuture((prev) => [project, ...prev].slice(0, 30))
    setProject(previous)
  }, [historyPast, project])

  const handleRedo = React.useCallback(() => {
    const next = historyFuture[0]
    if (!next || !project) return

    setHistoryFuture((prev) => prev.slice(1))
    setHistoryPast((prev) => [...prev, project].slice(-30))
    setProject(next)
  }, [historyFuture, project])

  const selectedItem = React.useMemo(() => {
    if (!project || !selectedItemId) return null
    return findItemById(project.timeline_state, selectedItemId)?.item ?? null
  }, [project, selectedItemId])

  const handleAddText = React.useCallback(() => {
    if (!project) return
    const next = addTextOverlay(project, "New title", getAppendFrame(project))
    applyProjectChange(next)
  }, [applyProjectChange, project])

  const handleAddFromUrl = React.useCallback(async () => {
    if (!project || !assetUrl.trim()) return

    const durationInFrames = await getMediaDurationInFrames(
      assetUrl,
      assetType,
      project.composition_settings.fps,
    )

    const next = addAssetToProject(project, {
      type: assetType,
      src: assetUrl.trim(),
      label: assetUrl.split("/").pop() || `${assetType} clip`,
      durationInFrames,
      startFrame: getAppendFrame(project),
    })
    applyProjectChange(next)
    setAssetUrl("")
  }, [applyProjectChange, assetType, assetUrl, project])

  const handleAddLibraryItem = React.useCallback(
    async (item: AssetCandidate) => {
      if (!project) return
      const durationInFrames = await getMediaDurationInFrames(
        item.url,
        item.type,
        project.composition_settings.fps,
      )

      const next = addAssetToProject(project, {
        type: item.type,
        src: item.url,
        label: item.title,
        durationInFrames,
        startFrame: getAppendFrame(project),
      })
      applyProjectChange(next)
    },
    [applyProjectChange, project],
  )

  const handleSplit = React.useCallback(() => {
    if (!project || !selectedItem) return
    try {
      const next = splitTimelineItem(project, selectedItem.id, playheadFrame)
      applyProjectChange(next)
    } catch (splitError) {
      console.error(splitError)
    }
  }, [applyProjectChange, playheadFrame, project, selectedItem])

  const handleDelete = React.useCallback(() => {
    if (!project || !selectedItem) return
    const next = removeTimelineItem(project, selectedItem.id)
    setSelectedItemId(null)
    applyProjectChange(next)
  }, [applyProjectChange, project, selectedItem])

  const handleExport = React.useCallback(async () => {
    if (!project) return
    try {
      const job = await createEditorRenderJobClient(project.id)
      setRenderMessage(job.error_message || `Render status: ${job.status}`)
      await syncProjectFromServer()
    } catch (renderError) {
      console.error(renderError)
      setRenderMessage("Failed to create render job")
    }
  }, [project, syncProjectFromServer])

  const startTimelineInteraction = React.useCallback(
    (event: React.MouseEvent, itemId: string, mode: InteractionMode) => {
      if (!project) return
      event.stopPropagation()
      setSelectedItemId(itemId)
      interactionRef.current = {
        itemId,
        mode,
        startX: event.clientX,
        baseProject: structuredClone(project),
      }
    },
    [project],
  )

  const seekToFrame = React.useCallback((frame: number) => {
    const nextFrame = Math.max(0, frame)
    playerRef.current?.seekTo(nextFrame)
    setPlayheadFrame(nextFrame)
  }, [])

  const handleTogglePlayback = React.useCallback(() => {
    if (!playerRef.current) return

    if (playerRef.current.isPlaying()) {
      playerRef.current.pause()
      setIsPlaying(false)
      return
    }

    playerRef.current.play()
    setIsPlaying(true)
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!project || error) {
    return (
      <div className="flex h-screen items-center justify-center px-6 text-center">
        <div className="space-y-4">
          <p className="text-lg font-semibold">{error ?? "Project not found"}</p>
          <Button onClick={() => router.push("/editor")}>Back to projects</Button>
        </div>
      </div>
    )
  }

  const pixelsPerFrame = zoom

  return (
    <div className="flex h-screen flex-col bg-background pt-[60px]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/editor">Projects</Link>
          </Button>
          <Input
            value={project.name}
            onChange={(event) =>
              setProject((current) =>
                current ? { ...current, name: event.target.value } : current,
              )
            }
            className="w-[240px]"
          />
          <span className="text-xs text-muted-foreground">
            {saving ? "Autosaving..." : "Saved"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleUndo} disabled={historyPast.length === 0}>
            Undo
          </Button>
          <Button variant="outline" onClick={handleRedo} disabled={historyFuture.length === 0}>
            Redo
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/agent-chat?projectId=${project.id}`}>
              <Sparkles className="mr-2 h-4 w-4" />
              Agent Chat
            </Link>
          </Button>
          <Button onClick={handleExport}>Export</Button>
        </div>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <aside className="overflow-y-auto border-r border-border bg-muted/20 p-4">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Media Bin</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="asset-url">Add media by URL</Label>
                  <Input
                    id="asset-url"
                    value={assetUrl}
                    onChange={(event) => setAssetUrl(event.target.value)}
                    placeholder="https://..."
                  />
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {(["video", "image", "audio"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAssetType(value)}
                        className={cn(
                          "rounded-md border px-2 py-2 capitalize transition-colors",
                          assetType === value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border",
                        )}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  <Button onClick={handleAddFromUrl} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add to timeline
                  </Button>
                </div>
                <Separator />
                <Button variant="outline" className="w-full" onClick={handleAddText}>
                  Add Text Overlay
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Assets and Generations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {assetLibrary.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No media found yet. Add a URL or generate something first.
                  </p>
                ) : (
                  assetLibrary.map((item) => (
                    <button
                      key={`${item.source}-${item.id}`}
                      type="button"
                      onClick={() => handleAddLibraryItem(item)}
                      className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="truncate font-medium">{item.title}</p>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            {item.type} from {item.source}
                          </p>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col overflow-hidden">
          <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr_auto] gap-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {project.composition_settings.width}x{project.composition_settings.height} at{" "}
                {project.composition_settings.fps}fps
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handleTogglePlayback}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {formatFramesToDuration(
                    playheadFrame,
                    project.composition_settings.fps,
                  )}{" "}
                  /{" "}
                  {formatFramesToDuration(
                    project.composition_settings.durationInFrames,
                    project.composition_settings.fps,
                  )}
                </span>
                <Label htmlFor="zoom" className="text-xs text-muted-foreground">
                  Zoom
                </Label>
                <input
                  id="zoom"
                  type="range"
                  min={2}
                  max={10}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
              </div>
            </div>

            <div className="min-h-0 overflow-hidden rounded-2xl border border-border bg-black/90 p-4">
              {deferredProject ? (
                <Player
                  ref={playerRef}
                  component={EditorComposition}
                  inputProps={{ project: deferredProject }}
                  durationInFrames={deferredProject.composition_settings.durationInFrames}
                  compositionWidth={deferredProject.composition_settings.width}
                  compositionHeight={deferredProject.composition_settings.height}
                  fps={deferredProject.composition_settings.fps}
                  style={{ width: "100%", height: "100%" }}
                  clickToPlay={false}
                  showVolumeControls
                  controls={false}
                  initialFrame={playheadFrame}
                  acknowledgeRemotionLicense
                />
              ) : null}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Timeline</h3>
                  <p className="text-xs text-muted-foreground">
                    Drag clips, trim from the handles, and click the ruler to seek.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSplit}
                    disabled={!selectedItemId}
                  >
                    <Scissors className="mr-2 h-4 w-4" />
                    Split at playhead
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDelete}
                    disabled={!selectedItemId}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div
                  className="relative min-w-full"
                  style={{
                    width:
                      project.composition_settings.durationInFrames * pixelsPerFrame + 120,
                  }}
                >
                  <div
                    className="relative mb-2 h-8 cursor-pointer border-b border-border"
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect()
                      const frame = roundFrame((event.clientX - rect.left) / pixelsPerFrame)
                      seekToFrame(frame)
                    }}
                  >
                    {Array.from({
                      length:
                        Math.ceil(project.composition_settings.durationInFrames / 30) + 1,
                    }).map((_, index) => {
                      const left = index * 30 * pixelsPerFrame
                      return (
                        <div
                          key={index}
                          className="absolute inset-y-0 border-l border-border/70"
                          style={{ left }}
                        >
                          <span className="absolute left-1 top-1 text-[10px] text-muted-foreground">
                            {index}s
                          </span>
                        </div>
                      )
                    })}
                    <div
                      className="absolute inset-y-0 z-20 w-0.5 bg-primary"
                      style={{ left: playheadFrame * pixelsPerFrame }}
                    />
                  </div>

                  <div className="space-y-3">
                    {project.timeline_state.tracks.map((track) => (
                      <div key={track.id} className="grid grid-cols-[96px_1fr] gap-3">
                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm font-medium">
                          {track.name}
                        </div>
                        <div className="relative h-16 rounded-lg border border-border bg-muted/10">
                          <div
                            className="absolute inset-y-0 z-20 w-0.5 bg-primary/70"
                            style={{ left: playheadFrame * pixelsPerFrame }}
                          />
                          {track.items.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSelectedItemId(item.id)}
                              onMouseDown={(event) =>
                                startTimelineInteraction(event, item.id, "move")
                              }
                              className={cn(
                                "absolute top-2 h-12 overflow-hidden rounded-lg border text-left text-xs text-white shadow-sm",
                                "bg-gradient-to-r px-3 py-2",
                                TRACK_COLORS[track.type],
                                selectedItemId === item.id
                                  ? "border-white"
                                  : "border-white/20",
                              )}
                              style={{
                                left: item.startFrame * pixelsPerFrame,
                                width: Math.max(32, item.durationInFrames * pixelsPerFrame),
                              }}
                            >
                              <span
                                className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-black/20"
                                onMouseDown={(event) =>
                                  startTimelineInteraction(event, item.id, "trim-start")
                                }
                              />
                              <span
                                className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-black/20"
                                onMouseDown={(event) =>
                                  startTimelineInteraction(event, item.id, "trim-end")
                                }
                              />
                              <div className="truncate font-medium">{item.label}</div>
                              <div className="text-[10px] text-white/80">
                                {formatFramesToDuration(
                                  item.durationInFrames,
                                  project.composition_settings.fps,
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <aside className="overflow-y-auto border-l border-border bg-muted/20 p-4">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Inspector</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selectedItem ? (
                  <p className="text-sm text-muted-foreground">
                    Select a clip to edit timing, placement, and media settings.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={selectedItem.label}
                        onChange={(event) =>
                          applyProjectChange(
                            updateTimelineItem(project, selectedItem.id, {
                              label: event.target.value,
                            }),
                          )
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Start frame</Label>
                        <Input
                          type="number"
                          value={selectedItem.startFrame}
                          onChange={(event) =>
                            applyProjectChange(
                              updateTimelineItem(project, selectedItem.id, {
                                startFrame: Number(event.target.value),
                              }),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Duration</Label>
                        <Input
                          type="number"
                          value={selectedItem.durationInFrames}
                          onChange={(event) =>
                            applyProjectChange(
                              updateTimelineItem(project, selectedItem.id, {
                                durationInFrames: Number(event.target.value),
                              }),
                            )
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Playback speed</Label>
                      <Input
                        type="number"
                        min={0.25}
                        max={4}
                        step={0.05}
                        value={selectedItem.playbackRate}
                        onChange={(event) =>
                          applyProjectChange(
                            setTimelineItemSpeed(
                              project,
                              selectedItem.id,
                              Number(event.target.value),
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Volume</Label>
                      <Input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={selectedItem.volume}
                        onChange={(event) =>
                          applyProjectChange(
                            updateTimelineItem(project, selectedItem.id, {
                              volume: Number(event.target.value),
                              muted: Number(event.target.value) <= 0,
                            }),
                          )
                        }
                      />
                    </div>

                    {selectedItem.type !== "audio" ? (
                      <>
                        <Separator />
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>X</Label>
                            <Input
                              type="number"
                              value={selectedItem.placement.x}
                              onChange={(event) =>
                                applyProjectChange(
                                  updateTimelineItem(project, selectedItem.id, {
                                    placement: {
                                      ...selectedItem.placement,
                                      x: Number(event.target.value),
                                    },
                                  }),
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Y</Label>
                            <Input
                              type="number"
                              value={selectedItem.placement.y}
                              onChange={(event) =>
                                applyProjectChange(
                                  updateTimelineItem(project, selectedItem.id, {
                                    placement: {
                                      ...selectedItem.placement,
                                      y: Number(event.target.value),
                                    },
                                  }),
                                )
                              }
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Width</Label>
                            <Input
                              type="number"
                              value={selectedItem.placement.width}
                              onChange={(event) =>
                                applyProjectChange(
                                  updateTimelineItem(project, selectedItem.id, {
                                    placement: {
                                      ...selectedItem.placement,
                                      width: Number(event.target.value),
                                    },
                                  }),
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Height</Label>
                            <Input
                              type="number"
                              value={selectedItem.placement.height}
                              onChange={(event) =>
                                applyProjectChange(
                                  updateTimelineItem(project, selectedItem.id, {
                                    placement: {
                                      ...selectedItem.placement,
                                      height: Number(event.target.value),
                                    },
                                  }),
                                )
                              }
                            />
                          </div>
                        </div>
                      </>
                    ) : null}

                    {selectedItem.type === "text" ? (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <Label>Text</Label>
                          <Textarea
                            value={selectedItem.text}
                            onChange={(event) =>
                              applyProjectChange(
                                updateTimelineItem(project, selectedItem.id, {
                                  text: event.target.value,
                                  label: event.target.value.slice(0, 40) || "Text",
                                }),
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Font size</Label>
                          <Input
                            type="number"
                            value={selectedItem.style.fontSize}
                            onChange={(event) =>
                              applyProjectChange(
                                updateTimelineItem(project, selectedItem.id, {
                                  style: {
                                    ...selectedItem.style,
                                    fontSize: Number(event.target.value),
                                  },
                                }),
                              )
                            }
                          />
                        </div>
                      </>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Project Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={project.description ?? ""}
                  onChange={(event) =>
                    setProject((current) =>
                      current
                        ? {
                            ...current,
                            description: event.target.value,
                          }
                        : current,
                    )
                  }
                  placeholder="Campaign brief, shot notes, export direction..."
                />
                {renderMessage ? (
                  <p className="text-sm text-muted-foreground">{renderMessage}</p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  )
}
