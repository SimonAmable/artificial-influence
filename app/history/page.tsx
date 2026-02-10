"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DotsThreeVertical, Download, Trash, Image as ImageIcon, Video, MusicNote } from "@phosphor-icons/react"
import Image from "next/image"

type GenerationType = 'image' | 'video' | 'audio' | 'all'

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

// Helper function to format date
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

// Helper function to get type icon
function getTypeIcon(type: 'image' | 'video' | 'audio') {
  switch (type) {
    case 'image':
      return ImageIcon
    case 'video':
      return Video
    case 'audio':
      return MusicNote
  }
}

export default function AssetsPage() {
  const [generations, setGenerations] = React.useState<Generation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<GenerationType>('all')

  React.useEffect(() => {
    fetchGenerations(activeTab)
  }, [activeTab])

  const fetchGenerations = async (type: GenerationType) => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setLoading(false)
        return
      }

      const typeParam = type === 'all' ? '' : `?type=${type}`
      const response = await fetch(`/api/generations${typeParam}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch generations')
      }

      const data = await response.json()
      setGenerations(data.generations || [])
    } catch (error) {
      console.error('Error fetching generations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (generation: Generation) => {
    try {
      // Fetch the file as a blob to ensure proper download
      const response = await fetch(generation.url)
      if (!response.ok) {
        throw new Error('Failed to fetch file')
      }
      
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      
      // Determine file extension based on type
      const extension = generation.type === 'image' ? 'png' : 
                       generation.type === 'video' ? 'mp4' : 
                       'mp3'
      
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `${generation.type}-${generation.id}.${extension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up the blob URL
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('Error downloading file:', error)
      // Fallback: try direct download
      const link = document.createElement('a')
      link.href = generation.url
      link.download = `${generation.type}-${generation.id}`
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleDelete = async (generation: Generation) => {
    if (!confirm('Are you sure you want to delete this asset?')) return
    
    try {
      const response = await fetch(`/api/generations/${generation.id}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        setGenerations(prev => prev.filter(g => g.id !== generation.id))
      } else {
        console.error('Failed to delete generation')
      }
    } catch (error) {
      console.error('Error deleting generation:', error)
    }
  }

  const renderAssetCard = (generation: Generation) => {
    const TypeIcon = getTypeIcon(generation.type)
    
    return (
      <div key={generation.id} className="group">
        <div className="relative">
          {generation.type === 'image' && (
            <div className="relative aspect-square w-full">
              <Image
                src={generation.url}
                alt={generation.prompt || 'Generated image'}
                fill
                className="object-cover rounded-lg"
              />
            </div>
          )}
          {generation.type === 'video' && (
            <div className="relative w-full">
              <video
                src={generation.url}
                controls
                className="w-full h-auto rounded-lg"
                preload="metadata"
              />
            </div>
          )}
          {generation.type === 'audio' && (
            <div>
              <audio
                src={generation.url}
                controls
                className="w-full"
              />
            </div>
          )}
          
          {/* Action Menu Button - positioned absolutely */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-background/80 hover:bg-background backdrop-blur-sm"
                >
                  <DotsThreeVertical className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDownload(generation)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleDelete(generation)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Metadata Section - consistent for all types */}
        <div className="mt-3 space-y-2">
          {/* Type Badge and Date */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="gap-1">
              <TypeIcon className="h-3 w-3" />
              <span className="capitalize">{generation.type}</span>
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDate(generation.created_at)}
            </span>
          </div>

          {/* Model (if available) */}
          {generation.model && (
            <div className="text-xs text-muted-foreground">
              Model: <span className="font-medium">{generation.model}</span>
            </div>
          )}

          {/* Prompt/Description */}
          {generation.prompt && (
            <p className="text-sm text-foreground line-clamp-2">
              {generation.prompt}
            </p>
          )}
        </div>
      </div>
    )
  }

  const renderAssetGrid = (emptyMessage: string) => {
    if (loading) {
      return <div className="text-center py-12">Loading...</div>
    }
    
    if (generations.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          {emptyMessage}
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {generations.map((generation) => renderAssetCard(generation))}
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 pt-24 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Generation History</h1>
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as GenerationType)}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="image">Images</TabsTrigger>
          <TabsTrigger value="video">Videos</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-0">
          {renderAssetGrid("No generations found.")}
        </TabsContent>
        
        <TabsContent value="image" className="mt-0">
          {renderAssetGrid("No image generations found.")}
        </TabsContent>
        
        <TabsContent value="video" className="mt-0">
          {renderAssetGrid("No video generations found.")}
        </TabsContent>
        
        <TabsContent value="audio" className="mt-0">
          {renderAssetGrid("No audio generations found.")}
        </TabsContent>
      </Tabs>
    </div>
  )
}
