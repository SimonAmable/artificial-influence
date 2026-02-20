"use client"

import * as React from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  DotsThreeVertical,
  Download,
  Trash,
  PencilSimple,
  Image as ImageIcon,
  Video,
  MusicNote,
  UploadSimple,
} from "@phosphor-icons/react"
import Image from "next/image"
import { AnimatePresence, motion } from "framer-motion"
import type { AssetCategory, AssetRecord, AssetType, AssetVisibility } from "@/lib/assets/types"
import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABELS,
  deleteAsset,
  listAssets,
} from "@/lib/assets/library"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { CreateAssetDialog } from "@/components/canvas/create-asset-dialog"
import { toast } from "sonner"

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return "Just now"
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })
}

export default function AssetsPage() {
  const [assets, setAssets] = React.useState<AssetRecord[]>([])
  const [visibility, setVisibility] = React.useState<AssetVisibility | "all">("all")
  const [category, setCategory] = React.useState<AssetCategory | "all">("all")
  const [loading, setLoading] = React.useState(true)
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [uploadedFileUrl, setUploadedFileUrl] = React.useState<string | null>(null)
  const [uploadedAssetType, setUploadedAssetType] = React.useState<AssetType | null>(null)
  const [uploadedFileName, setUploadedFileName] = React.useState<string>("")
  const [editingAsset, setEditingAsset] = React.useState<AssetRecord | null>(null)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [isDraggingOver, setIsDraggingOver] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dragCounter = React.useRef(0)

  const refreshAssets = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAssets({
        visibility: visibility === "all" ? undefined : visibility,
        category: category === "all" ? undefined : category,
        limit: 200,
      })
      setAssets(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load assets")
      setAssets([])
    } finally {
      setLoading(false)
    }
  }, [category, visibility])

  React.useEffect(() => {
    void refreshAssets()
  }, [refreshAssets])

  const handleFileUpload = React.useCallback(async (file: File) => {
    if (!file) return
    const type = file.type
    const isImage = type.startsWith("image/")
    const isVideo = type.startsWith("video/")
    const isAudio = type.startsWith("audio/")
    if (!isImage && !isVideo && !isAudio) {
      toast.error("Please select an image, video, or audio file")
      return
    }
    const result = await uploadFileToSupabase(file, "asset-library")
    if (!result) return
    if (result.fileType === "other") {
      toast.error("Unsupported file type. Use image, video, or audio.")
      return
    }
    setUploadedFileUrl(result.url)
    setUploadedAssetType(result.fileType)
    setUploadedFileName(result.fileName)
    setCreateDialogOpen(true)
  }, [])

  const handleFileSelect = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    await handleFileUpload(file)
  }, [handleFileUpload])

  const handleDragOver = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingOver(true)
    }
  }, [])

  const handleDragEnter = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes("Files")) {
      dragCounter.current += 1
      setIsDraggingOver(true)
    }
  }, [])

  const handleDragLeave = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDraggingOver(false)
    }
  }, [])

  const handleDrop = React.useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDraggingOver(false)

    const files = e.dataTransfer.files
    if (!files || files.length === 0) return

    if (files.length > 1) {
      toast.info("Using the first file only")
    }

    const file = files[0]
    await handleFileUpload(file)
  }, [])

  const handleDownload = async (asset: AssetRecord) => {
    try {
      const response = await fetch(asset.url)
      if (!response.ok) throw new Error("Failed to fetch file")
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const extension = asset.assetType === "image" ? "png" : asset.assetType === "video" ? "mp4" : "mp3"

      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `${asset.title.replace(/\s+/g, "-").toLowerCase()}-${asset.id}.${extension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("Error downloading file:", error)
      const link = document.createElement("a")
      link.href = asset.url
      link.download = asset.title
      link.target = "_blank"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleDelete = async (asset: AssetRecord) => {
    if (!confirm("Delete this saved asset?")) return
    try {
      await deleteAsset(asset.id)
      setAssets((prev) => prev.filter((item) => item.id !== asset.id))
      toast.success("Asset deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete asset")
    }
  }

  const handleEdit = (asset: AssetRecord) => {
    setEditingAsset(asset)
    setEditDialogOpen(true)
  }

  const renderAssetCard = (asset: AssetRecord) => {
    const TypeIcon = asset.assetType === "image" ? ImageIcon : asset.assetType === "video" ? Video : MusicNote

    return (
      <div key={asset.id} className="group">
        <div className="relative">
          {asset.assetType === "image" && (
            <div className="relative aspect-square w-full">
              <Image
                src={asset.thumbnailUrl || asset.url}
                alt={asset.title}
                fill
                className="object-cover rounded-lg"
                unoptimized
              />
            </div>
          )}
          {asset.assetType === "video" && (
            <div className="relative w-full">
              <video
                src={asset.url}
                controls
                className="w-full h-auto rounded-lg"
                preload="metadata"
              />
            </div>
          )}
          {asset.assetType === "audio" && (
            <div>
              <audio src={asset.url} controls className="w-full" />
            </div>
          )}

          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" className="h-8 w-8 bg-background/80 hover:bg-background backdrop-blur-sm">
                  <DotsThreeVertical className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(asset)}>
                  <PencilSimple className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload(asset)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDelete(asset)} className="text-destructive focus:text-destructive">
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="gap-1">
              <TypeIcon className="h-3 w-3" />
              <span className="capitalize">{asset.assetType}</span>
            </Badge>
            <span className="text-xs text-muted-foreground">{formatDate(asset.createdAt)}</span>
          </div>

          <div className="text-sm text-foreground line-clamp-1">{asset.title}</div>
          <Badge variant="secondary" className="w-fit text-xs">
            {ASSET_CATEGORY_LABELS[asset.category]}
          </Badge>

          {asset.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {asset.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="container mx-auto px-4 py-8 pt-24 min-h-screen relative"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 pointer-events-none"
          >
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <UploadSimple className="w-12 h-12 text-primary" weight="bold" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">Drop to add attachment</p>
              <p className="text-sm text-muted-foreground mt-1">Images, videos, or audio files</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Asset Library</h1>
          <p className="text-muted-foreground mt-1">
            Save references for characters, scenes, textures, motion clips, and audio.
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          className="hidden"
          aria-hidden
          onChange={handleFileSelect}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="gap-2"
        >
          <UploadSimple className="h-4 w-4" />
          Upload
        </Button>
      </div>

      <Tabs value={visibility} onValueChange={(value) => setVisibility(value as AssetVisibility | "all")}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="private">Private</TabsTrigger>
          <TabsTrigger value="public">Public</TabsTrigger>
        </TabsList>
      </Tabs>

      <Tabs value={category} onValueChange={(value) => setCategory(value as AssetCategory | "all")}>
        <TabsList className="mb-6 flex flex-wrap h-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          {ASSET_CATEGORIES.map((item) => (
            <TabsTrigger key={item} value={item}>
              {ASSET_CATEGORY_LABELS[item]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading assets...</div>
      ) : assets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No assets in this filter.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((asset) => renderAssetCard(asset))}
        </div>
      )}

      {uploadedFileUrl && uploadedAssetType && (
        <CreateAssetDialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open)
            if (!open) {
              setUploadedFileUrl(null)
              setUploadedAssetType(null)
              setUploadedFileName("")
            }
          }}
          initial={{
            url: uploadedFileUrl,
            assetType: uploadedAssetType,
            title: uploadedFileName,
          }}
          onSaved={() => void refreshAssets()}
        />
      )}

      {editingAsset && (
        <CreateAssetDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open)
            if (!open) {
              setEditingAsset(null)
            }
          }}
          mode="edit"
          assetId={editingAsset.id}
          initial={{
            url: editingAsset.url,
            assetType: editingAsset.assetType,
            title: editingAsset.title,
            visibility: editingAsset.visibility,
            category: editingAsset.category,
            tags: editingAsset.tags,
            sourceNodeType: editingAsset.sourceNodeType || undefined,
          }}
          onSaved={() => void refreshAssets()}
        />
      )}
    </div>
  )
}
