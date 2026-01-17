"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { CircleNotch } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

interface VideoDisplayProps {
  videos: string[]
  isGenerating?: boolean
  className?: string
}

export function VideoDisplay({ videos, isGenerating = false, className }: VideoDisplayProps) {
  if (videos.length === 0 && !isGenerating) {
    return null
  }

  return (
    <div className={cn("w-full h-full", className)}>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 p-4 sm:p-6">
        {isGenerating && (
          <Card className="w-full">
            <CardContent className="flex flex-col items-center justify-center p-8 min-h-[400px]">
              <CircleNotch className="size-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Generating video...</p>
            </CardContent>
          </Card>
        )}
        
        {videos.map((videoUrl, index) => (
          <Card key={index} className="w-full overflow-hidden">
            <CardContent className="p-0">
              <video
                src={videoUrl}
                controls
                className="w-full h-auto"
                preload="metadata"
              >
                Your browser does not support the video tag.
              </video>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
