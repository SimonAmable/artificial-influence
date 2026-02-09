"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { X, ClockCounterClockwise, FolderOpen, CircleNotch, Copy, Check } from "@phosphor-icons/react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import type { AssetRecord } from "@/lib/assets/types"
import { listAssets } from "@/lib/assets/library"

interface Generation {
  id: string
  user_id: string
  prompt: string | null
  supabase_storage_path: string
  type: 'image' | 'video' | 'audio'
  model: string | null
  created_at: string
  url: string
}

interface AssetSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (imageUrl: string) => void
}

// Helper function to format date (relative)
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
  })
}

export function AssetSelectionModal({ open, onOpenChange, onSelect }: AssetSelectionModalProps) {
  const [activeTab, setActiveTab] = React.useState<"history" | "assets">("history")
  const [generations, setGenerations] = React.useState<Generation[]>([])
  const [assets, setAssets] = React.useState<AssetRecord[]>([])
  const [loadingHistory, setLoadingHistory] = React.useState(false)
  const [loadingAssets, setLoadingAssets] = React.useState(false)
  const [historyError, setHistoryError] = React.useState<string | null>(null)
  const [assetsError, setAssetsError] = React.useState<string | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  // Fetch history when tab is opened
  React.useEffect(() => {
    if (open && activeTab === "history" && generations.length === 0) {
      fetchHistory()
    }
  }, [open, activeTab])

  // Fetch assets when tab is opened
  React.useEffect(() => {
    if (open && activeTab === "assets" && assets.length === 0) {
      fetchAssets()
    }
  }, [open, activeTab])

  const fetchHistory = async () => {
    setLoadingHistory(true)
    setHistoryError(null)
    try {
      const response = await fetch('/api/generations?type=image&limit=50')
      if (!response.ok) {
        throw new Error('Failed to fetch history')
      }
      const data = await response.json()
      setGenerations(data.generations || [])
    } catch (error) {
      console.error('Error fetching history:', error)
      setHistoryError(error instanceof Error ? error.message : 'Failed to load history')
    } finally {
      setLoadingHistory(false)
    }
  }

  const fetchAssets = async () => {
    setLoadingAssets(true)
    setAssetsError(null)
    try {
      const data = await listAssets({
        limit: 50,
      })
      setAssets(data)
    } catch (error) {
      console.error('Error fetching assets:', error)
      setAssetsError(error instanceof Error ? error.message : 'Failed to load assets')
    } finally {
      setLoadingAssets(false)
    }
  }

  const handleSelect = (url: string) => {
    onSelect(url)
    onOpenChange(false)
  }

  const handleCopyPrompt = async (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(`${id}-prompt`)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Failed to copy prompt:', error)
    }
  }

  // Handle keyboard navigation
  React.useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-screen! h-screen! max-w-none! m-0! p-0! gap-0 overflow-hidden border-0 rounded-none! translate-x-0! translate-y-0! left-0! top-0! fixed! inset-0!"
        aria-describedby="asset-selection-description"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
          <DialogHeader className="p-0 space-y-0">
            <DialogTitle className="text-xl font-semibold">Select Reference Image</DialogTitle>
            <p id="asset-selection-description" className="text-sm text-muted-foreground mt-1">
              Choose an image from your history or saved assets
            </p>
          </DialogHeader>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-full"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" weight="bold" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "history" | "assets")} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-2 pb-2">
            <TabsList>
              <TabsTrigger value="history" className="gap-2">
                <ClockCounterClockwise className="h-4 w-4" />
                History
              </TabsTrigger>
              <TabsTrigger value="assets" className="gap-2">
                <FolderOpen className="h-4 w-4" />
                Assets
              </TabsTrigger>
            </TabsList>
          </div>

          {/* History Tab */}
          <TabsContent value="history" className="flex-1 overflow-y-auto p-4 m-0">
            {loadingHistory ? (
              <div className="flex items-center justify-center h-64">
                <CircleNotch className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : historyError ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <p className="text-sm">{historyError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchHistory}
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            ) : generations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <ClockCounterClockwise className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">No generation history</p>
                <p className="text-xs mt-1">Generate your first image to see it here</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {generations.map((generation) => (
                  <div
                    key={generation.id}
                    className="overflow-hidden rounded-md"
                  >
                    <div 
                      className="group/image relative aspect-square cursor-pointer hover:ring-2 hover:ring-primary transition-all rounded-md"
                      onClick={() => handleSelect(generation.url)}
                      role="button"
                      tabIndex={0}
                      aria-label="Select image"
                    >
                      <Image
                        src={generation.url}
                        alt={generation.prompt || 'Generated image'}
                        fill
                        className="object-cover rounded-md"
                        unoptimized
                      />
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                        <span className="text-white text-sm font-medium">Select</span>
                      </div>
                    </div>
                    {/* Metadata */}
                    <div className="flex flex-col gap-0.5 mt-2 px-1">
                      <p className="text-xs text-muted-foreground truncate">
                        {formatDate(generation.created_at)}
                      </p>
                      {generation.prompt && (
                        <div 
                          className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors group/prompt"
                          onClick={(e) => handleCopyPrompt(e, generation.prompt!, generation.id)}
                          role="button"
                          tabIndex={0}
                          aria-label="Copy prompt"
                        >
                          <p className="text-xs text-foreground truncate flex-1">
                            {generation.prompt}
                          </p>
                          {copiedId === `${generation.id}-prompt` ? (
                            <Check className="h-3 w-3 flex-shrink-0 text-primary" weight="bold" />
                          ) : (
                            <Copy className="h-3 w-3 flex-shrink-0 opacity-0 group-hover/prompt:opacity-100 transition-opacity" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets" className="flex-1 overflow-y-auto p-4 m-0">
            {loadingAssets ? (
              <div className="flex items-center justify-center h-64">
                <CircleNotch className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : assetsError ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <p className="text-sm">{assetsError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchAssets}
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">No saved assets</p>
                <p className="text-xs mt-1">Save your first asset to see it here</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="overflow-hidden rounded-md"
                  >
                    <div 
                      className="group/image relative aspect-square cursor-pointer hover:ring-2 hover:ring-primary transition-all rounded-md"
                      onClick={() => handleSelect(asset.url)}
                      role="button"
                      tabIndex={0}
                      aria-label="Select image"
                    >
                      <Image
                        src={asset.thumbnailUrl || asset.url}
                        alt={asset.title}
                        fill
                        className="object-cover rounded-md"
                        unoptimized
                      />
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                        <span className="text-white text-sm font-medium">Select</span>
                      </div>
                    </div>
                    {/* Metadata */}
                    <div className="flex flex-col gap-0.5 mt-2 px-1">
                      <p className="text-xs text-foreground truncate font-medium">
                        {asset.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatDate(asset.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
