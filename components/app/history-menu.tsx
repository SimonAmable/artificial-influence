"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Maximize2, Image as ImageIcon, Video as VideoIcon } from "lucide-react"
import Image from "next/image"

type GenerationType = 'image' | 'video'

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

interface GroupedGenerations {
  [date: string]: Generation[]
}

interface HistoryMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  viewMode?: 'dialog' | 'sidebar'
}

function groupByDate(generations: Generation[]): GroupedGenerations {
  const grouped: GroupedGenerations = {}
  
  generations.forEach((generation) => {
    const date = new Date(generation.created_at)
    const dateKey = date.toISOString().split('T')[0] // YYYY-MM-DD
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = []
    }
    grouped[dateKey].push(generation)
  })
  
  return grouped
}

function formatDateHeader(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  const genDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  
  if (genDate.getTime() === today.getTime()) {
    return 'Today'
  } else if (genDate.getTime() === yesterday.getTime()) {
    return 'Yesterday'
  } else {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    })
  }
}

function HistoryContent({ 
  activeTab, 
  setActiveTab,
  onToggleView 
}: { 
  activeTab: GenerationType
  setActiveTab: (tab: GenerationType) => void
  onToggleView?: () => void
}) {
  const [imageGenerations, setImageGenerations] = React.useState<Generation[]>([])
  const [videoGenerations, setVideoGenerations] = React.useState<Generation[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    console.log('[HistoryMenu] Component mounted, fetching generations...')
    fetchGenerations()
  }, [])

  const fetchGenerations = async () => {
    console.log('[HistoryMenu] Starting fetch...')
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        console.error('[HistoryMenu] Auth error:', authError)
      }
      
      if (!user) {
        console.log('[HistoryMenu] No user found')
        setLoading(false)
        return
      }

      console.log('[HistoryMenu] User found:', user.id)

      // Fetch images
      console.log('[HistoryMenu] Fetching images...')
      const imageResponse = await fetch('/api/generations?type=image')
      console.log('[HistoryMenu] Image response status:', imageResponse.status)
      
      if (imageResponse.ok) {
        const imageData = await imageResponse.json()
        console.log('[HistoryMenu] Images fetched:', imageData.generations?.length || 0)
        setImageGenerations(imageData.generations || [])
      } else {
        console.error('[HistoryMenu] Image fetch failed:', await imageResponse.text())
      }

      // Fetch videos
      console.log('[HistoryMenu] Fetching videos...')
      const videoResponse = await fetch('/api/generations?type=video')
      console.log('[HistoryMenu] Video response status:', videoResponse.status)
      
      if (videoResponse.ok) {
        const videoData = await videoResponse.json()
        console.log('[HistoryMenu] Videos fetched:', videoData.generations?.length || 0)
        setVideoGenerations(videoData.generations || [])
      } else {
        console.error('[HistoryMenu] Video fetch failed:', await videoResponse.text())
      }
    } catch (error) {
      console.error('[HistoryMenu] Error fetching generations:', error)
    } finally {
      setLoading(false)
      console.log('[HistoryMenu] Fetch complete')
    }
  }

  const imageGrouped = groupByDate(imageGenerations)
  const videoGrouped = groupByDate(videoGenerations)
  const imageCount = imageGenerations.length
  const videoCount = videoGenerations.length

  return (
    <div className="flex flex-col h-full">
      {/* Header with toggle view button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1" />
        {onToggleView && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleView}
            className="h-8 w-8"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Tabs for Image/Video History */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as GenerationType)} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="image" className="text-sm">
            <ImageIcon className="h-4 w-4 mr-2" />
            Image History ({imageCount})
          </TabsTrigger>
          <TabsTrigger value="video" className="text-sm">
            <VideoIcon className="h-4 w-4 mr-2" />
            Video History ({videoCount})
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <>
              <TabsContent value="image" className="mt-0">
                {Object.keys(imageGrouped).length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No image history yet</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(imageGrouped)
                      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
                      .map(([date, generations]) => (
                        <div key={date}>
                          <h3 className="text-sm font-medium text-muted-foreground mb-3">
                            {formatDateHeader(date)}
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            {generations.map((gen) => (
                              <div
                                key={gen.id}
                                className="relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                              >
                                <Image
                                  src={gen.url}
                                  alt={gen.prompt || 'Generated image'}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="video" className="mt-0">
                {Object.keys(videoGrouped).length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No video history yet</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(videoGrouped)
                      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
                      .map(([date, generations]) => (
                        <div key={date}>
                          <h3 className="text-sm font-medium text-muted-foreground mb-3">
                            {formatDateHeader(date)}
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            {generations.map((gen) => (
                              <div
                                key={gen.id}
                                className="relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                              >
                                <video
                                  src={gen.url}
                                  className="w-full h-full object-cover"
                                  preload="metadata"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  )
}

export function HistoryMenu({ open, onOpenChange, viewMode = 'dialog' }: HistoryMenuProps) {
  const [activeTab, setActiveTab] = React.useState<GenerationType>('image')
  const [key, setKey] = React.useState(0)
  const [currentViewMode, setCurrentViewMode] = React.useState(viewMode)

  React.useEffect(() => {
    setCurrentViewMode(viewMode)
  }, [viewMode])

  // Remount content when opening to refetch data
  React.useEffect(() => {
    if (open) {
      console.log('[HistoryMenu] Dialog/Sheet opened, forcing refetch')
      setKey(prev => prev + 1)
    }
  }, [open])

  React.useEffect(() => {
    setCurrentViewMode(viewMode)
  }, [viewMode])

  const toggleViewMode = () => {
    setCurrentViewMode(currentViewMode === 'dialog' ? 'sidebar' : 'dialog')
  }

  if (currentViewMode === 'dialog') {
    return (
      <Dialog key={key} open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <ImageIcon className="h-5 w-5 mr-2" />
              Image History
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <HistoryContent 
              activeTab={activeTab} 
              setActiveTab={setActiveTab}
              onToggleView={toggleViewMode}
            />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[400px] sm:w-[540px] flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center justify-between">
            <span>Mine</span>
            <Button
              variant="ghost"
            key={key}
              size="icon"
              onClick={toggleViewMode}
              className="h-8 w-8"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 min-h-0 px-6 py-4 overflow-hidden">
          <HistoryContent 
            activeTab={activeTab} 
            setActiveTab={setActiveTab}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
