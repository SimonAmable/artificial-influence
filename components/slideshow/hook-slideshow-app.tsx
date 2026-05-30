"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toBlob } from "html-to-image"
import {
  ArrowLeft,
  ArrowRight,
  ArrowsHorizontal,
  CheckCircle,
  Images,
  InstagramLogo,
  Plus,
  Sparkle,
  Trash,
  TiktokLogo,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { AssetRecord } from "@/lib/assets/types"
import type { BrandKit } from "@/lib/brand-kit/types"
import { uploadBlobToSupabase, uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import type {
  SlideshowCollection,
  SlideshowHookOption,
  SlideshowImportCandidate,
  SlideshowProject,
  SlideshowSlide,
} from "@/lib/slideshow/types"
import { cn } from "@/lib/utils"

type SocialProvider = "instagram" | "tiktok"

type SocialConnectionItem = {
  id: string
  provider: SocialProvider
  username: string | null
  displayName: string | null
  status: string
  instagramConnectionId: string | null
  instagramUsername: string | null
}

type SocialConnectionsStatus = {
  providers?: {
    instagram?: {
      connected: boolean
      connections: SocialConnectionItem[]
    }
    tiktok?: {
      connected: boolean
      connections: SocialConnectionItem[]
    }
  }
  instagram?: {
    connected: boolean
    connections: SocialConnectionItem[]
  }
  tiktok?: {
    connected: boolean
    connections: SocialConnectionItem[]
  }
}

type Stage = "setup" | "hooks" | "editor"

type HookGenerationResponse = {
  hookOptions: SlideshowHookOption[]
  project: SlideshowProject
}

type SlideGenerationResponse = {
  slides: SlideshowSlide[]
  project: SlideshowProject
}

function providerLabel(provider: SocialProvider) {
  return provider === "instagram" ? "Instagram" : "TikTok"
}

function providerIcon(provider: SocialProvider) {
  return provider === "instagram" ? (
    <InstagramLogo className="h-5 w-5" weight="fill" />
  ) : (
    <TiktokLogo className="h-5 w-5" weight="fill" />
  )
}

function previewAccountLabel(connection: SocialConnectionItem) {
  return connection.provider === "instagram"
    ? connection.instagramUsername
      ? `@${connection.instagramUsername}`
      : connection.displayName || "Instagram account"
    : connection.displayName || connection.username || "TikTok account"
}

function splitOverlayLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function reorder<T>(items: T[], index: number, direction: -1 | 1) {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= items.length) {
    return items
  }

  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(targetIndex, 0, item)
  return next
}

function formatCollectionCount(collections: SlideshowCollection[]) {
  const readyCollections = collections.filter((collection) => collection.items.length > 0).length
  if (collections.length === 0) return "No collections yet"
  if (readyCollections === 0) return `${collections.length} collections, 0 ready`
  return `${readyCollections} ready collections`
}

function inferStage(project: SlideshowProject | null): Stage {
  if (project?.slides.length) return "editor"
  if (project?.hookOptions.length) return "hooks"
  return "setup"
}

const shellClass = "bg-background text-foreground"
const panelClass = "rounded-[32px] border border-border/60 bg-card/80 shadow-sm backdrop-blur"
const nestedPanelClass = "rounded-[28px] border border-border/60 bg-muted/20"
const subPanelClass = "rounded-2xl border border-border/60 bg-background/70"
const emptyStateClass = "rounded-2xl border border-dashed border-border/60 bg-muted/20 text-muted-foreground"
const outlineButtonClass = "border-border/60 bg-background/40 text-foreground hover:bg-muted/60"
const primaryButtonClass = "bg-primary text-primary-foreground hover:bg-primary/90"
const selectedCardClass = "border-primary/60 bg-primary/10"
const idleCardClass = "border-border/60 bg-background/50 hover:border-foreground/20 hover:bg-muted/30"
const subtleLabelClass = "text-xs uppercase tracking-[0.2em] text-muted-foreground"
const subtleTextClass = "text-muted-foreground"

function formatAssetTitle(fileName: string) {
  const stripped = fileName.replace(/\.[^/.]+$/, "")
  const normalized = stripped.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim()
  return normalized || "Slideshow image"
}

function replaceCollection(
  collections: SlideshowCollection[],
  nextCollection: SlideshowCollection,
) {
  return collections.map((collection) =>
    collection.id === nextCollection.id ? nextCollection : collection,
  )
}

function slideUsesCollectionItem(slide: SlideshowSlide | null, item: SlideshowCollection["items"][number]) {
  if (!slide) return false
  return slide.collectionImageId === item.id || slide.collectionImageId === item.sourceAssetId
}

function CollectionManagerDialog({
  open,
  onOpenChange,
  collections,
  availableAssets,
  loadingAssets,
  uploadingAssets,
  onRefreshAssets,
  onCreateCollection,
  onUpdateCollection,
  onDeleteCollection,
  onAddAssetCopiesToCollection,
  onUploadAssetsToCollection,
  onPreviewPinterestImport,
  onCommitPinterestImport,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  collections: SlideshowCollection[]
  availableAssets: AssetRecord[]
  loadingAssets: boolean
  uploadingAssets: boolean
  onRefreshAssets: (options?: { silent?: boolean }) => Promise<void>
  onCreateCollection: (payload: { name: string; description?: string | null }) => Promise<void>
  onUpdateCollection: (
    collectionId: string,
    payload: { name?: string; description?: string | null; itemIds?: string[] },
  ) => Promise<void>
  onDeleteCollection: (collectionId: string) => Promise<void>
  onAddAssetCopiesToCollection: (collectionId: string, assetIds: string[]) => Promise<void>
  onUploadAssetsToCollection: (collectionId: string, files: File[]) => Promise<void>
  onPreviewPinterestImport: (payload: {
    collectionId: string
    mode: "board_url" | "search"
    query: string
    limit: number
  }) => Promise<{ jobId: string; candidates: SlideshowImportCandidate[] }>
  onCommitPinterestImport: (payload: {
    collectionId: string
    jobId: string
    candidateIds: string[]
  }) => Promise<{ importedCount: number }>
}) {
  const [activeCollectionId, setActiveCollectionId] = React.useState<string | null>(collections[0]?.id ?? null)
  const [newCollectionName, setNewCollectionName] = React.useState("")
  const [newCollectionDescription, setNewCollectionDescription] = React.useState("")
  const [draftName, setDraftName] = React.useState("")
  const [draftDescription, setDraftDescription] = React.useState("")
  const [busyCollectionId, setBusyCollectionId] = React.useState<string | null>(null)
  const [importOpen, setImportOpen] = React.useState(false)
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null)

  const activeCollection =
    collections.find((collection) => collection.id === activeCollectionId) ?? collections[0] ?? null

  React.useEffect(() => {
    if (!activeCollectionId && collections[0]) {
      setActiveCollectionId(collections[0].id)
    } else if (
      activeCollectionId &&
      collections.length > 0 &&
      !collections.some((collection) => collection.id === activeCollectionId)
    ) {
      setActiveCollectionId(collections[0].id)
    }
  }, [activeCollectionId, collections])

  React.useEffect(() => {
    if (!activeCollection) {
      setDraftName("")
      setDraftDescription("")
      return
    }
    setDraftName(activeCollection.name)
    setDraftDescription(activeCollection.description ?? "")
  }, [activeCollection])

  React.useEffect(() => {
    if (!open) return
    void onRefreshAssets({ silent: true })
  }, [onRefreshAssets, open])

  async function saveCollectionMeta() {
    if (!activeCollection || !draftName.trim()) return
    setBusyCollectionId(activeCollection.id)
    try {
      await onUpdateCollection(activeCollection.id, {
        name: draftName.trim(),
        description: draftDescription.trim() || null,
      })
      toast.success("Collection updated.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update collection.")
    } finally {
      setBusyCollectionId(null)
    }
  }

  async function addAssetToCollection(assetId: string) {
    if (!activeCollection) return
    const alreadyIncluded = activeCollection.items.some((item) => item.sourceAssetId === assetId)
    if (alreadyIncluded) return
    setBusyCollectionId(activeCollection.id)
    try {
      await onAddAssetCopiesToCollection(activeCollection.id, [assetId])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update collection.")
    } finally {
      setBusyCollectionId(null)
    }
  }

  async function removeAssetFromCollection(itemId: string) {
    if (!activeCollection) return
    setBusyCollectionId(activeCollection.id)
    try {
      await onUpdateCollection(activeCollection.id, {
        itemIds: activeCollection.items.filter((item) => item.id !== itemId).map((item) => item.id),
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update collection.")
    } finally {
      setBusyCollectionId(null)
    }
  }

  async function moveCollectionItem(index: number, direction: -1 | 1) {
    if (!activeCollection) return
    const reordered = reorder(activeCollection.items, index, direction)
    setBusyCollectionId(activeCollection.id)
    try {
      await onUpdateCollection(activeCollection.id, {
        itemIds: reordered.map((item) => item.id),
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reorder collection.")
    } finally {
      setBusyCollectionId(null)
    }
  }

  async function handleCreate() {
    if (!newCollectionName.trim()) {
      toast.error("Give the collection a name first.")
      return
    }
    try {
      await onCreateCollection({
        name: newCollectionName.trim(),
        description: newCollectionDescription.trim() || null,
      })
      setNewCollectionName("")
      setNewCollectionDescription("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create collection.")
    }
  }

  async function handleDelete() {
    if (!activeCollection) return
    const confirmed = window.confirm(`Delete "${activeCollection.name}"?`)
    if (!confirmed) return
    setBusyCollectionId(activeCollection.id)
    try {
      await onDeleteCollection(activeCollection.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete collection.")
    } finally {
      setBusyCollectionId(null)
    }
  }

  async function handleUploadChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!activeCollection) return
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"))
    event.target.value = ""
    if (files.length === 0) {
      toast.error("Choose one or more image files to upload.")
      return
    }

    try {
      await onUploadAssetsToCollection(activeCollection.id, files)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload collection images.")
    }
  }

  const unusedAssets = availableAssets.filter(
    (asset) => asset.assetType === "image" && !activeCollection?.items.some((item) => item.sourceAssetId === asset.id),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[94vh] !w-[calc(100vw-1rem)] !max-w-none overflow-hidden border-border/60 bg-background p-0 text-foreground sm:!w-[calc(100vw-2rem)] sm:!max-w-none xl:!w-[min(1760px,calc(100vw-2rem))]">
        <DialogHeader className="border-b border-border/60 px-4 py-4 text-left sm:px-6 sm:py-5">
          <DialogTitle className="text-xl font-semibold">Manage Image Collections</DialogTitle>
          <DialogDescription className={subtleTextClass}>
            Group saved image assets by aesthetic so AI can pick stronger slideshow backgrounds.
          </DialogDescription>
        </DialogHeader>

        <div className="grid h-[calc(94vh-80px)] min-h-0 grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr]">
          <div className="min-h-0 border-b border-border/60 bg-muted/20 p-4 lg:border-b-0 lg:border-r">
            <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-3">
              <Label className={subtleLabelClass}>New collection</Label>
              <Input
                value={newCollectionName}
                onChange={(event) => setNewCollectionName(event.target.value)}
                placeholder="Minimalist workspaces"
                className="border-border/60 bg-background"
              />
              <Textarea
                value={newCollectionDescription}
                onChange={(event) => setNewCollectionDescription(event.target.value)}
                placeholder="Muted office scenes, clean desks, airy interiors."
                className="min-h-[96px] border-border/60 bg-background"
              />
              <Button onClick={() => void handleCreate()} className={cn("w-full", primaryButtonClass)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Collection
              </Button>
            </div>

            <ScrollArea className="mt-4 h-[240px] lg:h-[calc(100%-220px)]">
              <div className="space-y-2 pr-3">
                {collections.map((collection) => {
                  const active = collection.id === activeCollectionId
                  return (
                    <button
                      key={collection.id}
                      type="button"
                      onClick={() => setActiveCollectionId(collection.id)}
                      className={cn(
                        "w-full rounded-2xl border px-3 py-3 text-left transition",
                        active ? selectedCardClass : idleCardClass,
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{collection.name}</p>
                          <p className={cn("mt-1 text-xs", subtleTextClass)}>
                            {collection.items.length} image{collection.items.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        {active ? <CheckCircle className="h-5 w-5 shrink-0 text-primary" weight="fill" /> : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          <div className="flex min-h-0 flex-col">
            {activeCollection ? (
              <>
                <div className="border-b border-border/60 px-4 py-4 sm:px-6">
                  <div className="grid gap-3 xl:grid-cols-[1fr_1fr_auto_auto]">
                    <Input
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      placeholder="Collection name"
                      className="border-border/60 bg-background"
                    />
                    <Input
                      value={draftDescription}
                      onChange={(event) => setDraftDescription(event.target.value)}
                      placeholder="Short description for AI"
                      className="border-border/60 bg-background"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busyCollectionId === activeCollection.id}
                      onClick={() => void saveCollectionMeta()}
                      className={outlineButtonClass}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busyCollectionId === activeCollection.id}
                      onClick={() => void handleDelete()}
                      className="border-red-500/25 bg-transparent text-red-200 hover:bg-red-500/10"
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[1.1fr_1fr]">
                  <div className="min-h-0 border-b border-border/60 px-4 py-5 sm:px-6 xl:border-b-0 xl:border-r">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Collection images</p>
                        <p className={cn("text-xs", subtleTextClass)}>Order matters when AI needs a fallback pick.</p>
                      </div>
                    </div>
                    <ScrollArea className="h-[calc(100%-44px)]">
                        {activeCollection.items.length === 0 ? (
                          <div className={cn(emptyStateClass, "p-8 text-center text-sm")}>
                           Add uploaded images, copy from your asset library, or import from Pinterest.
                          </div>
                        ) : (
                        <div className="grid grid-cols-2 gap-4 pr-4 sm:grid-cols-3 2xl:grid-cols-4">
                          {activeCollection.items.map((item, index) => (
                            <div key={item.id} className={cn(subPanelClass, "p-3")}>
                              <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={item.thumbnailUrl || item.url} alt="" className="h-full w-full object-cover" />
                              </div>
                              <p className="mt-2 truncate text-xs font-medium">{item.title}</p>
                              <div className="mt-3 flex items-center justify-between gap-2">
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    disabled={index === 0 || busyCollectionId === activeCollection.id}
                                    onClick={() => void moveCollectionItem(index, -1)}
                                    className={cn("h-8 w-8", outlineButtonClass)}
                                  >
                                    <ArrowLeft className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    disabled={index === activeCollection.items.length - 1 || busyCollectionId === activeCollection.id}
                                    onClick={() => void moveCollectionItem(index, 1)}
                                    className={cn("h-8 w-8", outlineButtonClass)}
                                  >
                                    <ArrowRight className="h-4 w-4" />
                                  </Button>
                                </div>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  disabled={busyCollectionId === activeCollection.id}
                                  onClick={() => void removeAssetFromCollection(item.id)}
                                  className={cn("h-8 w-8", outlineButtonClass)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  <div className="min-h-0 px-4 py-5 sm:px-6">
                    <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <p className="text-sm font-medium">Available image assets</p>
                        <p className={cn("text-xs", subtleTextClass)}>
                          Upload files, click any asset below to copy it into this collection, or import from Pinterest.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <input
                          ref={uploadInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(event) => void handleUploadChange(event)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!activeCollection || uploadingAssets}
                          onClick={() => uploadInputRef.current?.click()}
                          className={outlineButtonClass}
                        >
                          {uploadingAssets ? "Uploading..." : "Upload Images"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!activeCollection}
                          onClick={() => setImportOpen(true)}
                          className={outlineButtonClass}
                        >
                          + Add
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void onRefreshAssets()}
                          className={outlineButtonClass}
                        >
                          Refresh
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="h-[calc(100%-44px)]">
                      {loadingAssets ? (
                        <div className={cn(emptyStateClass, "p-8 text-center text-sm")}>
                          Loading image assets...
                        </div>
                      ) : unusedAssets.length === 0 ? (
                        <div className={cn(emptyStateClass, "p-8 text-center text-sm")}>
                          No unused private image assets are available yet. Add assets in{" "}
                          <Link href="/assets" className="text-primary underline">
                            Asset Library
                          </Link>
                          .
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 pr-4 sm:grid-cols-3 2xl:grid-cols-4">
                          {unusedAssets.map((asset) => (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => void addAssetToCollection(asset.id)}
                              className={cn(subPanelClass, "p-3 text-left transition hover:border-primary/50 hover:bg-muted/50")}
                            >
                              <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={asset.thumbnailUrl || asset.url}
                                  alt={asset.title}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <p className="mt-2 truncate text-xs font-medium">{asset.title}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">{asset.tags.slice(0, 3).join(" / ")}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                Create your first collection to start grouping slideshow backgrounds.
              </div>
            )}
          </div>
        </div>
        <CollectionImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          collections={collections}
          initialCollectionId={activeCollection?.id ?? null}
          onPreview={onPreviewPinterestImport}
          onCommit={onCommitPinterestImport}
        />
      </DialogContent>
    </Dialog>
  )
}

function CollectionImportDialog({
  open,
  onOpenChange,
  collections,
  initialCollectionId,
  onPreview,
  onCommit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  collections: SlideshowCollection[]
  initialCollectionId: string | null
  onPreview: (payload: {
    collectionId: string
    mode: "board_url" | "search"
    query: string
    limit: number
  }) => Promise<{ jobId: string; candidates: SlideshowImportCandidate[] }>
  onCommit: (payload: {
    collectionId: string
    jobId: string
    candidateIds: string[]
  }) => Promise<{ importedCount: number }>
}) {
  const [mode, setMode] = React.useState<"board_url" | "search">("board_url")
  const [query, setQuery] = React.useState("")
  const [targetCollectionId, setTargetCollectionId] = React.useState<string | null>(initialCollectionId)
  const [jobId, setJobId] = React.useState<string | null>(null)
  const [candidates, setCandidates] = React.useState<SlideshowImportCandidate[]>([])
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [step, setStep] = React.useState<"input" | "loading" | "review" | "committing">("input")

  React.useEffect(() => {
    if (!open) {
      setMode("board_url")
      setQuery("")
      setJobId(null)
      setCandidates([])
      setSelectedIds([])
      setStep("input")
      return
    }
    setTargetCollectionId(initialCollectionId)
  }, [initialCollectionId, open])

  async function handlePreview() {
    if (!targetCollectionId) {
      toast.error("Pick a collection first.")
      return
    }
    if (!query.trim()) {
      toast.error(mode === "board_url" ? "Paste a Pinterest board URL first." : "Enter a Pinterest search first.")
      return
    }

    setStep("loading")
    try {
      const result = await onPreview({
        collectionId: targetCollectionId,
        mode,
        query: query.trim(),
        limit: 50,
      })
      setJobId(result.jobId)
      setCandidates(result.candidates)
      setSelectedIds(result.candidates.map((candidate) => candidate.id))
      setStep("review")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load Pinterest images.")
      setStep("input")
    }
  }

  async function handleCommit() {
    if (!targetCollectionId || !jobId) return
    if (selectedIds.length === 0) {
      toast.error("Choose at least one image to import.")
      return
    }

    setStep("committing")
    try {
      await onCommit({
        collectionId: targetCollectionId,
        jobId,
        candidateIds: selectedIds,
      })
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import Pinterest images.")
      setStep("review")
    }
  }

  function toggleCandidate(candidateId: string) {
    setSelectedIds((current) =>
      current.includes(candidateId)
        ? current.filter((id) => id !== candidateId)
        : [...current, candidateId],
    )
  }

  const primaryActionLabel =
    step === "loading"
      ? "Finding images..."
      : step === "committing"
        ? "Adding images..."
        : step === "review"
          ? `Add ${selectedIds.length} image${selectedIds.length === 1 ? "" : "s"}`
          : mode === "board_url"
            ? "Import Board"
            : "Search Pinterest"

  const primaryActionDisabled =
    step === "loading" ||
    step === "committing" ||
    !targetCollectionId ||
    (step === "review" ? selectedIds.length === 0 : !query.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[88vh] !w-[calc(100vw-1rem)] !max-w-none overflow-hidden border-border/60 bg-background p-0 text-foreground sm:!w-[calc(100vw-2.5rem)] sm:!max-w-none xl:!w-[min(1560px,calc(100vw-3rem))]">
        <DialogHeader className="border-b border-border/60 px-4 py-4 text-left sm:px-6 sm:py-5">
          <DialogTitle className="text-xl font-semibold">Import Pinterest Images</DialogTitle>
          <DialogDescription className={subtleTextClass}>
            Search Pinterest or paste a board URL, review the results, then add the images you want.
          </DialogDescription>
        </DialogHeader>

        <div className="flex h-[calc(88vh-88px)] min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden px-4 py-5 sm:px-6">
            <div className="flex h-full min-h-0 flex-col space-y-4">
              <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <Label className={subtleLabelClass}>Add To Collection</Label>
                <Select
                  value={targetCollectionId ?? ""}
                  onValueChange={(value) => setTargetCollectionId(value || null)}
                >
                  <SelectTrigger className="h-10 w-full rounded-md border-border/60 bg-background">
                    <SelectValue placeholder="Select a collection" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {collections.map((collection) => (
                      <SelectItem key={collection.id} value={collection.id}>
                        {collection.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {step === "input" || step === "loading" ? (
                <div className="space-y-4 rounded-2xl border border-border/60 bg-card/70 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setMode("board_url")}
                      className={cn(mode === "board_url" ? selectedCardClass : outlineButtonClass)}
                    >
                      Board URL
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setMode("search")}
                      className={cn(mode === "search" ? selectedCardClass : outlineButtonClass)}
                    >
                      Search
                    </Button>
                  </div>

                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={
                      mode === "board_url"
                        ? "https://www.pinterest.com/username/board-name/"
                        : "indie sleaze night out"
                    }
                    className="border-border/60 bg-background"
                  />
                </div>
              ) : null}

              {step === "review" || step === "committing" ? (
                <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        Selected {selectedIds.length} of {candidates.length} images
                      </p>
                      <p className={cn("text-xs", subtleTextClass)}>
                        Review the Pinterest results and keep only the images you want in this collection.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSelectedIds(candidates.map((candidate) => candidate.id))}
                        className={outlineButtonClass}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSelectedIds([])}
                        className={outlineButtonClass}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-border/60 bg-card/50">
                    <div className="grid grid-cols-2 gap-4 p-4 pr-5 md:grid-cols-3 xl:grid-cols-5">
                      {candidates.map((candidate) => {
                        const selected = selectedIds.includes(candidate.id)
                        return (
                          <button
                            key={candidate.id}
                            type="button"
                            onClick={() => toggleCandidate(candidate.id)}
                            className={cn(
                              "rounded-2xl border p-3 text-left transition",
                              selected ? selectedCardClass : idleCardClass,
                            )}
                          >
                            <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={candidate.previewUrl}
                                alt={candidate.title ?? "Pinterest candidate"}
                                className="h-full w-full object-cover"
                              />
                              {selected ? (
                                <CheckCircle className="absolute right-2 top-2 h-5 w-5 text-primary" weight="fill" />
                              ) : null}
                            </div>
                            <p className="mt-2 line-clamp-2 text-xs font-medium">
                              {candidate.title || "Pinterest image"}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </div>
              ) : null}
            </div>
          </div>
          <div className="border-t border-border/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
            <div className="flex flex-wrap justify-end gap-2 pr-[max(0.25rem,env(safe-area-inset-right))] sm:pr-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className={cn("max-sm:flex-1", outlineButtonClass)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={primaryActionDisabled}
                onClick={() => {
                  if (step === "review" || step === "committing") {
                    void handleCommit()
                    return
                  }
                  void handlePreview()
                }}
                className={cn("max-sm:flex-1", primaryButtonClass)}
              >
                {primaryActionLabel}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function BackgroundPickerDialog({
  open,
  onOpenChange,
  slide,
  collections,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  slide: SlideshowSlide | null
  collections: SlideshowCollection[]
  onSelect: (collection: SlideshowCollection, collectionImageId: string) => Promise<void>
}) {
  const usableCollections = collections.filter((collection) => collection.items.length > 0)
  const [activeCollectionId, setActiveCollectionId] = React.useState<string | null>(slide?.collectionId ?? usableCollections[0]?.id ?? null)
  const [search, setSearch] = React.useState("")
  const [busyImageId, setBusyImageId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setSearch("")
    setActiveCollectionId(slide?.collectionId ?? usableCollections[0]?.id ?? null)
  }, [open, slide, usableCollections])

  const activeCollection =
    usableCollections.find((collection) => collection.id === activeCollectionId) ?? usableCollections[0] ?? null

  const filteredItems = activeCollection
    ? activeCollection.items.filter((item) => {
        const q = search.trim().toLowerCase()
        if (!q) return true
        return (
          item.title.toLowerCase().includes(q) ||
          item.tags.some((tag) => tag.toLowerCase().includes(q))
        )
      })
    : []

  async function handleSelect(collectionImageId: string) {
    if (!activeCollection) return
    setBusyImageId(collectionImageId)
    try {
      await onSelect(activeCollection, collectionImageId)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update slide background.")
    } finally {
      setBusyImageId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[92vh] !w-[calc(100vw-2rem)] !max-w-none sm:!max-w-none xl:!w-[min(1840px,calc(100vw-2rem))] overflow-hidden border-border/60 bg-background p-0 text-foreground">
        <DialogHeader className="border-b border-border/60 px-6 py-5 text-left">
          <DialogTitle className="text-xl font-semibold">
            {slide ? `Slide ${slide.index + 1} Background` : "Background image"}
          </DialogTitle>
          <DialogDescription className={subtleTextClass}>
            Browse your curated collections and swap this slide to a better-matching image.
          </DialogDescription>
        </DialogHeader>

        <div className="grid h-[calc(92vh-88px)] grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr]">
          <div className="border-r border-border/60 bg-muted/20 p-4">
            <Label className={subtleLabelClass}>Collections</Label>
            <ScrollArea className="mt-4 h-[calc(100%-24px)]">
              <div className="space-y-2 pr-3">
                {usableCollections.map((collection) => {
                  const active = collection.id === activeCollectionId
                  return (
                    <button
                      key={collection.id}
                      type="button"
                      onClick={() => setActiveCollectionId(collection.id)}
                      className={cn(
                        "w-full rounded-2xl border px-3 py-3 text-left transition",
                        active ? selectedCardClass : idleCardClass,
                      )}
                    >
                      <p className="truncate text-sm font-medium">{collection.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {collection.items.length} image{collection.items.length === 1 ? "" : "s"}
                      </p>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          <div className="min-h-0 px-6 py-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium">{activeCollection?.name ?? "No collection selected"}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeCollection?.description || "Search and click any image to update this slide."}
                  </p>
                </div>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search images in this collection"
                className="w-full max-w-sm border-border/60 bg-background"
              />
            </div>

            <ScrollArea className="h-[calc(100%-56px)]">
              {filteredItems.length === 0 ? (
                <div className={cn(emptyStateClass, "p-8 text-center text-sm")}>
                  No images match this search.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 pr-4 md:grid-cols-3 xl:grid-cols-5">
                  {filteredItems.map((item) => {
                    const selected = slideUsesCollectionItem(slide, item)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={busyImageId === item.id}
                        onClick={() => void handleSelect(item.id)}
                        className={cn(
                          "rounded-2xl border p-3 text-left transition",
                          selected ? selectedCardClass : "border-border/60 bg-background/70 hover:border-primary/40 hover:bg-muted/40",
                        )}
                      >
                        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.thumbnailUrl || item.url} alt={item.title} className="h-full w-full object-cover" />
                        </div>
                        <p className="mt-2 truncate text-xs font-medium">{item.title}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{item.tags.slice(0, 2).join(" / ")}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function HookSlideshowApp() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get("project")

  const [status, setStatus] = React.useState<SocialConnectionsStatus | null>(null)
  const [brands, setBrands] = React.useState<BrandKit[]>([])
  const [collections, setCollections] = React.useState<SlideshowCollection[]>([])
  const [project, setProject] = React.useState<SlideshowProject | null>(null)
  const [hooks, setHooks] = React.useState<SlideshowHookOption[]>([])
  const [slides, setSlides] = React.useState<SlideshowSlide[]>([])
  const [selectedHookId, setSelectedHookId] = React.useState<string | null>(null)
  const [selectedSocialConnectionId, setSelectedSocialConnectionId] = React.useState<string | null>(null)
  const [selectedBrandKitId, setSelectedBrandKitId] = React.useState<string | null>(null)
  const [stage, setStage] = React.useState<Stage>("setup")
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState<null | "hooks" | "slides" | "finalize">(null)
  const [assetsLoading, setAssetsLoading] = React.useState(false)
  const [assetsUploading, setAssetsUploading] = React.useState(false)
  const [availableAssets, setAvailableAssets] = React.useState<AssetRecord[]>([])
  const [collectionsOpen, setCollectionsOpen] = React.useState(false)
  const [backgroundPickerOpen, setBackgroundPickerOpen] = React.useState(false)
  const [activeSlideIndex, setActiveSlideIndex] = React.useState<number | null>(null)
  const [savingSlideIndex, setSavingSlideIndex] = React.useState<number | null>(null)
  const slidePreviewRefs = React.useRef<Record<number, HTMLDivElement | null>>({})

  const connectedAccounts = React.useMemo(() => {
    const instagram = status?.providers?.instagram?.connections ?? status?.instagram?.connections ?? []
    const tiktok = status?.providers?.tiktok?.connections ?? status?.tiktok?.connections ?? []
    return [...instagram, ...tiktok].filter((connection) => connection.status === "connected")
  }, [status])

  const selectedHook = React.useMemo(
    () => hooks.find((hook) => hook.id === selectedHookId) ?? null,
    [hooks, selectedHookId],
  )

  const activeSlide =
    activeSlideIndex !== null ? slides.find((slide) => slide.index === activeSlideIndex) ?? null : null

  React.useEffect(() => {
    let cancelled = false

    async function loadAll() {
      setLoading(true)
      try {
        const baseRequests: Array<Promise<Response>> = [
          fetch("/api/social-connections/status", { cache: "no-store" }),
          fetch("/api/brand-kits", { cache: "no-store" }),
          fetch("/api/slideshow/collections", { cache: "no-store" }),
        ]

        if (projectId) {
          baseRequests.push(fetch(`/api/slideshow/projects/${projectId}`, { cache: "no-store" }))
        }

        const responses = await Promise.all(baseRequests)
        const [statusRes, brandsRes, collectionsRes, projectRes] = responses

        if (!statusRes.ok) {
          throw new Error("Could not load connected accounts.")
        }
        if (!brandsRes.ok) {
          throw new Error("Could not load brand kits.")
        }
        if (!collectionsRes.ok) {
          throw new Error("Could not load slideshow collections.")
        }

        const nextStatus = (await statusRes.json()) as SocialConnectionsStatus
        const nextBrands = (await brandsRes.json()) as { kits: BrandKit[] }
        const nextCollections = (await collectionsRes.json()) as { collections: SlideshowCollection[] }

        if (cancelled) return

        setStatus(nextStatus)
        setBrands(nextBrands.kits ?? [])
        setCollections(nextCollections.collections ?? [])

        if (projectRes) {
          if (projectRes.ok) {
            const nextProject = (await projectRes.json()) as { project: SlideshowProject }
            if (cancelled) return
            setProject(nextProject.project)
            setSelectedSocialConnectionId(nextProject.project.socialConnectionId)
            setSelectedBrandKitId(nextProject.project.brandKitId)
            setHooks(nextProject.project.hookOptions)
            setSlides(nextProject.project.slides)
            setStage(inferStage(nextProject.project))
            if (nextProject.project.selectedHook) {
              const existingHook =
                nextProject.project.hookOptions.find(
                  (hook) => hook.text === nextProject.project.selectedHook,
                ) ?? nextProject.project.hookOptions[0]
              setSelectedHookId(existingHook?.id ?? null)
            } else {
              setSelectedHookId(nextProject.project.hookOptions[0]?.id ?? null)
            }
          } else {
            setProject(null)
            setHooks([])
            setSlides([])
            setSelectedHookId(null)
            setStage("setup")
          }
        } else {
          setProject(null)
          setHooks([])
          setSlides([])
          setSelectedHookId(null)
          setStage("setup")
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load Hook Slideshow.")
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadAll()

    return () => {
      cancelled = true
    }
  }, [projectId])

  React.useEffect(() => {
    if (project) return
    if (!selectedSocialConnectionId && connectedAccounts[0]) {
      setSelectedSocialConnectionId(connectedAccounts[0].id)
    }
    if (!selectedBrandKitId && brands[0]) {
      setSelectedBrandKitId(brands[0].id)
    }
  }, [brands, connectedAccounts, project, selectedBrandKitId, selectedSocialConnectionId])

  const refreshAvailableAssets = React.useCallback(
    async (options?: { silent?: boolean }) => {
      setAssetsLoading(true)
      try {
        const response = await fetch("/api/assets?visibility=private&limit=200", { cache: "no-store" })
        const data = (await response.json()) as { assets?: AssetRecord[]; error?: string }
        if (!response.ok) {
          throw new Error(data.error || "Failed to load image assets.")
        }
        setAvailableAssets((data.assets ?? []).filter((asset) => asset.assetType === "image"))
      } catch (error) {
        if (!options?.silent) {
          toast.error(error instanceof Error ? error.message : "Failed to load image assets.")
        }
      } finally {
        setAssetsLoading(false)
      }
    },
    [],
  )

  function applyProjectUrl(nextProjectId: string) {
    router.replace(`/apps/hook-slideshow?project=${encodeURIComponent(nextProjectId)}`)
  }

  async function ensureProject() {
    if (project) return project
    if (!selectedSocialConnectionId || !selectedBrandKitId) {
      throw new Error("Select an account and brand first.")
    }

    const response = await fetch("/api/slideshow/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        socialConnectionId: selectedSocialConnectionId,
        brandKitId: selectedBrandKitId,
      }),
    })
    const data = (await response.json()) as { project?: SlideshowProject; error?: string }
    if (!response.ok || !data.project) {
      throw new Error(data.error || "Failed to create slideshow project.")
    }

    setProject(data.project)
    applyProjectUrl(data.project.id)
    return data.project
  }

  async function handleGenerateHooks() {
    if (!selectedSocialConnectionId || !selectedBrandKitId) {
      toast.error("Pick a connected account and a brand first.")
      return
    }

    setBusy("hooks")
    try {
      const ensuredProject = await ensureProject()
      const response = await fetch("/api/slideshow/generate-hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: ensuredProject.id,
          socialConnectionId: selectedSocialConnectionId,
          brandKitId: selectedBrandKitId,
        }),
      })
      const data = (await response.json()) as HookGenerationResponse & { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate hooks.")
      }
      setProject(data.project)
      setHooks(data.hookOptions)
      setSlides([])
      setSelectedHookId(data.hookOptions[0]?.id ?? null)
      setStage("hooks")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate hooks.")
    } finally {
      setBusy(null)
    }
  }

  async function persistHookSelection() {
    if (!project || !selectedHook) return project
    const response = await fetch(`/api/slideshow/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedHook: selectedHook.text,
        hookOptions: hooks,
        status: "hooks_generated",
      }),
    })
    const data = (await response.json()) as { project?: SlideshowProject; error?: string }
    if (!response.ok || !data.project) {
      throw new Error(data.error || "Failed to save hook choice.")
    }
    setProject(data.project)
    return data.project
  }

  async function handleGenerateSlides() {
    if (!project || !selectedHook) {
      toast.error("Choose a hook first.")
      return
    }

    const readyCollections = collections.filter((collection) => collection.items.length > 0)
    if (readyCollections.length === 0) {
      toast.error("Add at least one image collection with images before generating slides.")
      setCollectionsOpen(true)
      return
    }

    setBusy("slides")
    try {
      await persistHookSelection()
      const response = await fetch("/api/slideshow/generate-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          selectedHook: selectedHook.text,
        }),
      })
      const data = (await response.json()) as SlideGenerationResponse & { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate slideshow slides.")
      }
      setProject(data.project)
      setSlides(data.slides)
      setStage("editor")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate slideshow slides.")
    } finally {
      setBusy(null)
    }
  }

  async function updateSlide(index: number, patch: Partial<SlideshowSlide>) {
    if (!project) return
    setSavingSlideIndex(index)
    try {
      const response = await fetch(`/api/slideshow/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideUpdate: {
            index,
            overlayText: patch.overlayText,
            collectionId: patch.collectionId,
            collectionImageId: patch.collectionImageId,
            assetUrl: patch.assetUrl,
            selectionMode: patch.selectionMode,
            narrativeRole: patch.narrativeRole,
            notes: patch.notes,
          },
        }),
      })
      const data = (await response.json()) as { project?: SlideshowProject; error?: string }
      if (!response.ok || !data.project) {
        throw new Error(data.error || "Failed to save slide.")
      }
      setProject(data.project)
      setSlides(data.project.slides)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save slide.")
    } finally {
      setSavingSlideIndex(null)
    }
  }

  async function handleCreateCollection(payload: { name: string; description?: string | null }) {
    const response = await fetch("/api/slideshow/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = (await response.json()) as { collection?: SlideshowCollection; error?: string }
    if (!response.ok || !data.collection) {
      throw new Error(data.error || "Failed to create collection.")
    }
    setCollections((current) => [data.collection!, ...current])
    toast.success("Collection created.")
  }

  async function handleUpdateCollection(
    collectionId: string,
    payload: { name?: string; description?: string | null; itemIds?: string[] },
  ) {
    const response = await fetch(`/api/slideshow/collections/${collectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = (await response.json()) as { collection?: SlideshowCollection; error?: string }
    if (!response.ok || !data.collection) {
      throw new Error(data.error || "Failed to update collection.")
    }
    setCollections((current) => replaceCollection(current, data.collection!))
  }

  async function handleDeleteCollection(collectionId: string) {
    const response = await fetch(`/api/slideshow/collections/${collectionId}`, {
      method: "DELETE",
    })
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    if (!response.ok) {
      throw new Error(data.error || "Failed to delete collection.")
    }
    setCollections((current) => current.filter((collection) => collection.id !== collectionId))
    toast.success("Collection deleted.")
  }

  async function handleUploadAssetsToCollection(collectionId: string, files: File[]) {
    const collection = collections.find((candidate) => candidate.id === collectionId)
    if (!collection) {
      throw new Error("Collection not found.")
    }

    setAssetsUploading(true)
    try {
      const uploads: Array<{ uploadId: string; title: string }> = []

      for (const file of files) {
        const uploaded = await uploadFileToSupabase(file, "slideshow-collections")
        if (!uploaded) {
          throw new Error(`Failed to upload ${file.name}.`)
        }
        uploads.push({
          uploadId: uploaded.uploadId,
          title: formatAssetTitle(file.name),
        })
      }

      const response = await fetch(`/api/slideshow/collections/${collectionId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploads }),
      })
      const data = (await response.json()) as { collection?: SlideshowCollection; error?: string }
      if (!response.ok || !data.collection) {
        throw new Error(data.error || "Failed to save uploaded collection images.")
      }

      setCollections((current) => replaceCollection(current, data.collection!))
      toast.success(`${uploads.length} image${uploads.length === 1 ? "" : "s"} added to ${collection.name}.`)
    } finally {
      setAssetsUploading(false)
    }
  }

  async function handleAddAssetCopiesToCollection(collectionId: string, assetIds: string[]) {
    const collection = collections.find((candidate) => candidate.id === collectionId)
    if (!collection) {
      throw new Error("Collection not found.")
    }

    const response = await fetch(`/api/slideshow/collections/${collectionId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetIds }),
    })
    const data = (await response.json()) as { collection?: SlideshowCollection; error?: string }
    if (!response.ok || !data.collection) {
      throw new Error(data.error || "Failed to copy asset into collection.")
    }

    setCollections((current) => replaceCollection(current, data.collection!))
    toast.success(`${assetIds.length} asset${assetIds.length === 1 ? "" : "s"} copied to ${collection.name}.`)
  }

  async function handlePreviewPinterestImport(payload: {
    collectionId: string
    mode: "board_url" | "search"
    query: string
    limit: number
  }) {
    const response = await fetch("/api/slideshow/collections/import/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = (await response.json()) as {
      jobId?: string
      candidates?: SlideshowImportCandidate[]
      error?: string
    }
    if (!response.ok || !data.jobId || !data.candidates) {
      throw new Error(data.error || "Failed to preview Pinterest images.")
    }
    return {
      jobId: data.jobId,
      candidates: data.candidates,
    }
  }

  async function handleCommitPinterestImport(payload: {
    collectionId: string
    jobId: string
    candidateIds: string[]
  }) {
    const collection = collections.find((candidate) => candidate.id === payload.collectionId)
    if (!collection) {
      throw new Error("Collection not found.")
    }

    const response = await fetch("/api/slideshow/collections/import/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = (await response.json()) as {
      collection?: SlideshowCollection
      importedCount?: number
      failedCount?: number
      error?: string
    }
    if (!response.ok || !data.collection || typeof data.importedCount !== "number") {
      throw new Error(data.error || "Failed to import Pinterest images.")
    }

    setCollections((current) => replaceCollection(current, data.collection!))
    toast.success(`${data.importedCount} Pinterest image${data.importedCount === 1 ? "" : "s"} added to ${collection.name}.`)
    if (typeof data.failedCount === "number" && data.failedCount > 0) {
      toast.error(`${data.failedCount} selected Pinterest image${data.failedCount === 1 ? "" : "s"} could not be imported.`)
    }
    return { importedCount: data.importedCount }
  }

  async function handleBackgroundSelect(collection: SlideshowCollection, collectionImageId: string) {
    const item = collection.items.find((candidate) => candidate.id === collectionImageId)
    if (!item || activeSlideIndex === null) return

    setSlides((current) =>
      current.map((slide) =>
        slide.index === activeSlideIndex
          ? {
              ...slide,
              collectionId: collection.id,
              collectionImageId: item.id,
              assetUrl: item.url,
              selectionMode: "manual",
            }
          : slide,
      ),
    )

    await updateSlide(activeSlideIndex, {
      collectionId: collection.id,
      collectionImageId: item.id,
      assetUrl: item.url,
      selectionMode: "manual",
    })
  }

  async function handleFinalize() {
    if (!project || slides.length === 0) {
      toast.error("Generate slides before creating a draft.")
      return
    }

    setBusy("finalize")
    try {
      const orderedSlides = [...slides].sort((a, b) => a.index - b.index)
      const renderedSlideUrls: string[] = []

      for (const slide of orderedSlides) {
        const node = slidePreviewRefs.current[slide.index]
        if (!node) {
          throw new Error(`Slide ${slide.index + 1} is missing a render surface.`)
        }
        const blob = await toBlob(node, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: "#121317",
        })
        if (!blob) {
          throw new Error(`Could not render slide ${slide.index + 1}.`)
        }
        const uploaded = await uploadBlobToSupabase(
          blob,
          `hook-slideshow-${project.id}-slide-${slide.index + 1}.png`,
          "slideshow-drafts",
        )
        if (!uploaded) {
          throw new Error(`Could not upload slide ${slide.index + 1}.`)
        }
        renderedSlideUrls.push(uploaded.url)
      }

      const response = await fetch(`/api/slideshow/projects/${project.id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renderedSlideUrls }),
      })
      const data = (await response.json()) as {
        project?: SlideshowProject
        redirectTo?: string
        error?: string
      }
      if (!response.ok || !data.project) {
        throw new Error(data.error || "Failed to create slideshow draft.")
      }
      setProject(data.project)
      toast.success("Autopost draft created.")
      router.push(data.redirectTo || "/autopost")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create slideshow draft.")
    } finally {
      setBusy(null)
    }
  }

  const canGenerateHooks = Boolean(selectedSocialConnectionId && selectedBrandKitId)
  const canGenerateSlides = Boolean(selectedHook && collections.some((collection) => collection.items.length > 0))

  return (
    <div className={cn("min-h-screen", shellClass)}>
      <div className="mx-auto max-w-[1600px] px-6 pb-12 pt-20">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Generate Content</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Hook Slideshow</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Pick an account and brand, let AI draft hooks, then turn one hook into a polished
              image carousel with editable slide overlays and curated collection-driven visuals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCollectionsOpen(true)}
              className={outlineButtonClass}
            >
              <Images className="mr-2 h-4 w-4" />
              Manage Collections
            </Button>
            <Button asChild variant="outline" className={outlineButtonClass}>
              <Link href="/apps">Back to Apps</Link>
            </Button>
          </div>
        </div>

        <div className="mb-8 flex items-center gap-3 overflow-x-auto rounded-full border border-border/60 bg-card/70 px-4 py-3 shadow-sm">
          {(["setup", "hooks", "editor"] as Stage[]).map((candidate, index) => {
            const active = stage === candidate
            const label =
              candidate === "setup" ? "1. Setup" : candidate === "hooks" ? "2. Hooks" : "3. Editor"
            return (
              <React.Fragment key={candidate}>
                <button
                  type="button"
                  onClick={() => setStage(candidate)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm transition",
                    active ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
                {index < 2 ? <ArrowsHorizontal className="h-4 w-4 shrink-0 text-muted-foreground/40" /> : null}
              </React.Fragment>
            )
          })}
        </div>

        {loading ? (
          <div className={cn(panelClass, "p-14 text-center text-muted-foreground")}>
            Loading Hook Slideshow...
          </div>
        ) : (
          <>
            {stage === "setup" ? (
              <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
                <div className={cn(panelClass, "p-6")}>
                  <div className="mb-6">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Step 1</p>
                    <h2 className="mt-2 text-2xl font-semibold">Pick an account and brand</h2>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                      AI uses the connected account vibe and your saved brand context to draft 10 hook
                      options for a slideshow opener.
                    </p>
                  </div>

                  <div className="grid gap-6">
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <Label className="text-sm font-medium text-white">Connected accounts</Label>
                        <Link href="/autopost" className="text-xs text-primary underline">
                          Manage connections
                        </Link>
                      </div>
                      {connectedAccounts.length === 0 ? (
                        <div className={cn(emptyStateClass, "p-6 text-sm")}>
                          Connect Instagram or TikTok in Autopost before using Hook Slideshow.
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {connectedAccounts.map((connection) => {
                            const active = selectedSocialConnectionId === connection.id
                            return (
                              <button
                                key={connection.id}
                                type="button"
                                onClick={() => setSelectedSocialConnectionId(connection.id)}
                                className={cn(
                                  "rounded-2xl border p-4 text-left transition",
                                  active ? selectedCardClass : idleCardClass,
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
                                    {providerIcon(connection.provider)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{previewAccountLabel(connection)}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{providerLabel(connection.provider)}</p>
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <Label className="text-sm font-medium text-white">Saved brands</Label>
                        <Link href="/brand" className="text-xs text-primary underline">
                          Manage brand kits
                        </Link>
                      </div>
                      {brands.length === 0 ? (
                        <div className={cn(emptyStateClass, "p-6 text-sm")}>
                          Create a brand kit first so AI has the right voice, palette, and aesthetic.
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {brands.map((brand) => {
                            const active = selectedBrandKitId === brand.id
                            return (
                              <button
                                key={brand.id}
                                type="button"
                                onClick={() => setSelectedBrandKitId(brand.id)}
                                className={cn(
                                  "rounded-2xl border p-4 text-left transition",
                                  active ? selectedCardClass : idleCardClass,
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{brand.name}</p>
                                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                      {brand.tagline || brand.aestheticTags.slice(0, 3).join(" / ") || "Saved brand kit"}
                                    </p>
                                  </div>
                                  {brand.isDefault ? (
                                    <span className="rounded-full bg-muted px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                      Default
                                    </span>
                                  ) : null}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={cn(subPanelClass, "mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl p-4")}>
                    <div>
                      <p className="text-sm font-medium">Image collections</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatCollectionCount(collections)}. You can generate hooks now and wire up slideshow visuals next.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCollectionsOpen(true)}
                        className={outlineButtonClass}
                      >
                        <Images className="mr-2 h-4 w-4" />
                        Collections
                      </Button>
                      <Button
                        type="button"
                        disabled={!canGenerateHooks || busy === "hooks"}
                        onClick={() => void handleGenerateHooks()}
                        className={cn("px-6", primaryButtonClass)}
                      >
                        <Sparkle className="mr-2 h-4 w-4" weight="fill" />
                        {busy === "hooks" ? "Generating hooks..." : "Generate Hooks"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className={cn(panelClass, "bg-linear-to-br from-card via-card to-muted/40 p-6")}>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">What AI does</p>
                  <div className="mt-5 space-y-5">
                    {[
                      "Reads your selected account metadata and saved brand kit.",
                      "Generates 10 punchy overlay hook ideas for a slideshow opener.",
                      "Maps each slide to a curated image collection and picks an exact image.",
                      "Lets you tweak the text and swap any background before drafting the post.",
                    ].map((item, index) => (
                      <div key={item} className="flex gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                          {index + 1}
                        </div>
                        <p className="pt-1 text-sm leading-6 text-muted-foreground">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {stage === "hooks" ? (
              <section className={cn(panelClass, "p-6")}>
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Step 2</p>
                    <h2 className="mt-2 text-2xl font-semibold">Select a hook for your slideshow</h2>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                      Pick the strongest opener, tweak the wording if you want, then let AI build the
                      slide narrative and background picks around it.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCollectionsOpen(true)}
                      className={outlineButtonClass}
                    >
                      <Images className="mr-2 h-4 w-4" />
                      Manage Collections
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy === "hooks"}
                      onClick={() => void handleGenerateHooks()}
                      className={outlineButtonClass}
                    >
                      Regenerate Hooks
                    </Button>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,780px)_300px]">
                  <div className={cn(nestedPanelClass, "p-4")}>
                    <ScrollArea className="h-[560px] pr-4">
                      <div className="space-y-3">
                        {hooks.map((hook) => {
                          const active = hook.id === selectedHookId
                          return (
                            <button
                              key={hook.id}
                              type="button"
                                onClick={() => setSelectedHookId(hook.id)}
                                className={cn(
                                  "w-full rounded-2xl border p-4 text-left transition",
                                  active ? selectedCardClass : idleCardClass,
                                )}
                              >
                              <Textarea
                                value={hook.text}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) =>
                                  setHooks((current) =>
                                    current.map((candidate) =>
                                      candidate.id === hook.id
                                        ? { ...candidate, text: event.target.value }
                                        : candidate,
                                    ),
                                  )
                                }
                                rows={2}
                                className="min-h-[72px] border-0 bg-transparent px-0 py-0 text-lg font-medium text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0"
                              />
                            </button>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className={cn(nestedPanelClass, "p-5")}>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Ready state</p>
                    <div className="mt-4 space-y-4">
                      <div className={cn(subPanelClass, "p-4")}>
                        <p className="text-sm font-medium">Selected account</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {connectedAccounts.find((connection) => connection.id === selectedSocialConnectionId)
                            ? previewAccountLabel(
                                connectedAccounts.find(
                                  (connection) => connection.id === selectedSocialConnectionId,
                                )!,
                              )
                            : "No account selected"}
                        </p>
                      </div>
                      <div className={cn(subPanelClass, "p-4")}>
                        <p className="text-sm font-medium">Selected brand</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {brands.find((brand) => brand.id === selectedBrandKitId)?.name || "No brand selected"}
                        </p>
                      </div>
                      <div className={cn(subPanelClass, "p-4")}>
                        <p className="text-sm font-medium">Collection readiness</p>
                        <p className="mt-1 text-sm text-muted-foreground">{formatCollectionCount(collections)}</p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      disabled={!canGenerateSlides || busy === "slides"}
                      onClick={() => void handleGenerateSlides()}
                      className={cn("mt-6 w-full py-6 text-base font-semibold", primaryButtonClass)}
                    >
                      {busy === "slides" ? "Generating slideshow..." : "Generate Slideshow"}
                    </Button>
                    {!canGenerateSlides ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Pick a hook and make sure at least one image collection has images in it.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {stage === "editor" ? (
              <section className={cn(panelClass, "p-6")}>
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Step 3</p>
                    <h2 className="mt-2 text-2xl font-semibold">Edit your slideshow</h2>
                    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                      AI picked the first pass for text and backgrounds. Swap any image, rewrite any
                      overlay, and when the flow looks right we will render the slides and drop them into
                      Autopost as a draft.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStage("hooks")}
                      className={outlineButtonClass}
                    >
                      Back to Hooks
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCollectionsOpen(true)}
                      className={outlineButtonClass}
                    >
                      <Images className="mr-2 h-4 w-4" />
                      Manage Collections
                    </Button>
                    <Button
                      type="button"
                      disabled={busy === "finalize"}
                      onClick={() => void handleFinalize()}
                      className={cn("px-6", primaryButtonClass)}
                    >
                      {busy === "finalize" ? "Rendering Draft..." : "Done"}
                    </Button>
                  </div>
                </div>

                <ScrollArea className="w-full">
                  <div className="flex min-w-max gap-6 pb-4">
                    {[...slides]
                      .sort((a, b) => a.index - b.index)
                      .map((slide) => {
                        const collection = collections.find((candidate) => candidate.id === slide.collectionId)
                        const lines = splitOverlayLines(slide.overlayText)
                        return (
                          <div key={slide.index} className="w-[310px] shrink-0">
                            <p className="mb-3 text-sm font-semibold">Slide {slide.index + 1}</p>
                            <div
                              ref={(node) => {
                                slidePreviewRefs.current[slide.index] = node
                              }}
                              className="relative aspect-[9/16] overflow-hidden rounded-[26px] border border-border/60 bg-muted"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={slide.assetUrl} alt="" className="h-full w-full object-cover" />
                              <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
                              <div className="absolute inset-x-0 top-[44%] flex flex-col items-center gap-2 px-4 text-center">
                                {(lines.length > 0 ? lines : [slide.overlayText]).map((line, index) => (
                                  <span
                                    key={`${slide.index}-${index}`}
                                    className="rounded-[10px] bg-white px-3 py-1 text-lg font-extrabold leading-tight text-black shadow-[0_8px_30px_rgba(0,0,0,0.24)]"
                                  >
                                    {line}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className={cn(nestedPanelClass, "mt-4 space-y-3 rounded-[24px] p-4")}>
                              <div>
                                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Overlay text</Label>
                                <Textarea
                                  value={slide.overlayText}
                                  onChange={(event) =>
                                    setSlides((current) =>
                                      current.map((candidate) =>
                                        candidate.index === slide.index
                                          ? { ...candidate, overlayText: event.target.value }
                                          : candidate,
                                      ),
                                    )
                                  }
                                  onBlur={(event) => void updateSlide(slide.index, { overlayText: event.target.value })}
                                  rows={4}
                                  className="mt-2 min-h-[104px] border-border/60 bg-background"
                                />
                              </div>

                              <div className={cn(subPanelClass, "p-3")}>
                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Current collection</p>
                                <p className="mt-2 text-sm font-medium">{collection?.name || "Unknown collection"}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {slide.narrativeRole || "AI-selected visual direction"}
                                </p>
                              </div>

                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setActiveSlideIndex(slide.index)
                                  setBackgroundPickerOpen(true)
                                }}
                                className={cn("w-full", outlineButtonClass)}
                              >
                                Change Background
                              </Button>

                              {savingSlideIndex === slide.index ? (
                                <p className="text-[11px] text-muted-foreground">Saving changes...</p>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </ScrollArea>
              </section>
            ) : null}
          </>
        )}
      </div>

      <CollectionManagerDialog
        open={collectionsOpen}
        onOpenChange={setCollectionsOpen}
        collections={collections}
        availableAssets={availableAssets}
        loadingAssets={assetsLoading}
        uploadingAssets={assetsUploading}
        onRefreshAssets={refreshAvailableAssets}
        onCreateCollection={handleCreateCollection}
        onUpdateCollection={handleUpdateCollection}
        onDeleteCollection={handleDeleteCollection}
        onAddAssetCopiesToCollection={handleAddAssetCopiesToCollection}
        onUploadAssetsToCollection={handleUploadAssetsToCollection}
        onPreviewPinterestImport={handlePreviewPinterestImport}
        onCommitPinterestImport={handleCommitPinterestImport}
      />

      <BackgroundPickerDialog
        open={backgroundPickerOpen}
        onOpenChange={setBackgroundPickerOpen}
        slide={activeSlide}
        collections={collections}
        onSelect={handleBackgroundSelect}
      />
    </div>
  )
}
