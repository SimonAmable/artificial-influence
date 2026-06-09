"use client"

import * as React from "react"
import { CircleNotch, Trash, UploadSimple } from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  AssetSelectionModal,
  type AssetSelectionPick,
} from "@/components/shared/modals/asset-selection-modal"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { uploadFilesToSupabase } from "@/lib/canvas/upload-helpers"
import type { SlideshowCollection, SlideshowImportCandidate } from "@/lib/slideshow/types"
import { cn } from "@/lib/utils"

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      typeof body.error === "string"
        ? body.error
        : "Request failed."
    throw new Error(message)
  }
  return body as T
}

export type CollectionEditorDialogProps = {
  collection: SlideshowCollection | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange: (collection: SlideshowCollection) => void
  onDeleted?: (collectionId: string) => void
}

export function CollectionEditorDialog({
  collection,
  open,
  onOpenChange,
  onChange,
  onDeleted,
}: CollectionEditorDialogProps) {
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [assetPickerOpen, setAssetPickerOpen] = React.useState(false)
  const [importMode, setImportMode] = React.useState<"search" | "board_url">("search")
  const [importQuery, setImportQuery] = React.useState("")
  const [importJobId, setImportJobId] = React.useState<string | null>(null)
  const [importCandidates, setImportCandidates] = React.useState<SlideshowImportCandidate[]>([])
  const [selectedCandidateIds, setSelectedCandidateIds] = React.useState<string[]>([])
  const [isDragging, setIsDragging] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dragCounterRef = React.useRef(0)

  React.useEffect(() => {
    if (!open || !collection) return
    setName(collection.name)
    setDescription(collection.description ?? "")
    setImportMode("search")
    setImportQuery("")
    setImportJobId(null)
    setImportCandidates([])
    setSelectedCandidateIds([])
    setBusy(false)
    setIsDragging(false)
    dragCounterRef.current = 0
  }, [collection, open])

  if (!collection) return null

  async function refreshCollection() {
    const { collection: latest } = await readJson<{ collection: SlideshowCollection }>(
      await fetch(`/api/slideshow/collections/${collection.id}`, { cache: "no-store" }),
    )
    onChange(latest)
    return latest
  }

  async function saveDetails() {
    setBusy(true)
    try {
      const { collection: updated } = await readJson<{ collection: SlideshowCollection }>(
        await fetch(`/api/slideshow/collections/${collection.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
          }),
        }),
      )
      onChange(updated)
      toast.success("Collection updated.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update collection.")
    } finally {
      setBusy(false)
    }
  }

  async function removeImage(itemId: string) {
    const nextItemIds = collection.items
      .map((item) => item.id)
      .filter((id) => id !== itemId)

    setBusy(true)
    try {
      const { collection: updated } = await readJson<{ collection: SlideshowCollection }>(
        await fetch(`/api/slideshow/collections/${collection.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIds: nextItemIds }),
        }),
      )
      onChange(updated)
      toast.success("Image removed.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove image.")
    } finally {
      setBusy(false)
    }
  }

  async function postCollectionImages(body: Record<string, unknown>) {
    return readJson<{ collection: SlideshowCollection }>(
      await fetch(`/api/slideshow/collections/${collection.id}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    )
  }

  async function addImagesFromPick(pick: AssetSelectionPick) {
    if (pick.assetType !== "image" || !pick.id) {
      toast.error("Only images can be added to collections.")
      return
    }

    setBusy(true)
    try {
      let updated: SlideshowCollection
      try {
        ;({ collection: updated } = await postCollectionImages({ assetIds: [pick.id] }))
      } catch {
        ;({ collection: updated } = await postCollectionImages({
          uploads: [{ uploadId: pick.id, title: pick.title?.trim() || undefined }],
        }))
      }
      onChange(updated)
      toast.success("Image added to collection.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add image.")
    } finally {
      setBusy(false)
    }
  }

  function collectImageFiles(fileList: FileList | File[]): File[] {
    return Array.from(fileList).filter((file) => file.type.startsWith("image/"))
  }

  async function handleUploadFiles(files: File[]) {
    const imageFiles = collectImageFiles(files)
    if (imageFiles.length === 0) {
      toast.error("Please choose image files.")
      return
    }
    if (imageFiles.length < files.length) {
      const skipped = files.length - imageFiles.length
      toast.info(`Skipped ${skipped} non-image file${skipped === 1 ? "" : "s"}.`)
    }

    setBusy(true)
    try {
      const uploaded = await uploadFilesToSupabase(imageFiles)
      if (uploaded.length === 0) return

      const { collection: updated } = await postCollectionImages({
        uploads: uploaded.map((result) => ({
          uploadId: result.uploadId,
          title: result.fileName,
        })),
      })
      onChange(updated)
      toast.success(
        uploaded.length === 1
          ? "Image uploaded to collection."
          : `${uploaded.length} images uploaded to collection.`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload images.")
    } finally {
      setBusy(false)
    }
  }

  function handleDragEnter(event: React.DragEvent) {
    event.preventDefault()
    event.stopPropagation()
    dragCounterRef.current += 1
    if (event.dataTransfer.types.includes("Files")) {
      setIsDragging(true)
    }
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault()
    event.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragging(false)
    }
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault()
    event.stopPropagation()
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault()
    event.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)

    const imageFiles = collectImageFiles(event.dataTransfer.files)
    if (imageFiles.length === 0) {
      toast.error("Please drop image files.")
      return
    }
    void handleUploadFiles(imageFiles)
  }

  async function previewPinterestImport() {
    const query = importQuery.trim()
    if (!query) {
      toast.error(importMode === "board_url" ? "Paste a Pinterest board URL." : "Enter a Pinterest search query.")
      return
    }

    setBusy(true)
    try {
      const { jobId, candidates } = await readJson<{
        jobId: string
        candidates: SlideshowImportCandidate[]
      }>(
        await fetch("/api/slideshow/collections/import/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collectionId: collection.id,
            mode: importMode,
            query,
            limit: 24,
          }),
        }),
      )
      setImportJobId(jobId)
      setImportCandidates(candidates)
      setSelectedCandidateIds(candidates.map((candidate) => candidate.id))
      toast.success(`Found ${candidates.length} images.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to preview Pinterest import.")
    } finally {
      setBusy(false)
    }
  }

  async function commitPinterestImport() {
    if (!importJobId || selectedCandidateIds.length === 0) {
      toast.error("Select at least one image to import.")
      return
    }

    setBusy(true)
    try {
      const { collection: updated, importedCount } = await readJson<{
        collection: SlideshowCollection
        importedCount: number
      }>(
        await fetch("/api/slideshow/collections/import/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collectionId: collection.id,
            jobId: importJobId,
            candidateIds: selectedCandidateIds,
          }),
        }),
      )
      onChange(updated)
      setImportJobId(null)
      setImportCandidates([])
      setSelectedCandidateIds([])
      toast.success(`Imported ${importedCount} image${importedCount === 1 ? "" : "s"}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import Pinterest images.")
    } finally {
      setBusy(false)
    }
  }

  async function deleteCollection() {
    if (!window.confirm(`Delete "${collection.name}"? This cannot be undone.`)) return

    setBusy(true)
    try {
      await readJson(await fetch(`/api/slideshow/collections/${collection.id}`, { method: "DELETE" }))
      onDeleted?.(collection.id)
      onOpenChange(false)
      toast.success("Collection deleted.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete collection.")
    } finally {
      setBusy(false)
    }
  }

  function toggleCandidate(candidateId: string) {
    setSelectedCandidateIds((current) =>
      current.includes(candidateId)
        ? current.filter((id) => id !== candidateId)
        : [...current, candidateId],
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Manage collection</DialogTitle>
            <DialogDescription>
              Add images from uploads, your library, or Pinterest. Use packs in slideshow templates and slideshows.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="collection-edit-name">Name</Label>
                <Input
                  id="collection-edit-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={120}
                  disabled={busy}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="collection-edit-description">Description</Label>
                <Textarea
                  id="collection-edit-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                  maxLength={500}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="gap-2" disabled={busy} onClick={() => setAssetPickerOpen(true)}>
                Add from library
              </Button>
              <Button type="button" variant="outline" className="gap-2" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                <UploadSimple className="h-4 w-4" />
                Upload images
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void saveDetails()}>
                Save details
              </Button>
            </div>

            <div className="rounded-xl border p-4">
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label>Pinterest import</Label>
                  <Select value={importMode} onValueChange={(value) => setImportMode(value as "search" | "board_url")}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="search">Search</SelectItem>
                      <SelectItem value="board_url">Board URL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <Label>{importMode === "board_url" ? "Board URL" : "Search query"}</Label>
                  <Input
                    value={importQuery}
                    onChange={(event) => setImportQuery(event.target.value)}
                    placeholder={importMode === "board_url" ? "https://pinterest.com/..." : "e.g. marble statue aesthetic"}
                    disabled={busy}
                  />
                </div>
                <Button type="button" disabled={busy || !importQuery.trim()} onClick={() => void previewPinterestImport()}>
                  Preview
                </Button>
              </div>

              {importCandidates.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      {selectedCandidateIds.length} of {importCandidates.length} selected
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy || selectedCandidateIds.length === 0}
                      onClick={() => void commitPinterestImport()}
                    >
                      Import selected
                    </Button>
                  </div>
                  <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
                    {importCandidates.map((candidate) => {
                      const selected = selectedCandidateIds.includes(candidate.id)
                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          className={`relative aspect-square overflow-hidden rounded-lg border-2 ${selected ? "border-primary" : "border-transparent"}`}
                          onClick={() => toggleCandidate(candidate.id)}
                          title={candidate.title ?? undefined}
                        >
                          <img src={candidate.previewUrl} alt="" className="h-full w-full object-cover" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div
              className={cn(
                "relative space-y-2 rounded-xl p-1 transition-colors",
                isDragging && "bg-primary/5 ring-2 ring-inset ring-primary/40",
              )}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="flex items-center justify-between gap-2">
                <Label>Images ({collection.items.length})</Label>
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void refreshCollection()}>
                  Refresh
                </Button>
              </div>
              {collection.items.length === 0 ? (
                <p
                  className={cn(
                    "rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground",
                    isDragging && "border-primary text-foreground",
                  )}
                >
                  {isDragging
                    ? "Drop images to add to collection"
                    : "This collection is empty. Upload images, drag and drop here, pick from your library, or import from Pinterest."}
                </p>
              ) : (
                <div className="relative">
                  {isDragging ? (
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-primary/10">
                      <p className="rounded-lg bg-background/90 px-3 py-2 text-sm font-medium shadow-sm">
                        Drop images to add
                      </p>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {collection.items.map((item) => (
                      <div key={item.id} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
                        <img src={item.thumbnailUrl || item.url} alt={item.title} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          className="absolute right-1 top-1 rounded-md bg-background/90 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => void removeImage(item.id)}
                          disabled={busy}
                          title="Remove image"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void deleteCollection()}>
              Delete collection
            </Button>
            <Button type="button" disabled={busy} onClick={() => onOpenChange(false)}>
              {busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : null}
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const imageFiles = collectImageFiles(event.target.files ?? [])
          event.target.value = ""
          if (imageFiles.length > 0) void handleUploadFiles(imageFiles)
        }}
      />

      <AssetSelectionModal
        open={assetPickerOpen}
        onOpenChange={setAssetPickerOpen}
        allowedAssetTypes={["image"]}
        defaultTab="assets"
        onSelect={(pick) => void addImagesFromPick(pick)}
      />
    </>
  )
}
